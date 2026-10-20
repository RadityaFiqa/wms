import { z } from "zod";

// Safe arithmetic evaluator for the Stock Opname quantity calculator.
// Hand-written tokenizer + recursive-descent parser: never uses eval() or
// new Function(), and only understands numbers, + - x X * / and parentheses.

export const QUANTITY_EXPRESSION_MAX_LENGTH = 200;
export const QUANTITY_CALCULATION_MAX_ROWS = 50;
/** Decimal places kept for row results and totals. */
export const QUANTITY_PRECISION = 3;
const MAX_NESTING_DEPTH = 32;

export type QuantityExpressionResult =
  | { status: "empty" }
  | { status: "ok"; value: number }
  | { status: "error"; message: string };

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

// Deliberately not extending Error: the package compiles to ES5, where Error
// subclasses lose their prototype and `instanceof` checks fail.
class ExpressionError {
  constructor(readonly message: string) {}
}

// Strip binary floating-point noise (0.1 + 0.2 -> 0.3) after every operation
function clean(n: number): number {
  if (!isFinite(n)) throw new ExpressionError("Hasil di luar batas angka");
  const v = Number(n.toPrecision(15));
  return v === 0 ? 0 : v;
}

export function roundQuantity(n: number): number {
  const factor = Math.pow(10, QUANTITY_PRECISION);
  const v = Math.round(clean(n) * factor) / factor;
  return v === 0 ? 0 : v;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t") {
      i++;
    } else if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < input.length && input[j] >= "0" && input[j] <= "9") j++;
      if (input[j] === ".") {
        j++;
        const fracStart = j;
        while (j < input.length && input[j] >= "0" && input[j] <= "9") j++;
        if (j === fracStart) throw new ExpressionError(`Format angka tidak valid: "${input.slice(i, j)}"`);
      }
      if (input[j] === "." || input[j] === ",") {
        throw new ExpressionError("Gunakan satu titik (.) sebagai pemisah desimal, tanpa pemisah ribuan");
      }
      tokens.push({ type: "num", value: Number(input.slice(i, j)) });
      i = j;
    } else if (ch === "+" || ch === "-" || ch === "/" || ch === "*") {
      tokens.push({ type: "op", value: ch });
      i++;
    } else if (ch === "x" || ch === "X") {
      tokens.push({ type: "op", value: "*" });
      i++;
    } else if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
    } else if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
    } else if (ch === "," || ch === ".") {
      throw new ExpressionError("Gunakan titik (.) sebagai pemisah desimal, contoh 10.5");
    } else {
      throw new ExpressionError(`Karakter tidak didukung: "${ch}"`);
    }
  }
  return tokens;
}

// Grammar:
//   expr    := term (('+' | '-') term)*
//   term    := unary (('*' | '/') unary)*
//   unary   := ('-' | '+') primary | primary
//   primary := number | '(' expr ')'
class Parser {
  private pos = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.expr();
    const next = this.tokens[this.pos];
    if (next) {
      if (next.type === "rparen") throw new ExpressionError("Tanda kurung tutup berlebih");
      throw new ExpressionError("Ekspresi tidak valid");
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expr(): number {
    let left = this.term();
    for (let t = this.peek(); t && t.type === "op" && (t.value === "+" || t.value === "-"); t = this.peek()) {
      this.pos++;
      const right = this.term();
      left = clean(t.value === "+" ? left + right : left - right);
    }
    return left;
  }

  private term(): number {
    let left = this.unary();
    for (let t = this.peek(); t && t.type === "op" && (t.value === "*" || t.value === "/"); t = this.peek()) {
      this.pos++;
      const right = this.unary();
      if (t.value === "/") {
        if (right === 0) throw new ExpressionError("Pembagian dengan nol");
        left = clean(left / right);
      } else {
        left = clean(left * right);
      }
    }
    return left;
  }

  private unary(): number {
    const t = this.peek();
    if (t && t.type === "op" && (t.value === "-" || t.value === "+")) {
      const prev = this.tokens[this.pos - 1];
      // A sign is only allowed at the start, after "(", or as a "-" after an operator.
      // This rejects "10++", "--5" and similar runs of operators.
      const afterOperator = prev?.type === "op";
      if (afterOperator && t.value === "+") throw new ExpressionError("Operator berurutan tidak valid");
      this.pos++;
      const nextTok = this.peek();
      if (nextTok && nextTok.type === "op") throw new ExpressionError("Operator berurutan tidak valid");
      const value = this.primary();
      return t.value === "-" ? clean(-value) : value;
    }
    return this.primary();
  }

  private primary(): number {
    const t = this.peek();
    if (!t) throw new ExpressionError("Ekspresi tidak lengkap");
    if (t.type === "num") {
      this.pos++;
      return t.value;
    }
    if (t.type === "lparen") {
      this.pos++;
      if (this.peek()?.type === "rparen") throw new ExpressionError("Tanda kurung kosong");
      if (++this.depth > MAX_NESTING_DEPTH) throw new ExpressionError("Tanda kurung terlalu dalam");
      const value = this.expr();
      this.depth--;
      const close = this.peek();
      if (!close) throw new ExpressionError("Tanda kurung belum ditutup");
      if (close.type !== "rparen") throw new ExpressionError("Ekspresi tidak valid");
      this.pos++;
      return value;
    }
    throw new ExpressionError("Ekspresi tidak valid");
  }
}

/**
 * Evaluate a single calculator row, e.g. "20x2x5", "(10+5)x(2+3)", "10.5*2".
 * Blank input returns { status: "empty" } and should not be counted.
 */
export function evaluateQuantityExpression(input: string): QuantityExpressionResult {
  const trimmed = (input ?? "").trim();
  if (trimmed === "") return { status: "empty" };
  if (trimmed.length > QUANTITY_EXPRESSION_MAX_LENGTH) {
    return { status: "error", message: `Maksimal ${QUANTITY_EXPRESSION_MAX_LENGTH} karakter` };
  }
  try {
    const value = new Parser(tokenize(trimmed)).parse();
    return { status: "ok", value: roundQuantity(value) };
  } catch (e) {
    if (e instanceof ExpressionError) return { status: "error", message: e.message };
    throw e;
  }
}

export interface QuantityCalculationSummary {
  rows: QuantityExpressionResult[];
  /** Sum of valid rows, or null when every row is blank. */
  total: number | null;
  hasError: boolean;
}

export function evaluateQuantityCalculation(expressions: string[]): QuantityCalculationSummary {
  const rows = expressions.map(evaluateQuantityExpression);
  let total = 0;
  let hasValue = false;
  let hasError = false;
  for (const r of rows) {
    if (r.status === "ok") {
      total = clean(total + r.value);
      hasValue = true;
    } else if (r.status === "error") {
      hasError = true;
    }
  }
  return { rows, total: hasValue ? roundQuantity(total) : null, hasError };
}

// ---------------------------------------------------------------------------
// Stock Opname draft update payload
// ---------------------------------------------------------------------------

export const QuantityExpressionSchema = z
  .string()
  .max(QUANTITY_EXPRESSION_MAX_LENGTH, `Ekspresi maksimal ${QUANTITY_EXPRESSION_MAX_LENGTH} karakter`)
  .superRefine((val, ctx) => {
    const res = evaluateQuantityExpression(val);
    if (res.status === "error") ctx.addIssue({ code: z.ZodIssueCode.custom, message: res.message });
  });

export const UpdateStockOpnameStackSchema = z.object({
  uuid: z.string().uuid(),
  actualQty: z.number().finite().nullable(),
  /** Expressions per calculator row. When present, the server derives actualQty from them. */
  calculationRows: z
    .array(QuantityExpressionSchema)
    .max(QUANTITY_CALCULATION_MAX_ROWS, `Maksimal ${QUANTITY_CALCULATION_MAX_ROWS} baris perhitungan`)
    .optional(),
});
export type UpdateStockOpnameStackInput = z.infer<typeof UpdateStockOpnameStackSchema>;

export const UpdateStockOpnameSchema = z.object({
  notes: z.string().optional(),
  stacks: z.array(UpdateStockOpnameStackSchema).optional(),
  attachmentPaths: z.array(z.string()).optional(),
});
export type UpdateStockOpnameInput = z.infer<typeof UpdateStockOpnameSchema>;

/** Calculator row as persisted on StockOpnameStack.calculationRows. */
export interface StockOpnameCalculationRow {
  expression: string;
  result: number;
}
