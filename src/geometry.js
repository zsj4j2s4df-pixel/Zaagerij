// One saw plane. x runs along stock; y=0 is far side and y=width near operator.
// 'flip' rolls the stock about its length axis: x is unchanged; far/near swap.
const EPS = 1e-6;
export const kerfX = (angle, kerf) =>
  Number(kerf) / Math.sin((Number(angle) * Math.PI) / 180);
export function polygon(piece, profile, flipped = false) {
  const w = Number(profile.width) || 0,
    L = Number(piece.long ?? piece.length);
  const a = w / Math.tan((Number(piece.left) * Math.PI) / 180),
    b = w / Math.tan((Number(piece.right) * Math.PI) / 180);
  let lt = Math.max(a, 0),
    lb = Math.max(-a, 0),
    rt = L - Math.max(b, 0),
    rb = L - Math.max(-b, 0);
  if (flipped) [lt, lb, rt, rb] = [lb, lt, rb, rt];
  return {
    lt,
    lb,
    rt,
    rb,
    width: w,
    length: L,
    valid: rt >= lt - EPS && rb >= lb - EPS,
  };
}
export function append(bar, piece, profile, combine, flipped = false) {
  const shape = polygon(piece, profile, flipped);
  if (!shape.valid) return null;
  const prev = bar.items.at(-1),
    kL = kerfX(piece.left, profile.kerf),
    kR = kerfX(piece.right, profile.kerf);
  let start = (prev ? bar.used : 0) + kL,
    shared = false,
    overlap = 0;
  if (prev && combine) {
    const old = prev.shape,
      k = kerfX(prev.right, profile.kerf),
      sameSlope = Math.abs(old.rt - old.rb - (shape.lt - shape.lb)) < EPS;
    const actualPlane =
      shape.width > 0 || (+prev.right === 90 && +piece.left === 90);
    if (sameSlope && actualPlane && Math.abs(k - kL) < EPS) {
      shared = true;
      start = prev.start + old.rt - shape.lt + k;
      overlap = prev.start + prev.long - start;
    }
  }
  return {
    ...piece,
    flipped,
    shape,
    start,
    end: start + piece.long,
    required: piece.long + kL + kR,
    shared,
    overlap,
    kerfLeft: kL,
    kerfRight: kR,
    trim: 0,
  };
}
export function barSignature(bar) {
  return JSON.stringify([
    bar.profileId,
    bar.source,
    bar.capacity,
    bar.items.map((p) => [
      p.id,
      p.long,
      p.left,
      p.right,
      p.flipped,
      p.shared,
      Math.round(p.start * 1e6),
    ]),
  ]);
}
export const pieceColors = [
  "#dbeafe",
  "#dcf4e5",
  "#fce6cc",
  "#eadffc",
  "#d2f0f1",
  "#fce0e9",
  "#e9edc8",
  "#e1e4fa",
];
export function colorFor(piece, doc) {
  return (
    doc.pieces.find((p) => p.id === piece.id)?.color ||
    pieceColors[
      [...String(piece.id)].reduce(
        (n, c) => (n * 31 + c.charCodeAt(0)) >>> 0,
        0,
      ) % pieceColors.length
    ]
  );
}
