import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { onRequestPut, onRequestGet } from "../functions/api/projects/[id].js";
import { onRequestPost } from "../functions/api/projects/[id]/progress.js";
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    readFileSync(
      new URL("../migrations/0001_zaagerij.sql", import.meta.url),
      "utf8",
    ),
  );
  const DB = {
    prepare(sql) {
      return {
        bind(...args) {
          const q = db.prepare(sql);
          return {
            async first() {
              return q.get(...args) || null;
            },
            async all() {
              return { results: q.all(...args) };
            },
            async run() {
              return q.run(...args);
            },
          };
        },
      };
    },
    async batch(stmts) {
      db.exec("BEGIN");
      try {
        const out = await Promise.all(stmts.map((s) => s.run()));
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, DB };
}
const document = () => ({
  id: "project",
  name: "Proef",
  profiles: [
    { id: "p", name: "Aluminium", stocks: [6000], kerf: 3, width: 40 },
  ],
  pieces: [
    {
      id: "s",
      code: "S",
      profileId: "p",
      length: 500,
      qty: 2,
      left: 90,
      right: 90,
      basis: "long",
    },
  ],
  events: [],
  attachments: [],
  remnants: [],
});
function request(body) {
  return new Request("https://app.test/api/projects/project", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
test("publish is atomic, retains revision history and refuses stale overwrites", async () => {
  const { db, DB } = fixture(),
    env = { DB },
    data = { user: { email: "office@test.nl", role: "office" } },
    params = { id: "project" };
  const doc = document();
  const first = await onRequestPut({
    request: request({ document: doc, baseVersion: 0 }),
    env,
    data,
    params,
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).version, 1);
  const stale = await onRequestPut({
    request: request({ document: { ...doc, name: "Stale" }, baseVersion: 0 }),
    env,
    data,
    params,
  });
  assert.equal(stale.status, 409);
  const next = await onRequestPut({
    request: request({ document: { ...doc, name: "Nieuw" }, baseVersion: 1 }),
    env,
    data,
    params,
  });
  assert.equal(next.status, 200);
  assert.equal(db.prepare("select count(*) as n from versions").get().n, 2);
  const row = await onRequestGet({ env, params });
  assert.equal((await row.json()).document.name, "Nieuw");
  db.close();
});
test("workshop cannot publish and duplicate completion cannot inflate counts", async () => {
  const { db, DB } = fixture(),
    env = { DB },
    params = { id: "project" },
    doc = document();
  const denied = await onRequestPut({
    request: request({ document: doc, baseVersion: 0 }),
    env,
    params,
    data: { user: { role: "workshop" } },
  });
  assert.equal(denied.status, 403);
  await onRequestPut({
    request: request({ document: doc, baseVersion: 0 }),
    env,
    params,
    data: { user: { role: "office" } },
  });
  const body = {
    version: 1,
    events: [
      { kind: "good", unit: "s:0", signature: JSON.stringify(doc.pieces[0]) },
    ],
  };
  for (let i = 0; i < 2; i++) {
    const r = await onRequestPost({
      request: request(body),
      env,
      params,
      data: { user: { email: "worker@test.nl" } },
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).events.length, 1);
  }
  const stale = await onRequestPost({
    request: request({ ...body, version: 0 }),
    env,
    params,
    data: { user: { email: "worker@test.nl" } },
  });
  assert.equal(stale.status, 409);
  db.close();
});
