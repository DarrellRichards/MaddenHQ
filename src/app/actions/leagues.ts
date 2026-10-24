"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { encryptSecret } from "@/lib/crypto";
import { getEaClient } from "@/server/ea";
import { syncLeagueFromEa } from "@/server/ea/sync";

export async function createLeagueAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim() || null;

  if (!name) {
    throw new Error("League name is required");
  }

  let slug = slugify(name) || "league";
  const existing = await prisma.league.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const league = await prisma.league.create({
    data: {
      name,
      slug,
      description: description || null,
      platform,
      memberships: {
        create: {
          userId: session.user.id,
          role: MembershipRole.OWNER,
        },
      },
      seasons: {
        create: {
          year: new Date().getFullYear(),
          label: `${new Date().getFullYear()} Season`,
          isCurrent: true,
        },
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/leagues/${league.slug}`);
}

export async function connectEaAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const leagueId = String(formData.get("leagueId") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "").trim();
  const slug = String(formData.get("slug") ?? "");

  if (!leagueId || !callbackUrl) {
    throw new Error("League and EA callback URL are required");
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_userId: { leagueId, userId: session.user.id },
    },
  });

  if (
    !membership ||
    (membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.COMMISSIONER)
  ) {
    throw new Error("Only commissioners can connect EA");
  }

  const client = getEaClient();
  const tokens = await client.exchangeCallbackUrl(callbackUrl);
  const leagues = await client.listLeagues(tokens);

  await prisma.eaConnection.upsert({
    where: { leagueId },
    create: {
      leagueId,
      userId: session.user.id,
      accessTokenEncrypted: encryptSecret(tokens.accessToken),
      refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
      accessTokenExpiresAt: tokens.expiresAt,
      eaLeagueId: leagues[0]?.id,
      lastSyncStatus: "connected",
    },
    update: {
      userId: session.user.id,
      accessTokenEncrypted: encryptSecret(tokens.accessToken),
      refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
      accessTokenExpiresAt: tokens.expiresAt,
      eaLeagueId: leagues[0]?.id,
      lastSyncStatus: "connected",
    },
  });

  revalidatePath(`/leagues/${slug}/sync`);
  redirect(`/leagues/${slug}/sync`);
}

export async function triggerSyncAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_userId: { leagueId, userId: session.user.id },
    },
  });

  if (
    !membership ||
    (membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.COMMISSIONER)
  ) {
    throw new Error("Only commissioners can sync");
  }

  await syncLeagueFromEa(leagueId);
  revalidatePath(`/leagues/${slug}`);
  redirect(`/leagues/${slug}/sync`);
}
