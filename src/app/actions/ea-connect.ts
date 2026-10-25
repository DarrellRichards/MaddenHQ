"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { exchangePersonaTokens, listPersonasFromCallback } from "@/server/ea/auth";
import { createBlazeSession, getMyLeagues } from "@/server/ea/blaze";
import { getEaClient } from "@/server/ea";
import type { EaTokens } from "@/server/ea/types";
import {
  clearPendingEaCookies,
  getPendingEaTokens,
  getPendingLeagues,
  getPendingPersonas,
  getTempEaAuth,
  setPendingEaTokens,
  setPendingLeagues,
  setPendingPersonas,
  setTempEaAuth,
  type PendingEaLeague,
} from "@/server/ea/pending-cookie";

async function requireCommissioner(leagueId: string, userId: string) {
  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (
    !membership ||
    (membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.COMMISSIONER)
  ) {
    throw new Error("Only commissioners can connect EA");
  }
}

async function storePendingSessionAndLeagues(tokens: EaTokens): Promise<PendingEaLeague[]> {
  await setPendingEaTokens(tokens);

  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  if (mode === "stub") {
    const leagues = (await getEaClient().listLeagues(tokens)).map((entry) => ({
      id: entry.id,
      name: entry.name,
      seasonText: entry.seasonText,
    }));
    await setPendingLeagues(leagues);
    return leagues;
  }

  if (!tokens.console || !tokens.personaId) {
    await setPendingLeagues([]);
    return [];
  }

  try {
    const { tokens: fresh, session } = await createBlazeSession({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt ?? new Date(0),
      console: tokens.console,
      personaId: tokens.personaId,
      blazeId: tokens.blazeId,
    });
    await setPendingEaTokens({
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      expiresAt: fresh.expiresAt,
      console: fresh.console,
      personaId: fresh.personaId,
      blazeId: fresh.blazeId,
    });
    const rows = await getMyLeagues(fresh, session);
    const leagues = rows.map((entry) => ({
      id: String(entry.leagueId),
      name: entry.leagueName,
      seasonText: entry.seasonText,
    }));
    await setPendingLeagues(leagues);
    return leagues;
  } catch (error) {
    // Keep tokens so the commissioner can still enter a league id manually.
    await setPendingLeagues([]);
    throw error;
  }
}

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function redirectWithEaError(slug: string, step: string, error: unknown): never {
  if (isNextRedirect(error)) {
    throw error;
  }
  const message =
    error instanceof Error
      ? error.message.slice(0, 280)
      : "EA request failed. Try again in a few minutes.";
  redirect(
    `/leagues/${slug}/sync?step=${encodeURIComponent(step)}&error=${encodeURIComponent(message)}`,
  );
}

export async function discoverEaPersonasAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "").trim();
  if (!leagueId || !callbackUrl) {
    throw new Error("League and EA callback URL are required");
  }

  await requireCommissioner(leagueId, session.user.id);

  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  try {
    if (mode === "stub") {
      const client = getEaClient();
      const personas = (await client.listPersonas?.(callbackUrl)) ?? [];
      await setTempEaAuth({ tempAccessToken: "stub", callbackUrl });
      await setPendingPersonas(personas);
      redirect(`/leagues/${slug}/sync?step=persona`);
    }

    const discovered = await listPersonasFromCallback(callbackUrl);
    await setTempEaAuth({
      tempAccessToken: discovered.tempAccessToken,
      callbackUrl,
    });
    await setPendingPersonas(discovered.personas);

    if (discovered.personas.length === 1) {
      const persona = discovered.personas[0]!;
      const sessionTokens = await exchangePersonaTokens({
        tempAccessToken: discovered.tempAccessToken,
        persona,
      });
      const { tokens } = await createBlazeSession(sessionTokens);
      try {
        await storePendingSessionAndLeagues({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          console: tokens.console,
          personaId: tokens.personaId,
          blazeId: tokens.blazeId,
        });
        redirect(`/leagues/${slug}/sync?step=league`);
      } catch (error) {
        redirectWithEaError(slug, "league", error);
      }
    }

    redirect(`/leagues/${slug}/sync?step=persona`);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirectWithEaError(slug, "connect", error);
  }
}

export async function selectEaPersonaAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const personaId = String(formData.get("personaId") ?? "");
  if (!leagueId || !personaId) {
    throw new Error("League and persona are required");
  }

  await requireCommissioner(leagueId, session.user.id);

  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  try {
    if (mode === "stub") {
      const client = getEaClient();
      const temp = await getTempEaAuth();
      const tokens = await client.exchangeCallbackUrl(
        temp?.callbackUrl ?? "http://127.0.0.1/success?code=stub",
        personaId,
      );
      await storePendingSessionAndLeagues(tokens);
      redirect(`/leagues/${slug}/sync?step=league`);
    }

    const temp = await getTempEaAuth();
    const personas = await getPendingPersonas();
    const persona = personas.find((entry) => entry.personaId === personaId);
    if (!temp || !persona) {
      throw new Error("EA login session expired. Paste the callback URL again.");
    }

    const sessionTokens = await exchangePersonaTokens({
      tempAccessToken: temp.tempAccessToken,
      persona,
    });
    const { tokens } = await createBlazeSession(sessionTokens);
    try {
      await storePendingSessionAndLeagues({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        console: tokens.console,
        personaId: tokens.personaId,
        blazeId: tokens.blazeId,
      });
      redirect(`/leagues/${slug}/sync?step=league`);
    } catch (error) {
      redirectWithEaError(slug, "league", error);
    }
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirectWithEaError(slug, "persona", error);
  }
}

export async function retryEaLeagueListAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  await requireCommissioner(leagueId, session.user.id);

  const tokens = await getPendingEaTokens();
  if (!tokens) {
    redirect(`/leagues/${slug}/sync?error=${encodeURIComponent("EA session expired. Start connect again.")}`);
  }

  try {
    await storePendingSessionAndLeagues(tokens);
    redirect(`/leagues/${slug}/sync?step=league`);
  } catch (error) {
    redirectWithEaError(slug, "league", error);
  }
}

export async function selectEaLeagueAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const eaLeagueId = String(formData.get("eaLeagueId") ?? "").trim();
  if (!leagueId || !eaLeagueId) {
    throw new Error("League and EA league are required");
  }

  await requireCommissioner(leagueId, session.user.id);
  const tokens = await getPendingEaTokens();
  if (!tokens) {
    throw new Error("EA login session expired. Start connect again.");
  }

  const cached = await getPendingLeagues();
  let eaLeagueName = cached.find((entry) => entry.id === eaLeagueId)?.name;

  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  if (!eaLeagueName && mode !== "stub" && tokens.console && tokens.personaId) {
    try {
      const { tokens: fresh, session: blaze } = await createBlazeSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt ?? new Date(0),
        console: tokens.console,
        personaId: tokens.personaId,
        blazeId: tokens.blazeId,
      });
      const leagues = await getMyLeagues(fresh, blaze);
      eaLeagueName = leagues.find((entry) => String(entry.leagueId) === eaLeagueId)
        ?.leagueName;
      tokens.accessToken = fresh.accessToken;
      tokens.refreshToken = fresh.refreshToken;
      tokens.expiresAt = fresh.expiresAt;
      tokens.blazeId = fresh.blazeId;
    } catch {
      // Manual league id entry is allowed when listing fails.
      eaLeagueName = eaLeagueName ?? `EA League ${eaLeagueId}`;
    }
  }

  if (!eaLeagueName && mode === "stub") {
    const leagues = await getEaClient().listLeagues(tokens);
    eaLeagueName = leagues.find((entry) => entry.id === eaLeagueId)?.name;
  }

  await prisma.eaConnection.upsert({
    where: { leagueId },
    create: {
      leagueId,
      userId: session.user.id,
      accessTokenEncrypted: encryptSecret(tokens.accessToken),
      refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
      accessTokenExpiresAt: tokens.expiresAt,
      eaLeagueId,
      eaLeagueName: eaLeagueName ?? `EA League ${eaLeagueId}`,
      console: tokens.console ?? null,
      personaId: tokens.personaId ?? null,
      blazeId: tokens.blazeId ?? null,
      lastSyncStatus: "connected",
    },
    update: {
      userId: session.user.id,
      accessTokenEncrypted: encryptSecret(tokens.accessToken),
      refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
      accessTokenExpiresAt: tokens.expiresAt,
      eaLeagueId,
      eaLeagueName: eaLeagueName ?? `EA League ${eaLeagueId}`,
      console: tokens.console ?? null,
      personaId: tokens.personaId ?? null,
      blazeId: tokens.blazeId ?? null,
      lastSyncStatus: "connected",
    },
  });

  await clearPendingEaCookies();
  revalidatePath(`/leagues/${slug}/sync`);
  redirect(`/leagues/${slug}/sync`);
}
