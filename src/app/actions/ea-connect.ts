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
import {
  clearPendingEaCookies,
  getPendingEaTokens,
  getPendingPersonas,
  getTempEaAuth,
  setPendingEaTokens,
  setPendingPersonas,
  setTempEaAuth,
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
    await setPendingEaTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      console: tokens.console,
      personaId: tokens.personaId,
      blazeId: tokens.blazeId,
    });
    redirect(`/leagues/${slug}/sync?step=league`);
  }

  redirect(`/leagues/${slug}/sync?step=persona`);
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
  if (mode === "stub") {
    const client = getEaClient();
    const temp = await getTempEaAuth();
    const tokens = await client.exchangeCallbackUrl(
      temp?.callbackUrl ?? "http://127.0.0.1/success?code=stub",
      personaId,
    );
    await setPendingEaTokens(tokens);
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
  await setPendingEaTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    console: tokens.console,
    personaId: tokens.personaId,
    blazeId: tokens.blazeId,
  });
  redirect(`/leagues/${slug}/sync?step=league`);
}

export async function selectEaLeagueAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const eaLeagueId = String(formData.get("eaLeagueId") ?? "");
  if (!leagueId || !eaLeagueId) {
    throw new Error("League and EA league are required");
  }

  await requireCommissioner(leagueId, session.user.id);
  const tokens = await getPendingEaTokens();
  if (!tokens) {
    throw new Error("EA login session expired. Start connect again.");
  }

  let eaLeagueName: string | undefined;
  const mode = process.env.EA_CLIENT_MODE ?? "stub";
  if (mode === "stub") {
    const leagues = await getEaClient().listLeagues(tokens);
    eaLeagueName = leagues.find((league) => league.id === eaLeagueId)?.name;
  } else {
    const { tokens: fresh, session: blaze } = await createBlazeSession({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt ?? new Date(0),
      console: tokens.console!,
      personaId: tokens.personaId!,
      blazeId: tokens.blazeId,
    });
    const leagues = await getMyLeagues(fresh, blaze);
    eaLeagueName = leagues.find((league) => String(league.leagueId) === eaLeagueId)
      ?.leagueName;
    tokens.accessToken = fresh.accessToken;
    tokens.refreshToken = fresh.refreshToken;
    tokens.expiresAt = fresh.expiresAt;
    tokens.blazeId = fresh.blazeId;
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
      eaLeagueName: eaLeagueName ?? null,
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
      eaLeagueName: eaLeagueName ?? null,
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
