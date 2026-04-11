/**
 * Firestore Rules Test Harness — Static Rule Shape Validator
 *
 * Regex-based parser of `firestore.rules` that extracts top-level match
 * blocks and the first OR leg of each `allow read: if ...` statement.
 *
 * Phase A scope: detect Bug #1 class regressions — specifically, verify
 * that every `tenant_direct` collection in the coverage manifest starts
 * its `allow read` expression with `isSuperAdminOnly()` as the first
 * OR leg. Phase B expands to richer pattern checks.
 *
 * This TS module mirrors `scripts/_shared/firestore-rules-parser.js` (the
 * CommonJS version used by the pre-commit hook). Keeping the logic in both
 * places is deliberate: the pre-commit hook must not depend on ts-jest
 * transpilation, and the in-process tests benefit from type safety.
 *
 * See ADR-298 §1.5 pitfall (ε) and §3.4 Validation E.
 *
 * @module tests/firestore-rules/_harness/rule-shape-validator
 * @since 2026-04-11 (ADR-298 Phase A)
 */

export interface RuleBlock {
  readonly collection: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  /** Raw expression body of the first `allow read: if ...` statement, or null if none. */
  readonly firstAllowReadExpression: string | null;
  /** First OR leg of the allow-read expression (split on top-level `||`). */
  readonly firstAllowReadLeg: string | null;
}

export interface ShapeViolation {
  readonly collection: string;
  readonly lineStart: number;
  readonly problem: 'missing_super_admin_short_circuit' | 'no_allow_read';
  readonly actualFirstLeg: string | null;
}

/**
 * Parse `firestore.rules` content and extract every top-level match block.
 *
 * Top-level = 4-space indentation under `match /databases/{database}/documents`.
 * Nested subcollection matches (e.g. `match /items/{itemId}` inside a
 * parent block) are ignored — they are owned by their parent.
 */
export function parseFirestoreRules(rulesContent: string): RuleBlock[] {
  const lines = rulesContent.split('\n');
  const blocks: RuleBlock[] = [];

  // Top-level match blocks are indented by exactly 4 spaces inside the
  // `match /databases/{database}/documents {` wrapper.
  const topLevelMatchRegex = /^ {4}match \/([a-zA-Z_][a-zA-Z0-9_]*)\/\{/;

  for (let i = 0; i < lines.length; i++) {
    const match = topLevelMatchRegex.exec(lines[i]);
    if (!match) continue;

    const collection = match[1];
    const lineStart = i + 1; // 1-indexed
    const lineEnd = findBlockEnd(lines, i);
    const body = lines.slice(i, lineEnd).join('\n');

    const firstAllowReadExpression = extractFirstAllowRead(body);
    const firstAllowReadLeg = firstAllowReadExpression
      ? splitFirstOrLeg(firstAllowReadExpression)
      : null;

    blocks.push({
      collection,
      lineStart,
      lineEnd,
      firstAllowReadExpression,
      firstAllowReadLeg,
    });
  }

  return blocks;
}

/**
 * Strip Firestore path parameters like `/{projectId}` or `/{docs=**}`
 * so the brace counter treats them as plain text, not block delimiters.
 */
function stripPathParams(line: string): string {
  return line.replace(/\/\{[a-zA-Z_][a-zA-Z0-9_]*(?:=\*\*)?\}/g, '/__PARAM__');
}

/**
 * Walk forward from a match block's opening line and find the closing
 * brace at the same indentation. Uses brace-depth counting with path
 * parameters scrubbed first — no full CEL parser needed.
 */
function findBlockEnd(lines: string[], startIdx: number): number {
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    const scrubbed = stripPathParams(lines[i]);
    for (const ch of scrubbed) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i + 1;
      }
    }
  }
  return lines.length;
}

/**
 * Pull the expression body of the first `allow read: if ...;` in a match
 * block body. Handles multi-line expressions by gluing lines until the
 * closing semicolon.
 */
function extractFirstAllowRead(body: string): string | null {
  const allowReadStart = body.search(/allow\s+read\s*:\s*if\s+/);
  if (allowReadStart < 0) return null;

  const afterIf = body.slice(allowReadStart).replace(/allow\s+read\s*:\s*if\s+/, '');
  const semicolonIdx = afterIf.indexOf(';');
  if (semicolonIdx < 0) return null;

  return afterIf
    .slice(0, semicolonIdx)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split an expression on its top-level `||` and return the first leg.
 * Handles parenthesised subexpressions by tracking paren depth.
 */
export function splitFirstOrLeg(expression: string): string {
  let depth = 0;
  for (let i = 0; i < expression.length - 1; i++) {
    const ch = expression[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && ch === '|' && expression[i + 1] === '|') {
      return expression.slice(0, i).trim();
    }
  }
  return expression.trim();
}

/**
 * Check whether a leg expression is a call to `isSuperAdminOnly()`.
 * Accepts optional whitespace variants.
 */
export function isSuperAdminShortCircuit(leg: string | null): boolean {
  if (!leg) return false;
  return /^isSuperAdminOnly\s*\(\s*\)$/.test(leg);
}

/**
 * Validate a parsed blocks list against a set of collections that MUST
 * open their `allow read` with `isSuperAdminOnly()`. Returns violations,
 * empty array = OK.
 *
 * Phase A only applies this gate to the collections that are classified
 * as `tenant_direct` in the coverage manifest — the caller passes the
 * target collection list.
 */
export function validateSuperAdminShortCircuit(
  blocks: readonly RuleBlock[],
  targetCollections: readonly string[],
): ShapeViolation[] {
  const violations: ShapeViolation[] = [];
  const targetSet = new Set(targetCollections);

  for (const block of blocks) {
    if (!targetSet.has(block.collection)) continue;

    if (!block.firstAllowReadExpression) {
      violations.push({
        collection: block.collection,
        lineStart: block.lineStart,
        problem: 'no_allow_read',
        actualFirstLeg: null,
      });
      continue;
    }

    if (!isSuperAdminShortCircuit(block.firstAllowReadLeg)) {
      violations.push({
        collection: block.collection,
        lineStart: block.lineStart,
        problem: 'missing_super_admin_short_circuit',
        actualFirstLeg: block.firstAllowReadLeg,
      });
    }
  }

  return violations;
}
