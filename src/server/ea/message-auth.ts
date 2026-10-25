import { createHash, randomBytes } from "crypto";

export type MessageAuth = {
  authData: string;
  authCode: string;
  authType: number;
};

/**
 * Blaze request signing (Companion App MessageAuth).
 * Documented in Snallabot ea_api.md (MIT).
 */
export function calculateMessageAuth(
  blazeId: number,
  requestId: number,
  randomFourBytes: Buffer = randomBytes(4),
): MessageAuth {
  const requestData = JSON.stringify({
    staticData: "05e6a7ead5584ab4",
    requestId,
    blazeId,
  });
  const staticBytes = Buffer.from("634203362017bf72f70ba900c0aa4e6b", "hex");
  const xorHash = createHash("md5").update(randomFourBytes).update(staticBytes).digest();
  const requestBuffer = Buffer.from(requestData, "utf-8");
  const scrambledBytes = Buffer.from(
    requestBuffer.map((byte, index) => byte ^ xorHash[index % 16]!),
  );
  const authDataBytes = Buffer.concat([randomFourBytes, scrambledBytes]);
  const staticAuthCode = Buffer.from("3a53413521464c3b6531326530705b70203a2900", "hex");
  const authCode = createHash("md5")
    .update(staticAuthCode)
    .update(authDataBytes)
    .digest("base64");

  return {
    authData: authDataBytes.toString("base64"),
    authCode,
    authType: 17039361,
  };
}
