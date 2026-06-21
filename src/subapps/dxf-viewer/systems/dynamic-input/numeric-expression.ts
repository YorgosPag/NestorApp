/**
 * ADR-510 Φ1 (E2) — Safe arithmetic evaluator for numeric input fields.
 *
 * Lets the user type `1500+300`, `2*1500`, `(1+2)*3`, `-50/2` into any numeric
 * CAD field and get the computed value. SSoT for "math in the field" across the
 * coordinate-parser (cartesian/polar components) and the dynamic-input keyboard
 * handlers (Direct Distance length/angle). Reuse this — do NOT re-implement an
 * expression parser elsewhere.
 *
 * Supports: `+ - * /`, parentheses, decimals, unary +/-, whitespace.
 * Deliberately NOT supported: variables, functions, units (the caller strips the
 * unit suffix first), and — critically — `eval`/`Function` (CSP-safe, fully
 * deterministic, immune to code injection). Returns `null` for empty / malformed
 * input or division by zero.
 *
 * Zero React / DOM dependencies — pure, fully unit-testable.
 */

type Tok =
  | { readonly k: 'num'; readonly v: number }
  | { readonly k: 'op'; readonly v: '+' | '-' | '*' | '/' }
  | { readonly k: 'lp' }
  | { readonly k: 'rp' };

/** Tokenize a raw arithmetic string. Returns `null` on any illegal character. */
function tokenize(raw: string): Tok[] | null {
  const s = raw.trim();
  if (!s) return null;
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '+' || c === '-' || c === '*' || c === '/') { out.push({ k: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ k: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ k: 'rp' }); i++; continue; }
    const m = s.slice(i).match(/^\d*\.?\d+/);
    if (m) { out.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    return null;
  }
  return out.length > 0 ? out : null;
}

/** Recursive-descent parser with standard `* /` over `+ -` precedence. */
class ExprParser {
  private pos = 0;
  constructor(private readonly toks: Tok[]) {}

  atEnd(): boolean { return this.pos >= this.toks.length; }
  private peek(): Tok | undefined { return this.toks[this.pos]; }

  /** Lowest precedence: `+` and `-`. */
  parseExpression(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;
    for (let t = this.peek(); t?.k === 'op' && (t.v === '+' || t.v === '-'); t = this.peek()) {
      this.pos++;
      const right = this.parseTerm();
      if (right === null) return null;
      left = t.v === '+' ? left + right : left - right;
    }
    return left;
  }

  /** Higher precedence: `*` and `/` (division by zero → null). */
  private parseTerm(): number | null {
    let left = this.parseFactor();
    if (left === null) return null;
    for (let t = this.peek(); t?.k === 'op' && (t.v === '*' || t.v === '/'); t = this.peek()) {
      this.pos++;
      const right = this.parseFactor();
      if (right === null) return null;
      if (t.v === '/' && right === 0) return null;
      left = t.v === '*' ? left * right : left / right;
    }
    return left;
  }

  /** Unary +/- , parenthesised sub-expression, or a literal number. */
  private parseFactor(): number | null {
    const t = this.peek();
    if (!t) return null;
    if (t.k === 'op' && (t.v === '+' || t.v === '-')) {
      this.pos++;
      const f = this.parseFactor();
      return f === null ? null : (t.v === '-' ? -f : f);
    }
    if (t.k === 'lp') {
      this.pos++;
      const e = this.parseExpression();
      if (e === null) return null;
      const close = this.peek();
      if (close?.k !== 'rp') return null;
      this.pos++;
      return e;
    }
    if (t.k === 'num') { this.pos++; return t.v; }
    return null;
  }
}

/**
 * Evaluate a unit-less arithmetic expression. Returns the finite numeric result,
 * or `null` for empty / malformed input (caller treats `null` as "invalid field").
 */
export function evalExpr(raw: string): number | null {
  const toks = tokenize(raw);
  if (toks === null) return null;
  const parser = new ExprParser(toks);
  const value = parser.parseExpression();
  if (value === null || !parser.atEnd()) return null;
  return Number.isFinite(value) ? value : null;
}
