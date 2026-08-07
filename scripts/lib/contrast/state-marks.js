/**
 * Διαβάζει τα **σημάδια κατάστασης** του δεσμού πίνακα (`TABLE_BOUND_STATE`) από το
 * `src/subapps/dxf-viewer/config/color-config.ts`.
 *
 * ## 🔴 Γιατί διαβάζει ΤΑ ΙΔΙΑ ΠΕΔΙΑ που ζωγραφίζει ο ζωγράφος
 * Η πύλη μπορούσε να στηριχθεί σε ξεχωριστό «μεταδεδομένο καναλιού» δίπλα στα χρώματα —
 * και θα ήταν **ψεύτικη**: ένα πεδίο που κανείς δεν ζωγραφίζει μπορεί να λέει «τρίγωνο
 * πάνω-δεξιά» ενώ ο καμβάς βάφει πάνω-αριστερά, και η πύλη θα έμενε πράσινη. Ίδιο σχήμα με
 * τις δύο λίστες namespace του CHECK 3.34 και με τη χειρόγραφη λίστα του CHECK 3.37.
 *
 * Εδώ το `corner` **είναι** το όρισμα του `traceCornerTriangle`, και το `staleDashPx` **είναι**
 * το `setLineDash`. Αν αποκλίνουν, έχει σπάσει η ζωγραφιά, όχι η πύλη.
 *
 * ⚠️ **AST, ΟΧΙ regex** — για τον ίδιο λόγο που το δηλώνει το `ts-token-palette.js`: το
 * μονοπάτι μιας ιδιότητας είναι δομή, όχι κείμενο.
 *
 * @module scripts/lib/contrast/state-marks
 * @see scripts/check-state-channel-distinctness.js — η κρίση
 */

'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

/** Το αρχείο που ΟΡΙΖΕΙ τα σημάδια κατάστασης του δεσμού. */
const COLOR_CONFIG_PATH = path.join(
  'src', 'subapps', 'dxf-viewer', 'config', 'color-config.ts',
);

/** Βρίσκει το αρχικοποιητή ενός `export const <name> = {...}` στο ανώτατο επίπεδο. */
function findConstObject(source, name) {
  let found = null;
  source.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const decl of node.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue;
      found = unwrapAsConst(decl.initializer);
    }
  });
  return found;
}

/** `{...} as const` → `{...}`. */
function unwrapAsConst(node) {
  if (node === undefined) return null;
  return ts.isAsExpression(node) || ts.isTypeAssertionExpression?.(node)
    ? unwrapAsConst(node.expression)
    : node;
}

/** Οι property assignments ενός object literal, ως `Map<string, Node>`. */
function propsOf(objectLiteral) {
  const map = new Map();
  if (objectLiteral === null || !ts.isObjectLiteralExpression(objectLiteral)) return map;
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (key !== null) map.set(key, unwrapAsConst(prop.initializer));
  }
  return map;
}

/**
 * Λύνει έναν κόμβο σε **τιμή**: string/number literal, πίνακας, ή `UI_COLORS.X` /
 * `UI_COLORS_BASE.X` μέσω του χάρτη των πρωτογενών.
 *
 * Επιστρέφει `null` όταν δεν μπορεί να λύσει — **ποτέ** μαντεψιά: μια ανεπίλυτη αναφορά
 * είναι σφάλμα που πρέπει να φανεί, όχι τιμή που πρέπει να εφευρεθεί.
 */
function resolveValue(node, primitives) {
  if (node === null || node === undefined) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((el) => resolveValue(el, primitives));
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const root = node.expression.text;
    if (root === 'UI_COLORS' || root === 'UI_COLORS_BASE') {
      return primitives.get(node.name.text) ?? null;
    }
  }
  return null;
}

/** Ο χάρτης των πρωτογενών χρωμάτων (`UI_COLORS_BASE`), όνομα → hex. */
function readPrimitives(source) {
  const map = new Map();
  const base = findConstObject(source, 'UI_COLORS_BASE');
  for (const [key, node] of propsOf(base)) {
    if (ts.isStringLiteral(node)) map.set(key, node.text);
  }
  return map;
}

/**
 * Τα σημάδια κατάστασης, **ως δεδομένα**.
 *
 * Κάθε εγγραφή: `{ id, carrier, variant, hex }`.
 * - `carrier` = ο **φορέας** (λωρίδα στήλης ή τρίγωνο κελιού) — δύο διαφορετικοί φορείς
 *   διακρίνονται ήδη γεωμετρικά.
 * - `variant` = το μη-χρωματικό διακριτικό **μέσα** στον ίδιο φορέα, φτιαγμένο από τα πεδία
 *   που όντως ζωγραφίζονται.
 */
function readBoundStateMarks(repoRoot = process.cwd()) {
  const file = path.join(repoRoot, COLOR_CONFIG_PATH);
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  const primitives = readPrimitives(source);
  const bound = propsOf(findConstObject(source, 'TABLE_BOUND_STATE'));
  if (bound.size === 0) {
    throw new Error(`TABLE_BOUND_STATE δεν βρέθηκε στο ${COLOR_CONFIG_PATH}`);
  }

  const val = (key) => resolveValue(bound.get(key) ?? null, primitives);
  const columnHex = val('columnHex');
  const staleHex = val('staleHex');
  const dash = val('staleDashPx');

  const marks = [
    {
      id: 'bound-writable',
      carrier: 'column-strip',
      variant: `solid:alpha=${val('columnAlpha')}`,
      hex: columnHex,
    },
    {
      id: 'bound-readonly',
      carrier: 'column-strip',
      variant: `solid:alpha=${val('readOnlyColumnAlpha')}`,
      hex: columnHex,
    },
    {
      id: 'stale',
      carrier: 'column-strip',
      variant: `dashed:${Array.isArray(dash) ? dash.join('-') : dash}`,
      hex: staleHex,
    },
  ];

  const exceptions = propsOf(bound.get('exceptionMarks') ?? null);
  for (const [id, node] of exceptions) {
    const spec = propsOf(node);
    marks.push({
      id,
      carrier: 'cell-triangle',
      variant: `corner=${resolveValue(spec.get('corner') ?? null, primitives)}`,
      hex: resolveValue(spec.get('hex') ?? null, primitives),
    });
  }
  return marks;
}

module.exports = { readBoundStateMarks, COLOR_CONFIG_PATH };
