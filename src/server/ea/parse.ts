/**
 * Extract the OAuth `code` from an EA redirect URL (or a bare code string).
 * Accepts values with or without the `http://` scheme (Safari often drops it).
 */
export function extractAuthCode(callbackUrlOrCode: string): string {
  const raw = callbackUrlOrCode.trim();
  if (!raw) {
    throw new Error("EA callback URL is empty");
  }

  if (!raw.includes("://") && !raw.includes("?") && !raw.includes("code=")) {
    return raw;
  }

  const normalized = raw.includes("://") ? raw : `http://${raw}`;
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Could not parse EA callback URL");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    throw new Error("EA callback URL is missing code=");
  }
  return code;
}
