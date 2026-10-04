import { SignJWT } from "jose";

let cached: { token: string; expiresAt: number } | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required on the Next.js server.`);
  }
  return value;
}

export async function getServiceToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 30 > now) {
    return cached.token;
  }

  const secret = new TextEncoder().encode(required("SERVICE_SIGNING_KEY"));
  const lifetime = 240;
  const token = await new SignJWT({ token_use: "service" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(process.env.SERVICE_TOKEN_ISSUER || "storefront")
    .setAudience(process.env.SERVICE_TOKEN_AUDIENCE || "sortd-api")
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + lifetime)
    .sign(secret);

  cached = { token, expiresAt: now + lifetime };
  return token;
}
