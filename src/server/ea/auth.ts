import {
  AUTH_SOURCE,
  CLIENT_ID,
  CLIENT_SECRET,
  ENTITLEMENT_TO_CONSOLE,
  ENTITLEMENT_TO_NAMESPACE,
  REDIRECT_URL,
  VALID_ENTITLEMENTS,
  type EaNamespace,
  type EaSystemConsole,
} from "./constants";
import { eaFetch, eaFormHeaders } from "./http";
import { extractAuthCode } from "./parse";

export type EaAccountToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
};

export type EaPersonaOption = {
  personaId: string;
  displayName: string;
  namespace: EaNamespace;
  console: EaSystemConsole;
  entitlement: string;
  pidUri: string;
};

export type EaSessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  console: EaSystemConsole;
  personaId: string;
  blazeId?: string;
};

type TokenInfoResponse = { pid_id?: string; user_id?: string };
type Entitlement = {
  entitlementTag?: string;
  groupName?: string;
  pidUri?: string;
  status?: string;
};
type Persona = {
  personaId?: number;
  displayName?: string;
  name?: string;
  namespaceName?: EaNamespace;
  status?: string;
};

async function exchangeCode(code: string): Promise<EaAccountToken> {
  const body = new URLSearchParams({
    authentication_source: String(AUTH_SOURCE),
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URL,
    release_type: "prod",
    client_id: CLIENT_ID,
  });

  const res = await eaFetch("https://accounts.ea.com/connect/token", {
    method: "POST",
    headers: eaFormHeaders,
    body: body.toString(),
  });
  const json = (await res.json()) as EaAccountToken & { error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`EA token exchange failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function exchangePersonaCode(code: string): Promise<EaAccountToken> {
  const body = new URLSearchParams({
    authentication_source: String(AUTH_SOURCE),
    code,
    grant_type: "authorization_code",
    token_format: "JWS",
    release_type: "prod",
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URL,
    client_id: CLIENT_ID,
  });

  const res = await eaFetch("https://accounts.ea.com/connect/token", {
    method: "POST",
    headers: eaFormHeaders,
    body: body.toString(),
  });
  const json = (await res.json()) as EaAccountToken & { error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`EA persona token exchange failed: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function refreshAccountToken(refreshToken: string): Promise<EaAccountToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    release_type: "prod",
    refresh_token: refreshToken,
    authentication_source: String(AUTH_SOURCE),
    token_format: "JWS",
  });

  const res = await eaFetch("https://accounts.ea.com/connect/token", {
    method: "POST",
    headers: eaFormHeaders,
    body: body.toString(),
  });
  const json = (await res.json()) as EaAccountToken & { error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`EA token refresh failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function getPidId(accessToken: string): Promise<string> {
  const res = await eaFetch(
    `https://accounts.ea.com/connect/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    {
      headers: {
        "Accept-Charset": "UTF-8",
        "X-Include-Deviceid": "true",
        "User-Agent": eaFormHeaders["User-Agent"],
        "Accept-Encoding": "gzip",
      },
    },
  );
  const json = (await res.json()) as TokenInfoResponse;
  const pid = json.pid_id ?? json.user_id;
  if (!pid) {
    throw new Error(`EA tokeninfo missing pid_id: ${JSON.stringify(json)}`);
  }
  return String(pid);
}

async function getEntitlements(accessToken: string, pidId: string): Promise<Entitlement[]> {
  const res = await eaFetch(
    `https://gateway.ea.com/proxy/identity/pids/${pidId}/entitlements/?status=ACTIVE`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": eaFormHeaders["User-Agent"],
        "Accept-Charset": "UTF-8",
        "X-Expand-Results": "true",
        "Accept-Encoding": "gzip",
      },
    },
  );
  const json = (await res.json()) as {
    entitlements?: { entitlement?: Entitlement | Entitlement[] };
  };
  const raw = json.entitlements?.entitlement;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function getPersonasForUri(
  accessToken: string,
  pidUri: string,
): Promise<Persona[]> {
  const res = await eaFetch(
    `https://gateway.ea.com/proxy/identity${pidUri}/personas?status=ACTIVE&access_token=${encodeURIComponent(accessToken)}`,
    {
      headers: {
        "Accept-Charset": "UTF-8",
        "X-Expand-Results": "true",
        "User-Agent": eaFormHeaders["User-Agent"],
        "Accept-Encoding": "gzip",
      },
    },
  );
  const json = (await res.json()) as { personas?: { persona?: Persona | Persona[] } };
  const raw = json.personas?.persona;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export async function listPersonasFromCallback(
  callbackUrl: string,
): Promise<{ tempAccessToken: string; tempRefreshToken: string; personas: EaPersonaOption[] }> {
  const code = extractAuthCode(callbackUrl);
  const token = await exchangeCode(code);
  const pidId = await getPidId(token.access_token);
  const entitlements = await getEntitlements(token.access_token, pidId);
  const validGroupNames = new Set(Object.values(VALID_ENTITLEMENTS));

  const personas: EaPersonaOption[] = [];
  for (const entitlement of entitlements) {
    if (entitlement.entitlementTag !== "ONLINE_ACCESS") continue;
    if (!entitlement.groupName || !validGroupNames.has(entitlement.groupName)) continue;
    if (!entitlement.pidUri) continue;

    const console = ENTITLEMENT_TO_CONSOLE[entitlement.groupName];
    const expectedNamespace = ENTITLEMENT_TO_NAMESPACE[entitlement.groupName];
    if (!console || !expectedNamespace) continue;

    const personaList = await getPersonasForUri(token.access_token, entitlement.pidUri);
    for (const persona of personaList) {
      if (!persona.personaId || persona.namespaceName !== expectedNamespace) continue;
      personas.push({
        personaId: String(persona.personaId),
        displayName: persona.displayName ?? persona.name ?? String(persona.personaId),
        namespace: expectedNamespace,
        console,
        entitlement: entitlement.groupName,
        pidUri: entitlement.pidUri,
      });
    }
  }

  if (personas.length === 0) {
    throw new Error(
      "No active Madden personas found for this EA account. Confirm the companion entitlements for the configured Madden year.",
    );
  }

  return {
    tempAccessToken: token.access_token,
    tempRefreshToken: token.refresh_token,
    personas,
  };
}

export async function exchangePersonaTokens(input: {
  tempAccessToken: string;
  persona: EaPersonaOption;
}): Promise<EaSessionTokens> {
  const params = new URLSearchParams({
    hide_create: "true",
    release_type: "prod",
    response_type: "code",
    redirect_uri: REDIRECT_URL,
    client_id: CLIENT_ID,
    machineProfileKey: process.env.EA_MACHINE_KEY ?? "444d362e8e067fe2",
    authentication_source: String(AUTH_SOURCE),
    access_token: input.tempAccessToken,
    persona_id: input.persona.personaId,
    persona_namespace: input.persona.namespace,
  });

  const res = await eaFetch(`https://accounts.ea.com/connect/auth?${params.toString()}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent": eaFormHeaders["User-Agent"],
      "Accept-Charset": "UTF-8",
    },
  });

  const location = res.headers.get("location") ?? "";
  if (!location) {
    throw new Error("EA persona auth did not return a redirect with a code");
  }

  const personaCode = extractAuthCode(location);
  const personaToken = await exchangePersonaCode(personaCode);

  return {
    accessToken: personaToken.access_token,
    refreshToken: personaToken.refresh_token,
    expiresAt: new Date(Date.now() + personaToken.expires_in * 1000),
    console: input.persona.console,
    personaId: input.persona.personaId,
  };
}
