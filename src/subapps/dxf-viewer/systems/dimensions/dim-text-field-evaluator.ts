/**
 * ADR-362 Phase N2+N3 — Dimension field evaluator.
 *
 * N2: Token resolvers — <measurement>, <length>, <area>, <date>, <time>, etc.
 * N3: DIESEL math/string/conditional expression engine — $(+,a,b), $(if,c,t,e), etc.
 *
 * Entry points:
 *   evaluateFieldAST(ast, ctx)   — evaluate pre-parsed AST → string
 *   evaluateFieldText(text, ctx) — parse + evaluate in one call → string
 *
 * Pure functions. Zero React, zero Firestore, zero side effects.
 */

import type { DimStyle } from '../../types/dimension';
import { formatLinearMeasurement } from './dim-text-formatter';
import { parseFieldAST, type FieldAST, type FieldNode } from './dim-text-field-parser';

// ── Evaluation context ─────────────────────────────────────────────────────────

export interface FieldEvalContext {
  /** Primary measurement value in drawing units (same unit as DimStyle). */
  readonly measurementValue: number;
  /** Resolved DimStyle for formatting the measurement token. */
  readonly style: DimStyle;
  /** Evaluation date/time. Defaults to `new Date()` when absent. */
  readonly date?: Date;
  /** Area of associated geometry (optional). */
  readonly area?: number;
  /** Length of associated geometry (optional — distinct from measurementValue). */
  readonly length?: number;
  /** Angle of associated geometry in radians (optional). */
  readonly angle?: number;
  /** Perimeter of associated geometry (optional). */
  readonly perimeter?: number;
  /** Def-point X coordinate (optional). */
  readonly x?: number;
  /** Def-point Y coordinate (optional). */
  readonly y?: number;
  /** Annotation scale factor (optional). */
  readonly scale?: number;
  /** Drawing filename (optional). */
  readonly filename?: string;
  /** Drawing author metadata (optional). */
  readonly author?: string;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Evaluate a pre-parsed FieldAST to a plain string. */
export function evaluateFieldAST(ast: FieldAST, ctx: FieldEvalContext): string {
  return ast.map((node) => evaluateNode(node, ctx)).join('');
}

/** Parse `text` and evaluate immediately. Convenience wrapper. */
export function evaluateFieldText(text: string, ctx: FieldEvalContext): string {
  return evaluateFieldAST(parseFieldAST(text), ctx);
}

// ── Node evaluator ─────────────────────────────────────────────────────────────

function evaluateNode(node: FieldNode, ctx: FieldEvalContext): string {
  switch (node.kind) {
    case 'literal':
      return node.text;
    case 'measurement':
      return formatLinearMeasurement(ctx.measurementValue, ctx.style);
    case 'field':
      return resolveFieldToken(node.name, ctx);
    case 'diesel':
      return evaluateDiesel(node.raw, ctx);
  }
}

// ── Token resolvers (N2) ───────────────────────────────────────────────────────

function resolveFieldToken(name: string, ctx: FieldEvalContext): string {
  const effectiveDate = ctx.date ?? new Date();
  switch (name) {
    case 'measurement':
      return formatLinearMeasurement(ctx.measurementValue, ctx.style);
    case 'length':
      return ctx.length !== undefined ? formatLinearMeasurement(ctx.length, ctx.style) : '';
    case 'area':
      return ctx.area !== undefined ? ctx.area.toFixed(2) : '';
    case 'angle':
      return ctx.angle !== undefined ? `${(ctx.angle * (180 / Math.PI)).toFixed(2)}°` : '';
    case 'perimeter':
      return ctx.perimeter !== undefined ? formatLinearMeasurement(ctx.perimeter, ctx.style) : '';
    case 'x':
      return ctx.x !== undefined ? ctx.x.toFixed(2) : '';
    case 'y':
      return ctx.y !== undefined ? ctx.y.toFixed(2) : '';
    case 'scale':
      return ctx.scale !== undefined ? ctx.scale.toString() : '';
    case 'filename':
      return ctx.filename ?? '';
    case 'author':
      return ctx.author ?? '';
    case 'date':
      return effectiveDate.toLocaleDateString();
    case 'time':
      return effectiveDate.toLocaleTimeString();
    default:
      return `<${name}>`;
  }
}

// ── DIESEL expression engine (N3) ─────────────────────────────────────────────

/**
 * Evaluate a `$(op, arg1, arg2, ...)` expression.
 * Supports nesting: args can themselves be DIESEL expressions.
 */
function evaluateDiesel(raw: string, ctx: FieldEvalContext): string {
  const inner = raw.match(/^\$\(([\s\S]*)\)$/)?.[1];
  if (!inner) return raw;

  const parts = splitDieselArgs(inner);
  if (parts.length === 0) return raw;

  const op = parts[0].trim().toLowerCase();
  const rawArgs = parts.slice(1);
  const args = rawArgs.map((a) => evalDieselArg(a.trim(), ctx));

  return applyDieselOp(op, args, ctx);
}

/** Evaluate a single DIESEL argument — may itself be a nested `$(...)` or a literal. */
function evalDieselArg(arg: string, ctx: FieldEvalContext): string {
  if (arg.startsWith('$(')) return evaluateDiesel(arg, ctx);
  if (arg.startsWith('<') && arg.endsWith('>')) {
    const name = arg.slice(1, -1).toLowerCase();
    if (name === '') return formatLinearMeasurement(ctx.measurementValue, ctx.style);
    return resolveFieldToken(name, ctx);
  }
  const unquoted = arg.replace(/^["']|["']$/g, '');
  return unquoted;
}

/** Apply a DIESEL operator to already-evaluated string arguments. */
function applyDieselOp(op: string, args: readonly string[], ctx: FieldEvalContext): string {
  switch (op) {
    case '+': return applyArithmetic(args, (a, b) => a + b);
    case '-': return applyArithmetic(args, (a, b) => a - b);
    case '*': return applyArithmetic(args, (a, b) => a * b);
    case '/': return applyArithmetic(args, (a, b) => b !== 0 ? a / b : 0);
    case 'if': return applyIf(args);
    case 'fmt': return applyFmt(args);
    case 'strlen': return String((args[0] ?? '').length);
    case 'substr': return applySubstr(args);
    case 'upper': return (args[0] ?? '').toUpperCase();
    case 'lower': return (args[0] ?? '').toLowerCase();
    case 'strcat': return args.join('');
    default: return `$(${op},${args.join(',')})`;
  }
}

function applyArithmetic(
  args: readonly string[],
  op: (a: number, b: number) => number,
): string {
  const a = parseFloat(args[0] ?? '0');
  const b = parseFloat(args[1] ?? '0');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '0';
  const result = op(a, b);
  return Number.isInteger(result) ? String(result) : result.toFixed(4).replace(/\.?0+$/, '');
}

function applyIf(args: readonly string[]): string {
  const cond = args[0] ?? '';
  const trueBranch = args[1] ?? '';
  const falseBranch = args[2] ?? '';
  const isTruthy =
    cond !== '' && cond !== '0' && cond !== 'false' && parseFloat(cond) !== 0;
  return isTruthy ? trueBranch : falseBranch;
}

function applyFmt(args: readonly string[]): string {
  const val = parseFloat(args[0] ?? '0');
  const fmt = args[1] ?? '';
  if (!Number.isFinite(val)) return args[0] ?? '';

  const decMatch = fmt.match(/\.(\d+)/);
  const decimals = decMatch ? decMatch[1].length : 0;
  const formatted = val.toFixed(decimals);

  if (fmt.includes('m²')) return `${formatted} m²`;
  return formatted;
}

function applySubstr(args: readonly string[]): string {
  const s = args[0] ?? '';
  const start = parseInt(args[1] ?? '0', 10);
  const len = args[2] !== undefined ? parseInt(args[2], 10) : undefined;
  return len !== undefined ? s.slice(start, start + len) : s.slice(start);
}

// ── Internal: DIESEL argument splitter ────────────────────────────────────────

/**
 * Split comma-separated DIESEL args respecting nested parentheses and quotes.
 * e.g. "if, $(+,1,2), foo, bar" → ["if", "$(+,1,2)", "foo", "bar"]
 */
function splitDieselArgs(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote: '"' | "'" | null = null;
  let start = 0;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inQuote = ch; continue; }
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth--; continue; }
    if (ch === ',' && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }

  parts.push(inner.slice(start));
  return parts;
}
