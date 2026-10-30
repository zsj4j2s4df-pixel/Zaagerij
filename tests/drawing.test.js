import { test } from "node:test";
import assert from "node:assert/strict";
import { completeDrawingRow, validateDrawingResult } from "../src/drawing.js";
import { onRequestPost } from "../functions/api/recognize.js";
const row = () => ({
  code: "001",
  length: 500,
  qty: null,
  left: 90,
  right: 45,
  basis: "long",
  profileName: "Koker",
  material: "Aluminium",
  note: "Aantal ontbreekt.",
  sources: Object.fromEntries(
    ["length", "qty", "left", "right"].map((k) => [
      k,
      {
        status: k === "qty" ? "missing" : "stated",
        file: 1,
        page: 1,
        text: k === "qty" ? null : "500",
        bbox: null,
      },
    ]),
  ),
});
test("missing count stays incomplete; selecting a profile alone is not enough", () => {
  const r = row(),
    profiles = [{ id: "p" }];
  assert.equal(
    validateDrawingResult({ complete: true, warnings: [], pieces: [r] }),
    true,
  );
  assert.equal(completeDrawingRow({ ...r, profileId: "p" }, profiles), false);
  assert.equal(
    completeDrawingRow({ ...r, qty: 2, profileId: "p" }, profiles),
    true,
  );
  assert.equal(
    completeDrawingRow(
      { ...r, qty: 2, profileId: "p", basis: "unknown" },
      profiles,
    ),
    false,
  );
});
test("invalid bounding boxes and invented numbers marked missing are rejected", () => {
  const r = row();
  r.sources.length.bbox = [0.8, 0.1, 0.2, 0.9];
  assert.equal(
    validateDrawingResult({ complete: true, warnings: [], pieces: [r] }),
    false,
  );
  r.sources.length.bbox = null;
  r.qty = 1;
  assert.equal(
    validateDrawingResult({ complete: true, warnings: [], pieces: [r] }),
    false,
  );
});
test("recognition forwards separate drawing and BOM and returns evidence without real provider calls", async (t) => {
  let requestBody;
  const result = { complete: true, warnings: [], pieces: [row()] };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requestBody = JSON.parse(options.body);
    return Response.json({
      output: [
        { content: [{ type: "output_text", text: JSON.stringify(result) }] },
      ],
    });
  });
  const file = {
    name: "drawing.png",
    type: "image/png",
    data: "data:image/png;base64," + "a".repeat(80),
  };
  const response = await onRequestPost({
    request: new Request("https://app.test/api/recognize", {
      method: "POST",
      headers: { Origin: "https://app.test" },
      body: JSON.stringify({ ...file, support: { ...file, name: "BOM.png" } }),
    }),
    env: {
      OPENAI_API_KEY: "test-value-not-a-real-key",
      DB: {
        prepare() {
          return {
            bind() {
              return {
                async first() {
                  return { used: 1 };
                },
              };
            },
          };
        },
      },
    },
    data: { user: { email: "test@example.com" } },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).pieces[0].qty, null);
  assert.equal(
    requestBody.input[0].content.filter((x) => x.type === "input_image").length,
    2,
  );
  assert.match(requestBody.instructions, /chamfer/);
});
