import { test } from "node:test";
import assert from "node:assert/strict";
import { jointAngles, resolveDrawingAngles } from "../src/jointAngles.js";
test("same joint expressed as inside angle or turn yields machine 22.5", () => {
  for (const input of [
    { kind: "inside", angle: 135 },
    { kind: "turn", angle: 45 },
  ])
    assert.deepEqual(jointAngles({ ...input, symmetric: true }), {
      drawing: 67.5,
      machine: 22.5,
    });
});
test("square butt cuts differ from equal miters at a square joint", () => {
  assert.deepEqual(jointAngles({ kind: "cut", angle: 90 }), {
    drawing: 90,
    machine: 0,
  });
  assert.deepEqual(
    jointAngles({ kind: "inside", angle: 90, symmetric: true }),
    { drawing: 45, machine: 45 },
  );
  assert.equal(
    jointAngles({ kind: "inside", angle: 90, symmetric: false }),
    null,
  );
  assert.equal(
    jointAngles({ kind: "unknown", angle: 45, symmetric: true }),
    null,
  );
  assert.equal(
    jointAngles({ kind: "turn", angle: null, symmetric: true }),
    null,
  );
});
test("server replaces model arithmetic and clears uncertain end", () => {
  const p = resolveDrawingAngles({
    pieces: [
      {
        left: 45,
        right: 45,
        joints: {
          left: { kind: "turn", angle: 45, symmetric: true },
          right: { kind: "unknown", angle: null },
        },
        sources: { left: { status: "stated" }, right: { status: "stated" } },
      },
    ],
  }).pieces[0];
  assert.equal(p.left, 67.5);
  assert.equal(p.right, null);
  assert.equal(p.sources.left.status, "inferred");
  assert.equal(p.sources.right.status, "missing");
});
