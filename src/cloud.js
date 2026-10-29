import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud = url && key ? createClient(url, key) : null;
export async function publish(doc, baseVersion) {
  if (!cloud) throw Error("Centrale opslag is nog niet gekoppeld.");
  const { data, error } = await cloud.rpc("zaagerij_publish", {
    p_id: doc.id,
    p_document: doc,
    p_base: baseVersion ?? 0,
  });
  if (error) throw error;
  return data;
}
export async function fetchVersion(id) {
  if (!cloud) throw Error("Log in om een gedeelde lijst te openen.");
  const { data, error } = await cloud
    .from("zaagerij_projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
export async function syncProgress(doc) {
  if (!cloud) throw Error("Centrale opslag is nog niet gekoppeld.");
  const {
    data: { user },
  } = await cloud.auth.getUser();
  if (!user) throw Error("Log eerst in.");
  const rows = doc.events
    .filter((e) => e.kind === "good")
    .map((e) => ({
      project_id: doc.id,
      unit: e.unit,
      event: {
        ...e,
        signature: JSON.stringify(
          doc.pieces.find((p) => e.unit.startsWith(p.id + ":")),
        ),
      },
      user_id: user.id,
    }));
  if (rows.length) {
    const { error } = await cloud
      .from("zaagerij_progress")
      .upsert(rows, { onConflict: "project_id,unit", ignoreDuplicates: true });
    if (error) throw error;
  }
  const { data, error } = await cloud
    .from("zaagerij_progress")
    .select("event")
    .eq("project_id", doc.id);
  if (error) throw error;
  return data.map((r) => r.event);
}
