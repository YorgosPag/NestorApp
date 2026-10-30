/**
 * **JSX AST** (ADR-924 Φ3) — ο ΕΝΑΣ περιπατητής και ο ΕΝΑΣ αναλυτής των πυλών που ρωτούν «ποια στοιχεία JSX φέρουν
 * το γνώρισμα Χ;» (3.23 · 3.24 · 3.48). Ήταν τρία αντίγραφα του ίδιου `walk` + `parser.parse(…)`.
 *
 * Ο αναλυτής παίρνει **κείμενο**, όχι μονοπάτι: το κείμενο το δίνει η είσοδος της πύλης (`--index` ⇒ το commit).
 *
 * @module scripts/lib/jsx-ast
 */

'use strict';

/** Κάθε κόμβος του δέντρου, προ-διατεταγμένα. */
function walkAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach(c => walkAst(c, visitor));
    } else if (child && typeof child === 'object' && child.type) {
      walkAst(child, visitor);
    }
  }
}

/**
 * Το AST ενός `.ts`/`.tsx` — ή `null` όταν λείπει ο `@typescript-eslint/parser` ή το κείμενο δεν αναλύεται
 * (η συμπεριφορά που είχαν και οι τρεις· ο καλών αποφασίζει τι σημαίνει το `null`).
 */
function parseJsx(text) {
  let parser;
  try {
    parser = require('@typescript-eslint/parser');
  } catch {
    return null;
  }
  try {
    return parser.parse(text, { jsx: true, range: true, loc: true, errorOnUnknownASTType: false });
  } catch {
    return null;
  }
}

module.exports = { walkAst, parseJsx };
