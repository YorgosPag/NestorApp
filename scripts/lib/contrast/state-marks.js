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
 * Το `color-config.ts` **μία φορά**: το AST του και ο χάρτης των πρωτογενών χρωμάτων.
 *
 * ⚠️ Εξήχθη επειδή το **CHECK 3.28** το έπιασε ως κλώνο τη στιγμή που προστέθηκε η δεύτερη
 * οικογένεια (ADR-782 §27.4): δύο αναγνώστες, δύο ταυτόσημα προοίμια `readFileSync` +
 * `createSourceFile` + `readPrimitives`. Δεν ήταν στιλιστικό — δύο σημεία που ανοίγουν το ίδιο
 * αρχείο μπορούν να αποκλίνουν σε **ποιο** αρχείο ανοίγουν.
 */
function parseColorConfig(repoRoot) {
  const file = path.join(repoRoot, COLOR_CONFIG_PATH);
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  return { source, primitives: readPrimitives(source) };
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
  const { source, primitives } = parseColorConfig(repoRoot);
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

/**
 * Τα σημάδια της **αντιστοίχισης υποβάθρου** (`BASEMAP_CORRESPONDENCE_MARKS`, ADR-782 §27.4).
 *
 * ## Γιατί το `variant` είναι `<σχήμα>:<μοτίβο>` και ΔΕΝ περιέχει μέγεθος
 * Είναι **ακριβώς** τα δύο πεδία που ζωγραφίζει ο
 * `components/dxf-layout/BasemapCorrespondenceMarksLeaf.tsx` — το `shape` επιλέγει `<rect>` ή
 * `<circle>`, το `dash` γίνεται `strokeDasharray`. Το μέγεθος **σκόπιμα** μένει έξω: αν
 * συμμετείχε, δύο ταυτόσημα σχήματα θα περνούσαν το Κ1 επειδή το ένα είναι μεγαλύτερο — και το
 * μέγεθος δεν είναι διακριτικό κανάλι (ίδιος λόγος με το `markSizePx` της πρώτης οικογένειας).
 *
 * Και οι τρεις μοιράζονται **ένα** hex ⇒ το Κ2 δεν έχει τίποτα να κρίνει, **εκ κατασκευής**.
 */
function readCorrespondenceMarks(source, primitives) {
  const spec = propsOf(findConstObject(source, 'BASEMAP_CORRESPONDENCE_MARKS'));
  if (spec.size === 0) {
    throw new Error(`BASEMAP_CORRESPONDENCE_MARKS δεν βρέθηκε στο ${COLOR_CONFIG_PATH}`);
  }
  const hex = resolveValue(spec.get('hex') ?? null, primitives);
  const marks = [];
  for (const [id, node] of propsOf(spec.get('states') ?? null)) {
    const state = propsOf(node);
    const shape = resolveValue(state.get('shape') ?? null, primitives);
    const dash = resolveValue(state.get('dash') ?? null, primitives);
    marks.push({ id, carrier: 'basemap-mark', variant: `${shape}:${dash}`, hex });
  }
  if (marks.length === 0) {
    throw new Error(`BASEMAP_CORRESPONDENCE_MARKS.states είναι κενό στο ${COLOR_CONFIG_PATH}`);
  }
  return marks;
}

/**
 * **Όλες** οι οικογένειες καταστάσεων, ρητά ονομασμένες.
 *
 * 🔑 **Οικογένεια, όχι ένας σωρός.** Η κρίση τρέχει **ανά οικογένεια** γιατί και οι δύο κανόνες
 * ρωτούν κάτι που έχει νόημα μόνο μέσα σε μία: το Κ1 ρωτά «ποιο είναι ποιο **από αυτά που
 * βλέπω μαζί**;» και το Κ2 «η διαφορά που **υπόσχομαι**». Ένα κελί πίνακα και ένα σημάδι
 * χάρτη δεν συνυπάρχουν ποτέ στην ίδια επιφάνεια — μια σύγκριση μεταξύ τους θα απαιτούσε
 * χρωματική απόσταση για υπόσχεση που **κανείς δεν έδωσε**, δηλαδή θόρυβος που τελειώνει σε
 * `SKIP_`.
 *
 * Η προσθήκη είναι **ρητή** και αυτό είναι ο σχεδιασμός: μια νέα οικογένεια πρέπει να γραφτεί
 * εδώ για να κριθεί — ποτέ να συμπεριληφθεί κατά λάθος από γενικό σαρωτή.
 */
function readStateMarkFamilies(repoRoot = process.cwd()) {
  const { source, primitives } = parseColorConfig(repoRoot);
  return [
    { id: 'table-bound-state', marks: readBoundStateMarks(repoRoot) },
    { id: 'basemap-correspondence', marks: readCorrespondenceMarks(source, primitives) },
  ];
}

module.exports = { readBoundStateMarks, readStateMarkFamilies, COLOR_CONFIG_PATH };
