import "server-only";

import { Agent, fetch as undiciFetch, type RequestInit } from "undici";
import { constants } from "crypto";
import { ANDROID_UA } from "./constants";

/**
 * EA Blaze still requires legacy SSL options that default Node rejects.
 * Only used for wal2.tools.gos.bio-iad.ea.com Blaze hosts.
 *
 * Marked `server-only` and listed in `serverExternalPackages` so Next/Turbopack
 * never evaluate undici in the browser (which throws `.bind` of undefined).
 */
const blazeDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
    secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
  },
});

export const eaFormHeaders = {
  "Accept-Charset": "UTF-8",
  "User-Agent": ANDROID_UA,
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Accept-Encoding": "gzip",
} as const;

export async function eaFetch(
  url: string,
  init: RequestInit & { blaze?: boolean } = {},
) {
  const { blaze, ...rest } = init;
  return undiciFetch(url, {
    ...rest,
    dispatcher: blaze ? blazeDispatcher : undefined,
  });
}

/** Strip control characters that sometimes appear in Blaze export payloads. */
export function sanitizeJsonText(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}
