import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { EaTokens } from "./types";
import type { EaPersonaOption } from "./auth";

const SESSION_COOKIE = "maddenhq_ea_pending";
const MAX_AGE_SECONDS = 60 * 15;

export type PendingEaLeague = {
  id: string;
  name: string;
  seasonText?: string;
};

type TempAuth = {
  tempAccessToken: string;
  callbackUrl: string;
};

type PendingPayload = {
  tempAuth?: TempAuth | null;
  personas?: EaPersonaOption[];
  tokens?: (Omit<EaTokens, "expiresAt"> & { expiresAt?: string }) | null;
  leagues?: PendingEaLeague[];
};

async function readCookieId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

async function writeCookieId(id: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

async function loadPayload(): Promise<{ id: string; data: PendingPayload } | null> {
  const id = await readCookieId();
  if (!id) return null;

  const row = await prisma.pendingEaConnect.findUnique({ where: { id } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.pendingEaConnect.delete({ where: { id } }).catch(() => undefined);
    return null;
  }

  try {
    const data = JSON.parse(decryptSecret(row.payload)) as PendingPayload;
    return { id, data };
  } catch {
    return null;
  }
}

async function savePayload(
  userId: string,
  leagueId: string,
  patch: PendingPayload,
): Promise<string> {
  const existing = await loadPayload();
  const merged: PendingPayload = {
    ...(existing?.data ?? {}),
    ...patch,
  };

  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  const payload = encryptSecret(JSON.stringify(merged));

  if (existing?.id) {
    await prisma.pendingEaConnect.update({
      where: { id: existing.id },
      data: {
        userId,
        leagueId,
        payload,
        expiresAt,
      },
    });
    await writeCookieId(existing.id);
    return existing.id;
  }

  const created = await prisma.pendingEaConnect.create({
    data: {
      userId,
      leagueId,
      payload,
      expiresAt,
    },
  });
  await writeCookieId(created.id);
  return created.id;
}

/**
 * Bind pending wizard state to a MaddenHQ league + user.
 * Call before the first set* so the row has ownership context.
 */
export async function beginPendingEaConnect(userId: string, leagueId: string) {
  await savePayload(userId, leagueId, {});
}

export async function setTempEaAuth(
  value: TempAuth,
  ctx?: { userId: string; leagueId: string },
) {
  if (!ctx) {
    const existing = await loadPayload();
    if (!existing) {
      throw new Error("EA connect session missing. Start connect again.");
    }
    const row = await prisma.pendingEaConnect.findUnique({ where: { id: existing.id } });
    if (!row) throw new Error("EA connect session missing. Start connect again.");
    await savePayload(row.userId, row.leagueId, { tempAuth: value });
    return;
  }
  await savePayload(ctx.userId, ctx.leagueId, { tempAuth: value });
}

export async function getTempEaAuth(): Promise<TempAuth | null> {
  const existing = await loadPayload();
  return existing?.data.tempAuth ?? null;
}

export async function setPendingPersonas(
  personas: EaPersonaOption[],
  ctx?: { userId: string; leagueId: string },
) {
  if (!ctx) {
    const existing = await loadPayload();
    if (!existing) throw new Error("EA connect session missing. Start connect again.");
    const row = await prisma.pendingEaConnect.findUnique({ where: { id: existing.id } });
    if (!row) throw new Error("EA connect session missing. Start connect again.");
    await savePayload(row.userId, row.leagueId, { personas });
    return;
  }
  await savePayload(ctx.userId, ctx.leagueId, { personas });
}

export async function getPendingPersonas(): Promise<EaPersonaOption[]> {
  const existing = await loadPayload();
  return existing?.data.personas ?? [];
}

export async function setPendingEaTokens(
  tokens: EaTokens,
  ctx?: { userId: string; leagueId: string },
) {
  const serialized = {
    ...tokens,
    expiresAt: tokens.expiresAt?.toISOString(),
  };
  if (!ctx) {
    const existing = await loadPayload();
    if (!existing) throw new Error("EA connect session missing. Start connect again.");
    const row = await prisma.pendingEaConnect.findUnique({ where: { id: existing.id } });
    if (!row) throw new Error("EA connect session missing. Start connect again.");
    await savePayload(row.userId, row.leagueId, { tokens: serialized });
    return;
  }
  await savePayload(ctx.userId, ctx.leagueId, { tokens: serialized });
}

export async function getPendingEaTokens(): Promise<EaTokens | null> {
  const existing = await loadPayload();
  const tokens = existing?.data.tokens;
  if (!tokens) return null;
  return {
    ...tokens,
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : undefined,
  };
}

export async function setPendingLeagues(
  leagues: PendingEaLeague[],
  ctx?: { userId: string; leagueId: string },
) {
  if (!ctx) {
    const existing = await loadPayload();
    if (!existing) throw new Error("EA connect session missing. Start connect again.");
    const row = await prisma.pendingEaConnect.findUnique({ where: { id: existing.id } });
    if (!row) throw new Error("EA connect session missing. Start connect again.");
    await savePayload(row.userId, row.leagueId, { leagues });
    return;
  }
  await savePayload(ctx.userId, ctx.leagueId, { leagues });
}

export async function getPendingLeagues(): Promise<PendingEaLeague[]> {
  const existing = await loadPayload();
  return existing?.data.leagues ?? [];
}

export async function clearPendingEaCookies() {
  const id = await readCookieId();
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  if (id) {
    await prisma.pendingEaConnect.delete({ where: { id } }).catch(() => undefined);
  }
  // Opportunistic cleanup of expired rows
  await prisma.pendingEaConnect
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);
}
