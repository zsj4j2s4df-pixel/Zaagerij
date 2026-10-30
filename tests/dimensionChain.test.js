import { test } from "node:test";
import assert from "node:assert/strict";
import {
  solveDimensionChain,
  resolveDrawingLengths,
} from "../src/dimensionChain.js";
const input = (id, value, unit = "mm") => ({
  id,
  op: "input",
  value,
  unit,
  args: [],
  source: { status: "stated", text: String(value), file: 1, page: 1 },
});
const op = (id, operation, ...args) => ({ id, op: operation, args });
test("dimension chain subtracts the correct measured offsets rather than taking the assembly height", () => {
  const chain = {
    root: "piece",
    nodes: [
      input("height", 1000),
      input("offset", 300),
      op("piece", "subtract", "height", "offset"),
    ],
  };
  assert.equal(solveDimensionChain(chain).length, 700);
});
test("projection uses measured angle in degrees and preserves units", () => {
  const chain = {
    root: "piece",
    nodes: [
      input("dx", 300),
      input("angle", 45, "deg"),
      op("ratio", "cos", "angle"),
      op("piece", "divide", "dx", "ratio"),
    ],
  };
  assert.ok(
    Math.abs(solveDimensionChain(chain).length - Math.sqrt(180000)) < 1e-6,
  );
  chain.nodes[1].unit = "mm";
  assert.equal(solveDimensionChain(chain), null);
});
test("Pythagoras and explicit single lengths are supported", () => {
  assert.equal(
    solveDimensionChain({
      root: "diagonal",
      nodes: [
        input("x", 300),
        input("y", 400),
        op("diagonal", "hypot", "x", "y"),
      ],
    }).length,
    500,
  );
  assert.equal(
    solveDimensionChain({ root: "a", nodes: [input("a", 1000)] }).length,
    1000,
  );
});
test("rejects circular chains, missing evidence, zero denominators and wrong units", () => {
  const bad = [
    { root: "a", nodes: [op("a", "add", "a", "a")] },
    {
      root: "a",
      nodes: [
        {
          ...input("a", 1000),
          source: { status: "inferred", text: "estimated", file: 1 },
        },
      ],
    },
    {
      root: "a",
      nodes: [
        input("x", 1),
        input("zero", 0, "ratio"),
        op("a", "divide", "x", "zero"),
      ],
    },
    {
      root: "a",
      nodes: [input("x", 1), input("y", 30, "deg"), op("a", "add", "x", "y")],
    },
    { root: "missing", nodes: [input("a", 1000)] },
    { root: "a", nodes: [input("a", -1000)] },
  ];
  bad.forEach((c) => assert.equal(solveDimensionChain(c), null));
});
test("server overrides guessed length and leaves missing chains empty", () => {
  const result = resolveDrawingLengths({
    pieces: [
      {
        length: 9999,
        sources: { length: {} },
        lengthCalculation: { root: "a", nodes: [input("a", 1000)] },
      },
      {
        length: 9999,
        sources: { length: {} },
        lengthCalculation: { root: null, nodes: [] },
      },
    ],
  });
  assert.equal(result.pieces[0].length, 1000);
  assert.equal(result.pieces[1].length, null);
  assert.equal(result.pieces[1].sources.length.status, "missing");
});
