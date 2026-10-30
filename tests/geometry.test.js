import { test } from "node:test";
import assert from "node:assert/strict";
import { plan, verify } from "../src/engine.js";
import { calculate } from "../src/expression.js";
const doc = () => ({
  combine: true,
  useRemnants: false,
  priority: "time",
  profiles: [
    {
      id: "p",
      name: "Koker",
      width: 60,
      kerf: 3,
      stocks: [6000],
      allowFlip: true,
    },
  ],
  pieces: [
    {
      id: "a",
      code: "001",
      profileId: "p",
      length: 1000,
      qty: 2,
      left: 45,
      right: 45,
      basis: "long",
    },
  ],
  events: [],
  remnants: [],
});
test("45 degree nesting uses alternate real orientation and one shared plane", () => {
  const d = doc(),
    p = plan(d);
  assert.equal(p.sharedCuts, 1);
  assert.equal(p.steps.length, 3);
  assert.deepEqual(
    p.bars[0].items.map((i) => i.flipped),
    [false, true],
  );
  assert.ok(
    Math.abs(p.bars[0].used - (2000 - 60 + (3 * 3) / Math.sin(Math.PI / 4))) <
      1e-6,
  );
  assert.equal(p.check.ok, true);
  const cut = p.steps.find((s) => s.shared);
  assert.equal(cut.ends.length, 2);
  assert.equal(cut.ends[0].end, "links");
  assert.equal(cut.ends[1].end, "rechts");
});
test("disallowing roll prevents false 45 degree matching", () => {
  const d = doc();
  d.profiles[0].allowFlip = false;
  const p = plan(d);
  assert.equal(p.sharedCuts, 0);
  assert.equal(p.steps.length, 4);
  assert.equal(
    p.steps.some((s) => s.flip),
    false,
  );
  assert.equal(
    p.steps.some((s) => s.reverseRequired),
    true,
  );
});
test("different angles do not share just because both are slanted", () => {
  const d = doc();
  d.pieces.push({
    ...d.pieces[0],
    id: "b",
    code: "002",
    qty: 1,
    left: 60,
    right: 90,
  });
  const p = plan(d);
  for (const cut of p.steps.filter((s) => s.shared)) {
    const a = d.pieces.find((p) => cut.ends[0].unit.startsWith(p.id + ":")),
      b = d.pieces.find((p) => cut.ends[1].unit.startsWith(p.id + ":"));
    assert.equal(a.right, b.left);
  }
});
test("verification catches claimed common planes displaced at one side", () => {
  const d = doc(),
    p = plan(d);
  p.bars[0].items[1].start += 5;
  p.bars[0].used += 5;
  assert.equal(verify(d, p.bars).ok, false);
});
test("short pieces with crossing cut faces are rejected", () => {
  const d = doc();
  d.pieces[0].length = 20;
  assert.ok(plan(d).errors.some((e) => e.includes("te kort")));
});
test("disabled remnants are never used", () => {
  const d = doc();
  d.remnants = [{ id: "r", profileId: "p", length: 5000 }];
  assert.equal(
    plan(d).bars.some((b) => b.source === "rest"),
    false,
  );
});
test("obtuse and acute shared faces match physical slopes without assuming a roll", () => {
  const d = doc();
  d.startAngle = 45;
  d.profiles[0].allowFlip = false;
  d.pieces[0].qty = 1;
  d.pieces.push({ ...d.pieces[0], id: "b", code: "002", left: 135, right: 90 });
  const p = plan(d);
  assert.equal(p.sharedCuts, 1);
  assert.equal(p.check.ok, true);
});
test("arithmetic supports brackets, comma and unary operators without execution", () => {
  assert.equal(calculate("180 - 105"), 75);
  assert.equal(calculate("90 ÷ 2"), 45);
  assert.equal(calculate("-(2+3)×4"), -20);
  assert.equal(calculate("1,5+2"), 3.5);
  assert.equal(calculate("1/0"), null);
  assert.equal(calculate("alert(1)"), null);
});

test("planar combinations remain consistent across acute, square and obtuse inputs", () => {
  for (const left of [15, 30, 45, 60, 90, 120, 135, 150, 165])
    for (const right of [15, 30, 45, 60, 90, 120, 135, 150, 165])
      for (const allowFlip of [false, true]) {
        const d = doc();
        d.profiles[0].allowFlip = allowFlip;
        d.pieces[0] = { ...d.pieces[0], left, right, length: 1000, qty: 8 };
        const p = plan(d);
        assert.equal(p.errors.length, 0);
        assert.equal(
          p.check.ok,
          true,
          `geometry ${left}/${right}, flip ${allowFlip}`,
        );
        assert.equal(p.steps.length, p.total * 2 - p.sharedCuts);
        assert.ok(p.bars.every((b) => b.used <= b.capacity + 1e-6));
      }
});

test("right-hand stop processes stock from the right and prepares the right end first", () => {
  const d = doc(),
    p = plan(d);
  for (const bar of p.bars) {
    const steps = p.steps.filter((s) => s.barId === bar.id);
    assert.equal(steps[0].unit, bar.items.at(-1).unit);
    assert.equal(steps[0].end, "rechts");
    assert.equal(steps.at(-1).end, "links");
    assert.equal(steps.find((s) => s.shared).ends[0].end, "links");
  }
});
