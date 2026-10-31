/**
 * CHECK 3.108 (ADR-280 §11) — «τι ΜΠΟΡΕΙ να ζητήσει αυτό το αρχείο από τη λίστα namespaces του;»
 *
 * 🔑 ΜΙΑ απάντηση, όχι δεύτερη: ο ταξινομητής AST του shell slice (ADR-744, `key-extract.js`) — literals, ternaries,
 * στατικά προθέματα, σταθερές-κλειδιά. Εδώ προστίθενται μόνο τα δύο που η απόδειξη ισοδυναμίας χρειάζεται και ο
 * ταξινομητής δεν ρωτά:
 *   · **διαφυγή του `t`** — όρισμα, prop, επιστροφή (`<Row t={t} />`, `format(t, x)`): ο παραλήπτης ζητά κλειδιά που
 *     αυτό το αρχείο δεν βλέπει ⇒ «τα πάντα». Μετρήθηκε ότι συμβαίνει· χωρίς αυτό η απόδειξη θα ήταν ψευδώς πράσινη.
 *   · **`returnObjects`** — μόνο τότε ένας κόμβος-αντικείμενο είναι αποτέλεσμα με νόημα.
 * Ανεπίλυτη κλήση ή κλήση με `defaultValue` ⇒ «τα πάντα» (ποτέ μαντεψιά).
 *
 * @module scripts/lib/i18n-namespace-family/request
 */
'use strict';

const ts = require('typescript');

const { parseSource, classifyParsedCalls, collectTranslateAliases } = require('../i18n-shell-slice/key-extract');

/** Θέσεις όπου ένα alias του `t` ΔΕΝ διαφεύγει: κλήση, δήλωση, αποδόμηση, όνομα ιδιότητας. */
function isInertUse(node) {
  const p = node.parent;
  if (ts.isCallExpression(p) && p.expression === node) return true;
  if (ts.isBindingElement(p) || ts.isVariableDeclaration(p)) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return true;
  if (ts.isPropertyAssignment(p) && p.name === node) return true;
  return ts.isShorthandPropertyAssignment(p) && ts.isObjectBindingPattern(p.parent);
}

/** Διαφεύγει κάποιο alias του `t` ως ΤΙΜΗ; (εξαρτήσεις hooks — `[t]`, `useMemo(…, [t])` — μετρούν: συντηρητικά.) */
function translatorEscapes(source, aliases) {
  let escaped = false;
  const visit = (node) => {
    if (escaped) return;
    if (ts.isIdentifier(node) && aliases.has(node.text) && !isInertUse(node)) {
      const p = node.parent;
      // `[t]` ως πίνακας εξαρτήσεων hook δεν παραδίδει τον μεταφραστή σε κανέναν.
      if (!(ts.isArrayLiteralExpression(p) && ts.isCallExpression(p.parent) && p.parent.arguments.at(-1) === p)) escaped = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return escaped;
}

/** @returns {{all: boolean, objects: boolean, keys: {ns: ?string, key: string}[], prefixes: {ns: ?string, key: string}[]}} */
function requestOf(content, file) {
  const source = parseSource(file, content);
  const r = classifyParsedCalls(source, {});
  const pick = ({ ns, key }) => ({ ns, key });
  return {
    all: r.unresolved.length > 0 || r.defaulted > 0 || translatorEscapes(source, collectTranslateAliases(source)),
    objects: /\breturnObjects\b/.test(content),
    keys: r.keys.map(pick),
    prefixes: r.prefixes.map(pick),
  };
}

module.exports = { requestOf, translatorEscapes };
