import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/recognize.js";
test("recognition refuses different origin", async () => {
  const r = await onRequestPost({
    request: new Request("https://zaagerij.test/api/recognize", {
      method: "POST",
      headers: { Origin: "https://other.test" },
    }),
    env: {},
  });
  assert.equal(r.status, 403);
});
test("recognition does not pretend to work without configured credentials", async () => {
  const r = await onRequestPost({
    request: new Request("https://zaagerij.test/api/recognize", {
      method: "POST",
      headers: { Origin: "https://zaagerij.test" },
    }),
    env: {},
  });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /niet ingesteld/);
});
