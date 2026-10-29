import { json } from "../../../_lib/security.js";
export async function onRequestPut({ request, env, params }) {
  if (!env.FILES)
    return json(
      {
        error:
          "Centrale bestandsopslag is nog niet geactiveerd. Je bijlage blijft lokaal beschikbaar.",
      },
      503,
    );
  const row = await env.DB.prepare("SELECT id FROM projects WHERE id=?")
    .bind(params.id)
    .first();
  if (!row) return json({ error: "Publiceer eerst de zaaglijst." }, 404);
  const url = new URL(request.url),
    id = url.searchParams.get("id"),
    name = url.searchParams.get("name") || "bestand",
    size = Number(request.headers.get("Content-Length"));
  if (
    !id ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 15000000
  )
    return json({ error: "Ongeldig bestand of maximaal 15 MB." }, 400);
  const key = params.id + "/" + id;
  const chunks = [];
  let count = 0;
  const reader = request.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    count += value.length;
    if (count > 15000000) {
      await reader.cancel();
      return json({ error: "Maximaal 15 MB." }, 413);
    }
    chunks.push(value);
  }
  const blob = new Blob(chunks);
  const type =
    request.headers.get("Content-Type") || "application/octet-stream";
  await env.FILES.put(key, blob.stream(), {
    httpMetadata: { contentType: type },
  });
  await env.DB.prepare(
    "INSERT INTO attachments(project_id,id,object_key,name,type,size) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,id) DO UPDATE SET name=excluded.name,type=excluded.type,size=excluded.size",
  )
    .bind(params.id, id, key, name.slice(0, 200), type, count)
    .run();
  return json({ ok: true });
}
export async function onRequestGet({ request, env, params }) {
  if (!env.FILES) return json({ error: "Bestandsopslag niet actief." }, 503);
  const id = new URL(request.url).searchParams.get("id");
  const meta = await env.DB.prepare(
    "SELECT * FROM attachments WHERE project_id=? AND id=?",
  )
    .bind(params.id, id)
    .first();
  if (!meta)
    return json({ error: "Bijlage is nog niet centraal opgeslagen." }, 404);
  const object = await env.FILES.get(meta.object_key);
  if (!object) return json({ error: "Bijlage ontbreekt." }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": meta.type,
      "Content-Disposition":
        "attachment; filename*=UTF-8''" + encodeURIComponent(meta.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
