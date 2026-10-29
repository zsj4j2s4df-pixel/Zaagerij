import { json } from "../_lib/security.js";
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id,name,version,updated_at FROM projects ORDER BY updated_at DESC LIMIT 200",
  ).all();
  return json({ projects: results });
}
