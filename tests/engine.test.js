import { test } from "node:test";
import assert from "node:assert/strict";
import {
  plan,
  verify,
  remaining,
  recordGood,
  machineAngle,
  longLength,
  validate,
} from "../src/engine.js";
const base = () => ({
  profiles: [
    {
      id: "p",
      name: "Koker",
      width: 60,
      stocks: [6000],
      kerf: 3,
      allowFlip: true,
    },
  ],
  pieces: [
    {
      id: "a",
      code: "A",
      profileId: "p",
      length: 1200,
      qty: 4,
      left: 90,
      right: 90,
      basis: "long",
    },
  ],
  events: [],
  remnants: [],
  priority: "time",
  startAngle: 90,
});
test("includes final separating cut and accounts for every piece", () => {
  const d = base(),
    p = plan(d);
  assert.equal(p.bars.length, 1);
  assert.equal(p.bars[0].used, 4824);
  assert.equal(p.check.ok, true);
});
test("piece fitting nominally but not including saw blade is rejected", () => {
  const d = base();
  d.pieces[0].length = 6000;
  const p = plan(d);
  assert.equal(p.unplaced.length, 4);
  assert.equal(p.bars.length, 0);
});
test("independent verification rejects duplicate identities and overflow", () => {
  const d = base(),
    p = plan(d);
  p.bars[0].items[1].unit = p.bars[0].items[0].unit;
  assert.equal(verify(d, p.bars).ok, false);
  p.bars[0].capacity = 100;
  assert.equal(verify(d, p.bars).ok, false);
});
test("good completion leaves ordered quantities unchanged and prevents double count", () => {
  const d = base(),
    e = recordGood(d, "a:0");
  assert.equal(e.pieces[0].qty, 4);
  assert.equal(remaining(e).length, 3);
  assert.throws(() => recordGood(e, "a:0"));
  assert.equal(plan(e).total, 3);
});
test("drawing angle and long point conversion", () => {
  assert.equal(machineAngle(90), 0);
  assert.equal(machineAngle(60), 30);
  assert.ok(
    Math.abs(
      longLength(
        { length: 1000, left: 45, right: 45, basis: "short" },
        { width: 60 },
      ) - 1120,
    ) < 0.001,
  );
});
test("untrusted huge quantities and nonfinite dimensions rejected", () => {
  const d = base();
  d.pieces[0].qty = 1e8;
  assert.ok(validate(d).length);
  d.pieces[0].qty = 4;
  d.pieces[0].length = Infinity;
  assert.ok(validate(d).length);
});
test("separate profiles never share a bar", () => {
  const d = base();
  d.profiles.push({ ...d.profiles[0], id: "b" });
  d.pieces.push({ ...d.pieces[0], id: "b", profileId: "b" });
  assert.equal(plan(d).bars.length, 2);
});
test("usable remnants have priority and measured angle trim is included", () => {
  const d = base();
  d.remnants = [{ id: "r", profileId: "p", length: 2500, endAngle: 45 }];
  d.useRemnants = true;
  const p = plan(d);
  assert.equal(p.bars[0].source, "rest");
  assert.equal(p.bars[0].used, 2415);
  assert.equal(p.check.ok, true);
});

test("time scheduling respects physical order within each bar", () => {
  const d = base();
  d.pieces.push({ ...d.pieces[0], id: "b", left: 45, right: 90 });
  const p = plan(d);
  for (const b of p.bars) {
    const order = p.steps.filter((s) => s.barId === b.id);
    assert.deepEqual(
      order.map((s) => s.id),
      b.items.flatMap((x) => [x.unit + ":links", x.unit + ":rechts"]),
    );
  }
});
