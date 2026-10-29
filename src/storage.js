import { uid } from "./engine";
const KEY = "zaagerij:v2:projects";
export function fresh() {
  const id = uid();
  return {
    id: uid(),
    name: "Nieuwe zaaglijst",
    order: "",
    revision: 1,
    priority: "time",
    startAngle: 90,
    useRemnants: true,
    profiles: [
      {
        id,
        name: "Aluminium koker 60 × 40 × 3",
        width: 60,
        kerf: 3,
        stocks: [6000],
        allowFlip: true,
      },
    ],
    pieces: [],
    remnants: [],
    events: [],
    attachments: [],
    savedAt: null,
  };
}
export function demo() {
  let d = fresh(),
    p = d.profiles[0].id;
  return {
    ...d,
    name: "Entreeframe · Limmen",
    order: "VDV-2026-014",
    pieces: [
      {
        id: uid(),
        code: "A01",
        profileId: p,
        length: 1200,
        qty: 4,
        left: 45,
        right: 45,
        basis: "long",
      },
      {
        id: uid(),
        code: "A02",
        profileId: p,
        length: 850,
        qty: 2,
        left: 90,
        right: 45,
        basis: "long",
      },
      {
        id: uid(),
        code: "A03",
        profileId: p,
        length: 600,
        qty: 6,
        left: 90,
        right: 90,
        basis: "long",
      },
    ],
  };
}
export function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function save(doc) {
  let saved = { ...doc, savedAt: Date.now() };
  let all = loadAll();
  localStorage.setItem(
    KEY,
    JSON.stringify([saved, ...all.filter((d) => d.id !== doc.id)]),
  );
  return saved;
}
export function remove(id) {
  localStorage.setItem(
    KEY,
    JSON.stringify(loadAll().filter((d) => d.id !== id)),
  );
}
export function convert(old) {
  if (old.pieces?.some((p) => "left" in p))
    return { ...fresh(), ...old, id: uid(), savedAt: null };
  const d = fresh(),
    profiles = (old.profiles || d.profiles).map((p) => ({
      ...p,
      name: p.name || "Profiel",
      allowFlip: false,
      stocks: [old.stockLen || 6000],
      kerf: old.kerf ?? 3,
    }));
  return {
    ...d,
    name:
      old.meta?.omschrijving || old.meta?.tekenNr || "Geïmporteerde zaaglijst",
    profiles,
    pieces: (old.pieces || [])
      .filter((p) => +p.length > 0)
      .map((p, i) => ({
        ...p,
        id: uid(),
        code: `S${i + 1}`,
        left: +p.a1 || 90,
        right: +p.a2 || 90,
        basis: "long",
        profileId: p.profileId || profiles[0].id,
      })),
    remnants: (old.remnants || []).map((r) => ({ ...r, endAngle: 90 })),
    events: [],
  };
}
export function legacy() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("doc:"))
      try {
        out.push(convert(JSON.parse(localStorage.getItem(k))));
      } catch {}
  }
  return out;
}
const DB = "zaagerij-files";
async function db() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function filePut(id, file) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("files", "readwrite");
    t.objectStore("files").put(file, id);
    t.oncomplete = () => {
      d.close();
      resolve();
    };
    t.onerror = () => reject(t.error);
  });
}
export async function fileGet(id) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("files").objectStore("files").get(id);
    r.onsuccess = () => {
      d.close();
      resolve(r.result);
    };
    r.onerror = () => reject(r.error);
  });
}
