import { createRemoteJWKSet, jwtVerify } from "jose";
export const json = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function identity(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.DB)
    throw Object.assign(
      Error("Centrale opslag wordt ingesteld. Probeer later opnieuw."),
      { status: 503 },
    );
  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("CF_Authorization="))
      ?.slice(17);
  if (!token || token.length > 16384)
    throw Object.assign(Error("Log in via Cloudflare Access."), {
      status: 401,
    });
  try {
    const issuer = "https://" + env.ACCESS_TEAM_DOMAIN;
    const keys = createRemoteJWKSet(new URL(issuer + "/cdn-cgi/access/certs"));
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    if (!payload.email || !payload.sub)
      throw Error("Geen gebruikersidentiteit");
    const member = await env.DB.prepare(
      "SELECT email,role FROM members WHERE email=?",
    )
      .bind(payload.email.toLowerCase())
      .first();
    if (!member)
      throw Object.assign(
        Error("Dit account heeft geen toegang tot Zaagerij."),
        { status: 403 },
      );
    return member;
  } catch (e) {
    if (e.status) throw e;
    throw Object.assign(Error("Sessie ongeldig of verlopen. Log opnieuw in."), {
      status: 401,
    });
  }
}
export function sameOrigin(request) {
  if (new URL(request.url).origin !== request.headers.get("Origin"))
    throw Object.assign(Error("Ongeldige herkomst."), { status: 403 });
}
export async function bodyJson(request, max = 2000000) {
  const reader = request.body?.getReader();
  if (!reader)
    throw Object.assign(Error("Verzoek ontbreekt."), { status: 400 });
  const chunks = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw Object.assign(Error("Verzoek is te groot."), { status: 413 });
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    buffer.set(c, at);
    at += c.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer));
  } catch {
    throw Object.assign(Error("Ongeldige JSON."), { status: 400 });
  }
}
