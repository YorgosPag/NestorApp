/**
 * CHECK 3.97 — ο ΑΝΙΧΝΕΥΤΗΣ της ωμής εφεδρείας i18n (ADR-898 §18.2). Καθαρή συνάρτηση: κείμενο → ευρήματα.
 *
 * 🔑 ΤΟ ΚΡΙΤΗΡΙΟ: κλήση μετάφρασης (`t(…)`, `tCommon(…)`, `i18n.t(…)`, `x.t(…)`) που δίνει στο αντικείμενο
 *    επιλογών της `defaultValue` με τιμή που ΔΕΝ είναι γνωστό κείμενο. Όταν λείψει το κλειδί, ο άνθρωπος βλέπει
 *    την ΩΜΗ τιμή (`in_progress`, `mixed`) — και το CHECK 3.8 δεν βλέπει ποτέ το κλειδί που λείπει.
 *
 * ✅ ΕΠΙΤΡΕΠΕΤΑΙ (κατάσταση `clean`):
 *    · κυριολεκτική συμβολοσειρά, ΚΑΙ η κενή `''` — το κείμενό της το κρίνει το N.11 (CHECK hardcoded strings),
 *      όχι αυτή η πύλη· η κενή δεν δείχνει τίποτα ωμό, απλώς τίποτα.
 *    · template ΧΩΡΙΣ αντικατάσταση (`` `κείμενο` ``) — ισοδύναμο με κυριολεκτική.
 *    · `undefined` — ισοδύναμο με «καμία εφεδρεία».
 *    · ΕΜΦΩΛΕΥΜΕΝΗ κλήση μετάφρασης (`defaultValue: t('other.key')`) — εφεδρεία σε ΑΛΛΟ μεταφρασμένο κλειδί·
 *      δεν δείχνει ποτέ ωμή τιμή, και το εσωτερικό κλειδί το βλέπει κανονικά το CHECK 3.8.
 *    · τριαδικός όπου ΚΑΙ ΟΙ ΔΥΟ κλάδοι είναι επιτρεπτοί (αναδρομικά).
 * ⛔ ΟΤΙΔΗΠΟΤΕ ΑΛΛΟ (identifier, πρόσβαση μέλους, template με `${}`, `??`/`||`, τριαδικός με ωμό κλάδο,
 *    κλήση άλλης συνάρτησης, `String(x)`) είναι εύρημα — ΣΥΝΤΗΡΗΤΙΚΑ: ό,τι δεν αποδεικνύεται κείμενο, μετρά.
 *
 * ⚠️ AST, ΟΧΙ REGEX — μετρημένα τρία είδη ψευδώς θετικών του regex: Radix `<Accordion defaultValue={x}>`,
 *    hooks ρυθμίσεων `{ defaultValue: DEFAULT_X }` έξω από κάθε `t(…)`, και backtracking του `\s*` που
 *    «ταίριαζε» το `defaultValue: ''`. Εδώ κρίνεται ΜΟΝΟ `defaultValue` μέσα σε όρισμα κλήσης μετάφρασης.
 *
 * 🔶 ΔΗΛΩΜΕΝΑ ΚΕΝΑ (δεν μετρούν — δεν αποδεικνύονται στατικά):
 *    · `t(key, opts)` με επιλογές από μεταβλητή/spread · · `t(key, 'κείμενο')` (σύντομη μορφή του i18next).
 */

'use strict';

const ts = require('typescript');

/** `t` και τα συνώνυμα του `useTranslation` (`const { t: tCommon }`) — μετρημένες 56 αποδομήσεις στο `src/`. */
const TRANSLATE_IDENTIFIER = /^t(?:[A-Z]\w*)?$/;
const OPTION_NAME = 'defaultValue';

function unwrap(node) {
  let n = node;
  while (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)
    || ts.isSatisfiesExpression(n)) n = n.expression;
  return n;
}

/** Είναι αυτός ο καλούμενος συνάρτηση μετάφρασης; `t` · `tCommon` · `i18n.t` · `x?.t`. */
function isTranslateCallee(expr) {
  const callee = unwrap(expr);
  if (ts.isIdentifier(callee)) return TRANSLATE_IDENTIFIER.test(callee.text);
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 't';
  return false;
}

/** Δείχνει αυτή η έκφραση πάντα ΜΕΤΑΦΡΑΣΜΕΝΟ ή ΓΝΩΣΤΟ κείμενο; (αναδρομικά στους τριαδικούς) */
function isSafeFallback(node) {
  const n = unwrap(node);
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return true;
  if (ts.isIdentifier(n) && n.text === 'undefined') return true;
  if (ts.isCallExpression(n)) return isTranslateCallee(n.expression);
  if (ts.isConditionalExpression(n)) return isSafeFallback(n.whenTrue) && isSafeFallback(n.whenFalse);
  return false;
}

function propertyName(prop) {
  const name = prop.name;
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

/** Η `defaultValue` ενός αντικειμένου επιλογών, αν υπάρχει: `{ node, expr }` (expr = η τιμή). */
function defaultValueOf(objectLiteral) {
  for (const prop of objectLiteral.properties) {
    if (propertyName(prop) !== OPTION_NAME) continue;
    if (ts.isPropertyAssignment(prop)) return { node: prop, expr: prop.initializer };
    if (ts.isShorthandPropertyAssignment(prop)) return { node: prop, expr: prop.name };
  }
  return null;
}

function scriptKindOf(fileName) {
  return /\.tsx$/i.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/** Τα ευρήματα μίας κλήσης (0 ή περισσότερα — ένα ανά αντικείμενο επιλογών). */
function findingsOfCall(call, sf) {
  const out = [];
  for (const arg of call.arguments) {
    const a = unwrap(arg);
    if (!ts.isObjectLiteralExpression(a)) continue;
    const dv = defaultValueOf(a);
    if (!dv || isSafeFallback(dv.expr)) continue;
    const { line } = sf.getLineAndCharacterOfPosition(dv.node.getStart(sf));
    out.push({ line: line + 1, text: dv.node.getText(sf).replace(/\s+/g, ' ').slice(0, 120) });
  }
  return out;
}

/**
 * Όλα τα ευρήματα ενός αρχείου πηγής.
 * @param {string} source  το κείμενο
 * @param {string} fileName  χρειάζεται ΜΟΝΟ για να διαλεχτεί TS ή TSX
 * @returns {{line:number, text:string}[]}
 */
function findRawFallbacks(source, fileName) {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKindOf(fileName));
  const found = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && isTranslateCallee(node.expression)) found.push(...findingsOfCall(node, sf));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

module.exports = { findRawFallbacks, isTranslateCallee, isSafeFallback, TRANSLATE_IDENTIFIER };
