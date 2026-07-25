/**
 * =============================================================================
 * 🏢 ENTERPRISE: Numeric expression evaluator (Figma / Revit / C4D parity)
 * =============================================================================
 *
 * Every numeric input box in Figma, Revit and Cinema 4D doubles as a calculator:
 * the user may type `1200/2`, `18+3` or `2,4*1,1` and the field commits the
 * result. This module is the SSoT for that evaluation.
 *
 * SAFETY: no `eval` / `new Function`. A hand-written tokenizer feeds a
 * shunting-yard parser, so only the operators declared here can ever execute.
 * Untrusted input can at worst produce `null`.
 *
 * LOCALE: number literals are handed to {@link parseLocaleNumber} (ADR-576), so
 * `.` and `,` are both accepted as the decimal mark exactly as everywhere else
 * in the app. This module adds NO parsing rules of its own.
 *
 * @module components/ui/numeric-field/numeric-expression
 * @see ADR-706 — Numeric field SSoT
 */

import { parseLocaleNumber } from '@/lib/number/locale-number';

/** A single arithmetic operator supported inside a numeric field. */
type Operator = '+' | '-' | '*' | '/' | '^';

interface OperatorSpec {
  readonly precedence: number;
  readonly rightAssociative: boolean;
  readonly apply: (left: number, right: number) => number;
}

const OPERATORS: Record<Operator, OperatorSpec> = {
  '+': { precedence: 1, rightAssociative: false, apply: (a, b) => a + b },
  '-': { precedence: 1, rightAssociative: false, apply: (a, b) => a - b },
  '*': { precedence: 2, rightAssociative: false, apply: (a, b) => a * b },
  '/': { precedence: 2, rightAssociative: false, apply: (a, b) => a / b },
  '^': { precedence: 3, rightAssociative: true, apply: (a, b) => a ** b },
};

/** Characters that may appear inside a number literal (digits + separators). */
const NUMBER_CHAR = /[\d.,]/;
/** An expression must contain at least one operator to be worth evaluating. */
const HAS_OPERATOR = /[+\-*/^()]/;

type Token = { kind: 'number'; value: number } | { kind: 'op'; value: Operator } | { kind: 'paren'; value: '(' | ')' };

function isOperator(char: string): char is Operator {
  return char === '+' || char === '-' || char === '*' || char === '/' || char === '^';
}

/**
 * Split an expression into number / operator / parenthesis tokens.
 * Returns `null` on any character that is not part of the grammar.
 */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (char === ' ') {
      index += 1;
      continue;
    }

    if (NUMBER_CHAR.test(char)) {
      let literal = '';
      while (index < input.length && NUMBER_CHAR.test(input[index])) {
        literal += input[index];
        index += 1;
      }
      const value = parseLocaleNumber(literal);
      if (value === null) return null;
      tokens.push({ kind: 'number', value });
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ kind: 'paren', value: char });
      index += 1;
      continue;
    }

    if (isOperator(char)) {
      tokens.push({ kind: 'op', value: char });
      index += 1;
      continue;
    }

    return null;
  }

  return tokens;
}

/**
 * Rewrite unary `+`/`-` (leading, or following another operator / an opening
 * paren) into a multiplication by ±1, so the shunting-yard stays binary-only.
 */
function resolveUnarySigns(tokens: Token[]): Token[] | null {
  const output: Token[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const previous = output[output.length - 1];
    const isUnaryPosition =
      previous === undefined || previous.kind === 'op' || (previous.kind === 'paren' && previous.value === '(');

    if (token.kind === 'op' && (token.value === '+' || token.value === '-') && isUnaryPosition) {
      const next = tokens[i + 1];
      if (next === undefined || next.kind !== 'number') return null;
      output.push({ kind: 'number', value: token.value === '-' ? -next.value : next.value });
      i += 1;
      continue;
    }

    output.push(token);
  }

  return output;
}

/** Pop operators from the stack into `output` while `shouldPop` holds. */
function drainWhile(stack: Token[], output: Token[], shouldPop: (top: Token) => boolean): void {
  while (stack.length > 0 && shouldPop(stack[stack.length - 1])) {
    output.push(stack.pop() as Token);
  }
}

/** Convert infix tokens to Reverse Polish Notation (shunting-yard). */
function toRpn(tokens: Token[]): Token[] | null {
  const output: Token[] = [];
  const stack: Token[] = [];

  for (const token of tokens) {
    if (token.kind === 'number') {
      output.push(token);
      continue;
    }

    if (token.kind === 'op') {
      const current = OPERATORS[token.value];
      drainWhile(stack, output, (top) => {
        if (top.kind !== 'op') return false;
        const other = OPERATORS[top.value];
        return current.rightAssociative
          ? other.precedence > current.precedence
          : other.precedence >= current.precedence;
      });
      stack.push(token);
      continue;
    }

    if (token.value === '(') {
      stack.push(token);
      continue;
    }

    drainWhile(stack, output, (top) => !(top.kind === 'paren' && top.value === '('));
    const open = stack.pop();
    if (open === undefined) return null; // unbalanced ')'
  }

  while (stack.length > 0) {
    const top = stack.pop() as Token;
    if (top.kind === 'paren') return null; // unbalanced '('
    output.push(top);
  }

  return output;
}

/** Evaluate an RPN token stream. */
function evaluateRpn(rpn: Token[]): number | null {
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.kind === 'number') {
      stack.push(token.value);
      continue;
    }
    if (token.kind !== 'op') return null;

    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) return null;
    stack.push(OPERATORS[token.value].apply(left, right));
  }

  if (stack.length !== 1) return null;
  return Number.isFinite(stack[0]) ? stack[0] : null;
}

/**
 * Evaluate a user-typed arithmetic expression to a finite number.
 *
 *   "1200/2"    → 600        "2,4*1,1"   → 2.64       "(18+3)*2" → 42
 *   "2.4"       → 2.4        "-5"        → -5         "2^10"     → 1024
 *   "abc"       → null       "1/0"       → null       "(1+2"     → null
 *
 * Plain literals are delegated to {@link parseLocaleNumber} untouched, so this
 * is a safe drop-in for any field that previously parsed a bare number.
 */
export function evaluateNumericExpression(raw: string): number | null {
  const input = String(raw ?? '').trim();
  if (input === '') return null;

  // Fast path: a plain literal never needs the parser.
  if (!HAS_OPERATOR.test(input)) return parseLocaleNumber(input);

  const tokens = tokenize(input);
  if (tokens === null || tokens.length === 0) return null;

  const binary = resolveUnarySigns(tokens);
  if (binary === null) return null;

  const rpn = toRpn(binary);
  if (rpn === null) return null;

  return evaluateRpn(rpn);
}

/** True when the string contains an operator, i.e. it is a formula not a literal. */
export function isNumericExpression(raw: string): boolean {
  return HAS_OPERATOR.test(String(raw ?? '').trim());
}
