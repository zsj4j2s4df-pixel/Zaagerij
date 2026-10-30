// Arithmetic only: never eval user input.
export function calculate(text) {
  try {
    const input = String(text)
      .replaceAll(",", ".")
      .replaceAll("×", "*")
      .replaceAll("÷", "/")
      .replaceAll("−", "-");
    if (input.length > 128) return null;
    const tokens = input.match(/\d+(?:\.\d*)?|\.\d+|[()+*/-]|\S/g) || [];
    let at = 0;
    function factor() {
      const t = tokens[at++];
      if (t === "(") {
        const v = sum();
        if (tokens[at++] !== ")") throw Error();
        return v;
      }
      if (t === "-") return -factor();
      if (t === "+") return factor();
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(t || "")) throw Error();
      return Number(t);
    }
    function product() {
      let v = factor();
      while (tokens[at] === "*" || tokens[at] === "/") {
        const op = tokens[at++],
          b = factor();
        v = op === "*" ? v * b : v / b;
      }
      return v;
    }
    function sum() {
      let v = product();
      while (tokens[at] === "+" || tokens[at] === "-") {
        const op = tokens[at++],
          b = product();
        v = op === "+" ? v + b : v - b;
      }
      return v;
    }
    const result = sum();
    return at === tokens.length && Number.isFinite(result)
      ? Math.round(result * 1e6) / 1e6
      : null;
  } catch {
    return null;
  }
}
