/**
 * ADR-362 Phase N1 — Dimension field token parser + AST.
 *
 * Parses AutoCAD-style field syntax embedded in dimension `userText`:
 *   `<>`               → MeasurementPlaceholder (AutoCAD primary token)
 *   `<tokenName>`      → FieldToken  (runtime-evaluated, e.g. <date>, <length>)
 *   `$(op, a, b, ...)`  → DieselExpr (math / string / conditional expression)
 *   everything else    → Literal
 *
 * Pure functions. Zero React, zero side effects, zero Firestore.
 */

// ── Token names ────────────────────────────────────────────────────────────────

export const FIELD_TOKEN_NAMES = [
  'measurement',
  'length',
  'area',
  'angle',
  'perimeter',
  'x',
  'y',
  'scale',
  'filename',
  'date',
  'time',
  'author',
] as const;

export type FieldTokenName = (typeof FIELD_TOKEN_NAMES)[number];

const FIELD_TOKEN_SET: ReadonlySet<string> = new Set(FIELD_TOKEN_NAMES);

function isFieldTokenName(s: string): s is FieldTokenName {
  return FIELD_TOKEN_SET.has(s.toLowerCase());
}

// ── AST nodes ─────────────────────────────────────────────────────────────────

export type FieldNode =
  | { readonly kind: 'literal'; readonly text: string }
  | { readonly kind: 'measurement' }
  | { readonly kind: 'field'; readonly name: FieldTokenName }
  | { readonly kind: 'diesel'; readonly raw: string };

export type FieldAST = ReadonlyArray<FieldNode>;

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parses a dimension userText string into a FieldAST.
 * Empty input → single Literal('').
 */
export function parseFieldAST(input: string): FieldAST {
  if (!input) return [{ kind: 'literal', text: '' }];

  const nodes: FieldNode[] = [];
  let pos = 0;
  let literalStart = 0;

  function flushLiteral(end: number): void {
    if (end > literalStart) {
      nodes.push({ kind: 'literal', text: input.slice(literalStart, end) });
    }
  }

  while (pos < input.length) {
    const ch = input[pos];

    if (ch === '$' && input[pos + 1] === '(') {
      flushLiteral(pos);
      const [dieselNode, len] = parseDieselToken(input, pos);
      nodes.push(dieselNode);
      pos += len;
      literalStart = pos;
      continue;
    }

    if (ch === '<') {
      if (input[pos + 1] === '>') {
        flushLiteral(pos);
        nodes.push({ kind: 'measurement' });
        pos += 2;
        literalStart = pos;
        continue;
      }

      const angleResult = parseAngleToken(input, pos);
      if (angleResult) {
        flushLiteral(pos);
        nodes.push(angleResult.node);
        pos += angleResult.len;
        literalStart = pos;
        continue;
      }
    }

    pos++;
  }

  flushLiteral(input.length);

  return nodes.length > 0 ? nodes : [{ kind: 'literal', text: input }];
}

// ── Internal: <angleToken> parser ─────────────────────────────────────────────

interface AngleResult {
  readonly node: FieldNode;
  readonly len: number;
}

/** Tries to match `<tokenName>` starting at `start`. Returns null on failure. */
function parseAngleToken(input: string, start: number): AngleResult | null {
  const closeIdx = input.indexOf('>', start + 1);
  if (closeIdx === -1) return null;

  const name = input.slice(start + 1, closeIdx).trim().toLowerCase();
  if (!name || name.includes(' ') || name.includes('\n')) return null;

  const len = closeIdx - start + 1;

  if (isFieldTokenName(name)) {
    return { node: { kind: 'field', name }, len };
  }

  return null;
}

// ── Internal: $(op, ...) DIESEL token parser ───────────────────────────────────

/**
 * Reads a complete `$(...)` expression starting at `start`.
 * Handles nested parentheses so `$(if, $(+,1,2), a, b)` parses correctly.
 * Returns the AST node + number of characters consumed.
 * On malformed input (no closing paren), treats the whole remainder as diesel raw.
 */
function parseDieselToken(input: string, start: number): [FieldNode, number] {
  let depth = 0;
  let pos = start + 1;

  while (pos < input.length) {
    const ch = input[pos];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        const raw = input.slice(start, pos + 1);
        return [{ kind: 'diesel', raw }, raw.length];
      }
    }
    pos++;
  }

  const raw = input.slice(start);
  return [{ kind: 'diesel', raw }, raw.length];
}

// ── Utility: check if text contains field syntax ──────────────────────────────

/** Returns true if the string contains any `<token>`, `<>`, or `$(...)` syntax. */
export function hasFieldSyntax(text: string): boolean {
  return /(<>|<[a-zA-Z]+>|\$\()/.test(text);
}

/** Returns just the FieldToken and Diesel nodes (no literals). */
export function extractFieldNodes(ast: FieldAST): ReadonlyArray<FieldNode> {
  return ast.filter((n) => n.kind !== 'literal');
}
