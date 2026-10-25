import { cookies } from "next/headers";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { EaTokens } from "./types";
import type { EaPersonaOption } from "./auth";

const TEMP_COOKIE = "maddenhq_ea_temp";
const SESSION_COOKIE = "maddenhq_ea_session";
const PERSONAS_COOKIE = "maddenhq_ea_personas";
const LEAGUES_COOKIE = "maddenhq_ea_leagues";
const MAX_AGE = 60 * 10;

export type PendingEaLeague = {
  id: string;
  name: string;
  seasonText?: string;
};

type TempAuth = {
  tempAccessToken: string;
  callbackUrl: string;
};

export async function setTempEaAuth(value: TempAuth) {
  const jar = await cookies();
  jar.set(TEMP_COOKIE, encryptSecret(JSON.stringify(value)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getTempEaAuth(): Promise<TempAuth | null> {
  const jar = await cookies();
  const raw = jar.get(TEMP_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decryptSecret(raw)) as TempAuth;
  } catch {
    return null;
  }
}

export async function setPendingPersonas(personas: EaPersonaOption[]) {
  const jar = await cookies();
  jar.set(PERSONAS_COOKIE, encryptSecret(JSON.stringify(personas)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getPendingPersonas(): Promise<EaPersonaOption[]> {
  const jar = await cookies();
  const raw = jar.get(PERSONAS_COOKIE)?.value;
  if (!raw) return [];
  try {
    return JSON.parse(decryptSecret(raw)) as EaPersonaOption[];
  } catch {
    return [];
  }
}

export async function setPendingEaTokens(tokens: EaTokens) {
  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    encryptSecret(
      JSON.stringify({
        ...tokens,
        expiresAt: tokens.expiresAt?.toISOString(),
      }),
    ),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    },
  );
}

export async function getPendingEaTokens(): Promise<EaTokens | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decryptSecret(raw)) as EaTokens & {
      expiresAt?: string;
    };
    return {
      ...parsed,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
    };
  } catch {
    return null;
  }
}

export async function setPendingLeagues(leagues: PendingEaLeague[]) {
  const jar = await cookies();
  jar.set(LEAGUES_COOKIE, encryptSecret(JSON.stringify(leagues)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getPendingLeagues(): Promise<PendingEaLeague[]> {
  const jar = await cookies();
  const raw = jar.get(LEAGUES_COOKIE)?.value;
  if (!raw) return [];
  try {
    return JSON.parse(decryptSecret(raw)) as PendingEaLeague[];
  } catch {
    return [];
  }
}

export async function clearPendingEaCookies() {
  const jar = await cookies();
  jar.delete(TEMP_COOKIE);
  jar.delete(SESSION_COOKIE);
  jar.delete(PERSONAS_COOKIE);
  jar.delete(LEAGUES_COOKIE);
}
