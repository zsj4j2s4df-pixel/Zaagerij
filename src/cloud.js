export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch("/api/" + path, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof Blob)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw Error("Geen verbinding. Je lokale werk blijft behouden.");
  }
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw Error("Log opnieuw in via Cloudflare Access.");
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "Centrale aanvraag mislukt.");
  return data;
}
export async function sessionInfo() {
  try {
    return await api("session");
  } catch {
    return null;
  }
}
export function login() {
  location.assign("/api/login");
}
export function logout() {
  location.assign("/cdn-cgi/access/logout");
}
export async function publish(document, baseVersion = 0) {
  return (
    await api("projects/" + document.id, {
      method: "PUT",
      body: JSON.stringify({ document, baseVersion }),
    })
  ).version;
}
export async function fetchVersion(id) {
  return api("projects/" + id);
}
export async function listCentral() {
  return (await api("projects")).projects;
}
export async function syncProgress(doc) {
  const events = doc.events
    .filter((e) => e.kind === "good")
    .map((e) => ({
      ...e,
      signature: JSON.stringify(
        doc.pieces.find((p) => e.unit.startsWith(p.id + ":")),
      ),
    }));
  return (
    await api("projects/" + doc.id + "/progress", {
      method: "POST",
      body: JSON.stringify({ events, version: doc.cloudVersion }),
    })
  ).events;
}
export async function uploadFile(projectId, attachment, file) {
  return api(
    "projects/" +
      projectId +
      "/files?id=" +
      encodeURIComponent(attachment.id) +
      "&name=" +
      encodeURIComponent(attachment.name),
    {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    },
  );
}
export async function downloadFile(projectId, id) {
  const r = await fetch(
    "/api/projects/" + projectId + "/files?id=" + encodeURIComponent(id),
  );
  if (!r.ok || r.redirected)
    throw Error(
      "Bijlage niet beschikbaar. Log in of synchroniseer het oorspronkelijke apparaat.",
    );
  return r.blob();
}
