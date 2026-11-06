/**
 * CHECK 3.115 — η κρίση του πληθυντικού ανά μήνυμα locale (καθαρές συναρτήσεις, χωρίς I/O).
 *
 * 🔑 **ΕΝΑΣ PARSER, Ο ΙΔΙΟΣ ΜΕ ΤΟΝ ΧΡΟΝΟ ΕΚΤΕΛΕΣΗΣ.** Το `i18next-icu` αποδίδει κάθε μήνυμα με
 *    `new IntlMessageFormat(res, lng, formats, { ignoreTag: true })`, και εκείνο αναλύει με το
 *    `@formatjs/icu-messageformat-parser` (2.11.4, δηλωμένο ρητά στο `package.json` στην ΙΔΙΑ
 *    έκδοση με το μεταβατικό). Ένας χειρόγραφος tokenizer θα ήταν δεύτερη μηχανή που διαφωνεί
 *    με την πρώτη σε απόστροφους, ένθετα σκέλη και ετικέτες (ADR-749: ΜΙΑ μηχανή).
 *
 * 🔑 **ΟΙ ΚΑΤΗΓΟΡΙΕΣ ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ.** Έρχονται από το CLDR μέσω
 *    `Intl.PluralRules(γλώσσα, { type }).resolvedOptions().pluralCategories` — την ίδια πηγή που
 *    ρωτά το `IntlMessageFormat` στον browser. Γλώσσα με `few`/`many` (πολωνικά, αραβικά) καλύπτεται
 *    χωρίς αλλαγή γραμμής. Το `eslint-plugin-formatjs/enforce-plural-rules` ζητά λίστα με το χέρι.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: η ποσότητα είναι το όρισμα `count` — η σύμβαση του i18next και του κώδικα
 *    (`t(k, { count })`). Ένα `{total}` ή `{n}` που μετρά ουσιαστικό **δεν** το βλέπει η πύλη.
 */

'use strict';

const { parse, TYPE } = require('@formatjs/icu-messageformat-parser');

/** Το όνομα του ορίσματος ποσότητας (σύμβαση i18next). */
const QUANTITY_ARG = 'count';

/** ⚠️ Κλειστό σύνολο, fail-closed: άγνωστη κατάσταση ⇒ `throw` με όνομα. */
const STATES = {
  BARE: 'bare-count',                     // 🔴 RATCHET — `{count}` έξω από `plural`/`select` του `count`
  MISSING_CATEGORY: 'missing-category',   // ⛔ `plural` χωρίς κατηγορία CLDR της γλώσσας του
  FOREIGN_CATEGORY: 'foreign-category',   // ⛔ κατηγορία που η γλώσσα δεν επιλέγει ΠΟΤΕ (νεκρό σκέλος)
  UNPARSABLE: 'unparsable',               // ⛔ ο χρόνος εκτέλεσης δείχνει το ΩΜΟ κείμενο
  DECLARED: 'declared-invariant',         // ✅ δηλωμένο αμετάβλητο, με λόγο
  PLURAL: 'plural',                       // ✅
};

/** Οι κατηγορίες που μπλοκάρουν ΧΩΡΙΣ baseline — δεν υπάρχει «λιγότερα νεκρά σκέλη από χθες». */
const ZERO_TOLERANCE = [STATES.MISSING_CATEGORY, STATES.FOREIGN_CATEGORY, STATES.UNPARSABLE];

const categoryCache = new Map();

/** Οι κατηγορίες CLDR της γλώσσας — `cardinal` (`plural`) ή `ordinal` (`selectordinal`). */
function pluralCategories(lang, type) {
  const key = `${lang}|${type}`;
  if (!categoryCache.has(key)) {
    const supported = Intl.PluralRules.supportedLocalesOf([lang]);
    if (!supported.length) throw new Error(`CHECK 3.115 — το Intl δεν γνωρίζει τη γλώσσα «${lang}»`);
    categoryCache.set(key, new Set(new Intl.PluralRules(lang, { type }).resolvedOptions().pluralCategories));
  }
  return categoryCache.get(key);
}

/** Έλεγχος των σκελών ενός `plural` απέναντι στο CLDR της γλώσσας. `=N` είναι ακριβής τιμή, όχι κατηγορία. */
function judgeBranches(node, lang, findings) {
  const required = pluralCategories(lang, node.pluralType);
  const present = Object.keys(node.options).filter((k) => !k.startsWith('='));
  const missing = [...required].filter((c) => !present.includes(c));
  const foreign = present.filter((c) => !required.has(c));
  if (missing.length) findings.push({ state: STATES.MISSING_CATEGORY, detail: `{${node.value}, ${node.pluralType}} χωρίς: ${missing.join(', ')}` });
  if (foreign.length) findings.push({ state: STATES.FOREIGN_CATEGORY, detail: `{${node.value}} με κατηγορία που η «${lang}» δεν επιλέγει: ${foreign.join(', ')}` });
}

/** Αναδρομή στο AST· `guarded` = βρισκόμαστε μέσα σε `plural`/`select` του ορίσματος ποσότητας. */
function walk(nodes, lang, guarded, findings) {
  for (const node of nodes) {
    if ((node.type === TYPE.argument || node.type === TYPE.number) && node.value === QUANTITY_ARG && !guarded) {
      findings.push({ state: STATES.BARE, detail: `{${QUANTITY_ARG}} χωρίς πληθυντικό ICU` });
    } else if (node.type === TYPE.plural) {
      judgeBranches(node, lang, findings);
      const inner = guarded || node.value === QUANTITY_ARG;
      for (const option of Object.values(node.options)) walk(option.value, lang, inner, findings);
    } else if (node.type === TYPE.select) {
      const inner = guarded || node.value === QUANTITY_ARG;
      for (const option of Object.values(node.options)) walk(option.value, lang, inner, findings);
    } else if (node.type === TYPE.tag) {
      walk(node.children, lang, guarded, findings);
    }
  }
}

/**
 * Τα ευρήματα ενός μηνύματος. Κενός πίνακας = τίποτα να πει η πύλη (το μήνυμα δεν μετρά ή είναι σωστό).
 * Το `plural` χωρίς εύρημα επιστρέφεται ως `{ state: PLURAL }` για τη λογιστική.
 */
function judgeMessage(text, lang) {
  // Πρόφιλτρο ΧΩΡΙΣ απώλεια: κάθε εύρημα απαιτεί ICU όρισμα, άρα `{`.
  if (!text.includes('{')) return [];
  let ast;
  try {
    ast = parse(text, { ignoreTag: true });   // ⚠️ ΟΙ ΡΥΘΜΙΣΕΙΣ ΤΟΥ `i18next-icu` — όχι οι προεπιλογές
  } catch (e) {
    return [{ state: STATES.UNPARSABLE, detail: `${e.message} — η οθόνη δείχνει το ωμό κείμενο` }];
  }
  const findings = [];
  walk(ast, lang, false, findings);
  if (findings.length) return findings;
  return /\{\s*\w+\s*,\s*(plural|selectordinal)\s*,/.test(text) ? [{ state: STATES.PLURAL, detail: '' }] : [];
}

/** Κάθε φύλλο συμβολοσειράς ενός locale JSON, ως `[κλειδί με τελείες, κείμενο]`. */
function leafMessages(tree, prefix = '', out = []) {
  if (typeof tree === 'string') { out.push([prefix, tree]); return out; }
  if (tree && typeof tree === 'object') {
    for (const [k, v] of Object.entries(tree)) leafMessages(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

/** Η ταυτότητα ενός μηνύματος: `<γλώσσα>/<namespace>:<κλειδί>`. */
function messageId(lang, ns, key) {
  return `${lang}/${ns}:${key}`;
}

module.exports = { STATES, ZERO_TOLERANCE, QUANTITY_ARG, judgeMessage, leafMessages, messageId, pluralCategories };
