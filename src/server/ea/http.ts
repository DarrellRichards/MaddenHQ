import "server-only";

import http from "node:http";
import https from "node:https";
import { constants } from "node:crypto";
import { gunzipSync, inflateSync } from "node:zlib";
import { ANDROID_UA } from "./constants";

/**
 * EA HTTP helpers.
 *
 * Blaze hosts still need legacy SSL (`SSL_OP_LEGACY_SERVER_CONNECT`). We use
 * Node's built-in `https` agent for that — the `undici` package breaks under
 * Next/Turbopack (`.bind` of undefined) even when marked external.
 */

export type EaFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer | Uint8Array;
  blaze?: boolean;
  redirect?: RequestRedirect;
};

const blazeAgent = new https.Agent({
  rejectUnauthorized: false,
  secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
  keepAlive: true,
});

export const eaFormHeaders = {
  "Accept-Charset": "UTF-8",
  "User-Agent": ANDROID_UA,
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Accept-Encoding": "gzip",
} as const;

function decodeBody(buffer: Buffer, encoding: string | undefined): Buffer {
  const enc = encoding?.toLowerCase();
  if (enc === "gzip") return gunzipSync(buffer);
  if (enc === "deflate") return inflateSync(buffer);
  return buffer;
}

function nodeRequest(
  url: string,
  init: Omit<EaFetchInit, "blaze">,
  useBlazeTls: boolean,
): Promise<Response> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === "https:";
  const transport = isHttps ? https : http;
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  const body = init.body;

  if (
    body != null &&
    headers["Content-Length"] == null &&
    headers["content-length"] == null
  ) {
    const length =
      typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
    headers["Content-Length"] = String(length);
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        agent: useBlazeTls && isHttps ? blazeAgent : undefined,
        ...(useBlazeTls && isHttps
          ? {
              rejectUnauthorized: false,
              secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT,
            }
          : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          try {
            const raw = Buffer.concat(chunks);
            const decoded = decodeBody(raw, res.headers["content-encoding"]);
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value == null) continue;
              // Body is already decoded; drop encoding so callers can use .text().
              if (key.toLowerCase() === "content-encoding") continue;
              if (key.toLowerCase() === "content-length") continue;
              if (Array.isArray(value)) {
                for (const entry of value) responseHeaders.append(key, entry);
              } else {
                responseHeaders.set(key, value);
              }
            }
            resolve(
              new Response(new Uint8Array(decoded), {
                status: res.statusCode ?? 500,
                statusText: res.statusMessage,
                headers: responseHeaders,
              }),
            );
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on("error", reject);
    if (body != null) {
      req.write(body);
    }
    req.end();
  });
}

export async function eaFetch(
  url: string,
  init: EaFetchInit = {},
): Promise<Response> {
  const { blaze, ...rest } = init;
  if (blaze) {
    return nodeRequest(url, rest, true);
  }

  // EA account / token endpoints work with the platform fetch implementation.
  const body =
    rest.body == null
      ? undefined
      : typeof rest.body === "string"
        ? rest.body
        : new Uint8Array(rest.body);
  return fetch(url, {
    method: rest.method,
    headers: rest.headers,
    body,
    redirect: rest.redirect,
  });
}

/** Strip control characters that sometimes appear in Blaze export payloads. */
export function sanitizeJsonText(text: string): string {
  return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
}
