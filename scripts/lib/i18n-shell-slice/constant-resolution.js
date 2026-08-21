#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 / ADR-777 §8.37 — «ΤΙ ΤΙΜΕΣ ΜΠΟΡΕΙ ΝΑ ΕΧΕΙ ΑΥΤΟ ΤΟ ΟΝΟΜΑ;»
 * =============================================================================
 *
 * Εξήχθη από το `key-extract.js` (**751 γραμμές**, N.7.1) — **κατά ΕΥΘΥΝΗ, όχι κατά
 * μέγεθος**: εδώ ζει μόνο η **επίλυση τιμών** (σταθερές · πίνακες · templates ·
 * λεξιλογική εμβέλεια). Το «**ποιο κλειδί ζητά αυτή η κλήση `t()`;**» είναι
 * **άλλο ερώτημα** και μένει στο `key-extract.js`.
 *
 * ⚠️ **ΚΑΜΙΑ ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ ΣΤΗ ΜΕΤΑΚΟΜΙΣΗ** — οι συναρτήσεις μετακινήθηκαν
 * αυτούσιες. Η απόδειξη είναι τα παραγόμενα artifacts: **byte προς byte αμετάβλητα**.
 *
 * @module scripts/lib/i18n-shell-slice/constant-resolution
 */

'use strict';

const ts = require('typescript');

// ⚠️ Φορτώνεται ΤΕΜΠΕΛΙΚΑ: το `key-tables` εισάγει από εδώ (`makeConstantScope`), οπότε
// μια εισαγωγή στην κορυφή θα ήταν κύκλος. Η κλήση γίνεται αφού και τα δύο modules
// έχουν αποτιμηθεί, άρα το `require` εδώ είναι απλώς αναβολή, όχι κρυφή εξάρτηση.
const tablesModule = () => require('./key-tables');

// ─── Key-constant SSoTs (e.g. src/config/notification-keys.ts) ────────────────







/**
 * Module-level `const NAME = { … }` object literals in the file being analysed.
 *
 * WHY: `t(PHOTO_TYPE_I18N_MAP[photoType] ?? 'photoPreview.titles.photo')` is a
 * local lookup table, not a registered SSoT, and it is a common enough shape
 * that sending it to the manual escape hatch would make the hatch the norm. The
 * table is right there in the AST — read it.
 */
/**
 * `visit(name, initializer)` for every module-level `const NAME = …`, with `as const`
 * already unwrapped.
 *
 * Εξήχθη γιατί το **CHECK 3.28 το έπιασε ως κλώνο μέσα στο ίδιο commit** (ADR-777
 * §8.36): οι δύο συλλέκτες σταθερών έγραφαν το ίδιο επτάγραμμο πρόλογο. Ίδια
 * ερώτηση («ποιες είναι οι σταθερές αυτού του module;»), μία απάντηση.
 */
function forEachModuleConstant(source, visit) {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = ts.isAsExpression(decl.initializer) ? decl.initializer.expression : decl.initializer;
      visit(decl.name.text, init);
    }
  }
}


/**
 * Είναι αυτός ο κόμβος **λεξιλογική εμβέλεια**; (αρχείο ή οτιδήποτε με σώμα συνάρτησης)
 *
 * Ένα μπλοκ `if`/`for` **δεν** είναι: το `const` του είναι μεν block-scoped, αλλά καμία
 * `t()` έξω από το μπλοκ δεν μπορεί να το διαβάσει, οπότε η συμπερίληψή του στη σκάλα
 * της συνάρτησης είναι υπερ-συλλογή **προς την ασφαλή κατεύθυνση** — και μας γλιτώνει
 * από ένα δεύτερο επίπεδο εμβέλειας που κανένα μετρημένο αρχείο δεν χρειάζεται.
 */
function isScopeNode(node) {
  return ts.isSourceFile(node)
    || ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node);
}

/** `const NAME = 'lit'` ή `` const NAME = `tpl` `` — με το `as const` ήδη ξετυλιγμένο. */
function readConstantDeclaration(decl) {
  if (!ts.isIdentifier(decl.name) || !decl.initializer) return null;
  const init = ts.isAsExpression(decl.initializer) ? decl.initializer.expression : decl.initializer;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
    return { name: decl.name.text, entry: { literal: init.text } };
  }
  if (ts.isTemplateExpression(init)) return { name: decl.name.text, entry: { template: init } };
  return null;
}

/** Οι δηλώσεις **αυτής** της εμβέλειας — χωρίς κατάβαση σε φωλιασμένη συνάρτηση. */
function collectScopeDeclarations(scopeNode) {
  const out = new Map();
  const walk = (node) => {
    if (isScopeNode(node)) return;            // άλλη εμβέλεια — δική της σκάλα
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const read = readConstantDeclaration(decl);
        if (read) out.set(read.name, read.entry);
        // 🔴 ADR-777 §8.39 — ΚΑΙ Ο ΩΜΟΣ ΑΡΧΙΚΟΠΟΙΗΤΗΣ, για το σκαλί του
        // αναγνωριστικού: `const key = \`ns:ρίζα.${x}\`; … t(key)`. Η τιμή δεν λύνεται
        // (το `x` είναι χρόνου εκτέλεσης), αλλά το **στατικό πρόθεμα** λύνεται — και
        // πριν από αυτό η κλήση έπεφτε ολόκληρη στο `unresolved`, δηλαδή ο generator
        // αρνιόταν route slice για μια κλήση που **δηλώνει** το πρόθεμά της.
        else if (ts.isIdentifier(decl.name) && decl.initializer) {
          out.set(decl.name.text, { node: decl.initializer });
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(scopeNode, walk);
  return out;
}

/**
 * `const NAME = 'literal'` **και** `` const NAME = `${OTHER}:suffix` ``, λυμένα
 * **μεταβατικά** και **κατά ΛΕΞΙΛΟΓΙΚΗ ΕΜΒΕΛΕΙΑ**.
 *
 * 🔴 WHY — MEASURED, ADR-777 §8.36. All **76** unresolved calls that made the
 * generator refuse a route slice for the three property forms had ONE shape:
 *
 *     const NS = 'search-results';
 *     const K  = `${NS}:mandate.office`;
 *     …t(`${K}.newTitle`)
 *
 * Not one of them is dynamic. Every part is a constant with a literal at the
 * bottom — the call `t(\`${K}.newTitle\`)` denotes exactly
 * `search-results:mandate.office.newTitle` and nothing else.
 *
 * 🔴 **ΚΑΙ Η ΜΙΣΗ ΔΙΟΡΘΩΣΗ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ (§8.36 βήμα 3).** Η πρώτη γραφή διάβαζε
 * **μόνο** module scope, οπότε το ίδιο ακριβώς σχήμα **ένα επίπεδο μέσα** —
 * `` const K = `${NS}:demand.form.features` `` μέσα στο component — έμενε «ανεπίλυτο»:
 * **32 από τις 45** κλήσεις που εμπόδιζαν το route slice του `/demands/new`, σε
 * **τέσσερα** αρχεία. Ο λόγος που δεν λύθηκε με `dynamicKeyPolicy` είναι γραμμένος στο
 * `config.js`: μια χειρόγραφη λίστα εκεί κάνει **την έξοδο διαφυγής κανόνα**, και
 * αποκλίνει σιωπηλά (CHECK 3.34, απόκλιση 63).
 *
 * ⚠️ **Η ΕΜΒΕΛΕΙΑ ΕΙΝΑΙ ΤΟ ΟΛΟ ΖΗΤΗΜΑ, ΟΧΙ ΛΕΠΤΟΜΕΡΕΙΑ.** Ένας **επίπεδος** πίνακας
 * ονομάτων θα ανακάτευε δύο αδελφά components που **και τα δύο** ονομάζουν `K` το
 * πρόθεμά τους — και θα απέδιδε στην κλήση του ενός **το κλειδί του άλλου**: όχι
 * «λιγότερα κλειδιά», αλλά **λάθος κλειδιά, σιωπηλά**. Εσωτερική εμβέλεια νικά·
 * η αναζήτηση ανεβαίνει τη σκάλα μόνο όταν το όνομα δεν δηλώνεται εδώ. Άγκυρα `Γ12`.
 *
 * ⚠️ **Τεμπέλικη με μνήμη και φρουρό κύκλου** αντί για σταθερό σημείο: η σειρά δήλωσης
 * δεν είναι εγγύηση (hoisting, αναδιάταξη), και ένας κύκλος **σταματά** να λύνεται αντί
 * να κρεμάει.
 *
 * ⚠️ **Μια σταθερά που δεν λύνεται ΠΛΗΡΩΣ δεν καταγράφεται.** Μισή τιμή είναι μαντεψιά,
 * και μια μαντεψιά εδώ στέλνει λάθος κλειδιά — σιωπηλά.
 *
 * @returns {{get: (name: string) => (string|undefined)}} η σκάλα, ρωτημένη με `.get`
 *   — **ίδια διεπαφή με `Map`**, ώστε το {@link expandTemplate} να μη χρειάζεται να ξέρει
 *   αν του δόθηκε πίνακας ή εμβέλεια.
 */
function makeConstantScope(scopeNode, parent) {
  const declarations = collectScopeDeclarations(scopeNode);
  const memo = new Map();
  const visiting = new Set();
  const scope = {
    /**
     * **Ο ωμός αρχικοποιητής** ενός ονόματος — για το σκαλί του αναγνωριστικού.
     *
     * ⚠️ Επιστρέφει **κόμβο AST**, όχι τιμή: η τιμή μπορεί να μη λύνεται (`${x}`) και
     * παρ' όλα αυτά η **κλήση** να δηλώνει χρήσιμο πρόθεμα. Δύο διαφορετικές ερωτήσεις,
     * δύο μέθοδοι — το `get` δεν επιτρέπεται να αρχίσει να επιστρέφει «μισά».
     */
    initializerOf(name) {
      const entry = declarations.get(name);
      if (entry === undefined) return parent ? parent.initializerOf(name) : undefined;
      if (entry.node !== undefined) return entry.node;
      return entry.template;   // literal-only δηλώσεις τις λύνει ήδη το `get`
    },
    /**
     * «Λύνεται αυτό το όνομα από εδώ;» — **ίδια σημασία** με το `Map.has` που αυτή η
     * εμβέλεια αντικατέστησε: ό,τι δεν λύνεται ΠΛΗΡΩΣ δεν καταγράφεται, άρα δεν υπάρχει.
     * Υπάρχει ώστε οι άγκυρες `Γ4`/`Γ5` να κρίνουν την **ίδια** ερώτηση με πριν.
     */
    has(name) {
      return scope.get(name) !== undefined;
    },
    get(name) {
      if (memo.has(name)) return memo.get(name);
      const entry = declarations.get(name);
      if (entry === undefined) return parent ? parent.get(name) : undefined;
      if (visiting.has(name)) return undefined;
      visiting.add(name);
      let value;
      if (entry.literal !== undefined) {
        value = entry.literal;
      } else if (entry.template !== undefined) {
        const expanded = expandTemplate(entry.template, scope);
        value = expanded.complete ? expanded.text : undefined;
      } else {
        // ⚠️ Καταχώριση **μόνο για το σκαλί αναγνωριστικού** (ωμός κόμβος AST): δεν έχει
        // ΤΙΜΗ. Επιστρέφει `undefined` και **δεν** ανεβαίνει στον γονέα — το όνομα είναι
        // δηλωμένο **εδώ**, άρα σκιάζει· μια αναζήτηση στον γονέα θα έδινε την τιμή
        // ΑΛΛΗΣ σταθεράς με το ίδιο όνομα (ακριβώς το σφάλμα που η εμβέλεια αποτρέπει).
        value = undefined;
      }
      visiting.delete(name);
      memo.set(name, value);
      return value;
    },
  };
  return scope;
}

/** Η εμβέλεια **module** ενός αρχείου — η βάση της σκάλας. */
function collectStringConstants(source) {
  return makeConstantScope(source, null);
}

/**
 * Rebuilds a template literal from a constant table.
 *
 * Returns `{ text, complete }`: `complete` is true only when EVERY `${…}` was a
 * known constant. When it is false, `text` is the statically knowable head —
 * everything up to the first hole — which is still strictly more than the raw
 * `head` the caller had before (for `` `${K}.notify.${kind}` `` the raw head is
 * the empty string, i.e. nothing at all).
 */
function expandTemplate(node, constants) {
  let text = node.head.text;
  for (const span of node.templateSpans) {
    const name = ts.isIdentifier(span.expression) ? span.expression.text : null;
    const value = name === null ? undefined : constants.get(name);
    if (value === undefined) return { text, complete: false };
    text += value + span.literal.text;
  }
  return { text, complete: true };
}

/**
 * Every string ONE `${…}` hole can hold, or `null` when unknowable.
 *
 * 🔴 ADR-777 §8.36 βήμα 1 — ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ, Η ΙΔΙΑ ΑΠΑΝΤΗΣΗ. Το
 * `t(PROPERTY_TYPE_I18N_KEYS[type])` το λύνει ήδη το {@link classifyConstantAccess}
 * («υπολογισμένος δείκτης ⇒ κάθε τιμή του πίνακα»)· το
 * `` t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[type]}`) `` — **η ίδια πρόσβαση,
 * μέσα σε template** — έπεφτε στο `unresolved`, επειδή το {@link expandTemplate}
 * δέχεται μόνο `ts.isIdentifier`. Δύο απαντήσεις στο ίδιο ερώτημα είναι το σχήμα που
 * το ADR-749 απαγορεύει· εδώ ρωτούν πλέον την ίδια αυθεντία.
 *
 * ⚠️ Επιστρέφει `null` (και όχι `[]`) για «δεν ξέρω»: ένας πίνακας χωρίς φύλλα κάτω
 * από τη διαδρομή **δεν** σημαίνει «καμία τιμή» — σημαίνει ότι δεν τον διαβάσαμε.
 * Κενή λίστα θα παρήγαγε **κενό καρτεσιανό γινόμενο**, δηλαδή «η κλήση δεν ζητά
 * κανένα κλειδί»: πράσινο και λάθος.
 */
function spanValues(expression, ctx) {
  if (ts.isIdentifier(expression)) {
    const value = ctx.constants.get(expression.text);
    if (value !== undefined) return [value];
    // 🔴 ADR-777 §8.39 — ΤΟ ΙΔΙΟ ΣΚΑΛΙ ΜΕ ΤΟ `classifyArgument`, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΙΝΑΙ ΕΔΩ.
    // `const key = TABLE[x]; … t(\`ns:${key}\`)` — το όνομα δεν έχει **τιμή** (ο
    // δείκτης είναι χρόνου εκτέλεσης) αλλά έχει **σύνολο τιμών**: τα φύλλα του πίνακα.
    // Χωρίς αυτό, μια ενδιάμεση μεταβλητή άλλαζε την απάντηση — το σχήμα ADR-749.
    const initializer = ctx.constants.initializerOf(expression.text);
    if (initializer === undefined) return null;
    if (ctx.resolvingNames && ctx.resolvingNames.has(expression.text)) return null;
    if (ctx.resolvingNames) ctx.resolvingNames.add(expression.text);
    const nested = spanValues(initializer, ctx);
    if (ctx.resolvingNames) ctx.resolvingNames.delete(expression.text);
    return nested;
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    const access = tablesModule().resolveAccessChain(expression);
    const table = access === null ? null : tablesModule().lookupTable(ctx, access.root);
    if (!table) return null;
    const leaves = access.wildcard ? [...table.values()] : leavesUnder(table, access.path);
    return leaves.length > 0 ? leaves : null;
  }
  return null;
}

/**
 * Κάθε κλειδί που μπορεί να δηλώσει ΕΝΑ template — καρτεσιανό γινόμενο πάνω στις τρύπες.
 *
 * Επιστρέφει `{ texts, head, complete }`. Το `head` είναι το **στατικά γνωστό
 * πρόθεμα**: παγώνει στην πρώτη τρύπα που είτε δεν λύθηκε είτε λύθηκε σε
 * **περισσότερες από μία** τιμές — γιατί μετά από διακλάδωση δεν υπάρχει ΕΝΑ
 * πρόθεμα, και το να επιστρέψεις το πρώτο κλαδί θα ήταν μαντεψιά με σχήμα γεγονότος.
 *
 * ⚠️ Η κατεύθυνση είναι **fail-safe προς τα πάνω**: ένας πίνακας 14 ετικετών κοστίζει
 * 14 συμβολοσειρές, μια χαμένη κοστίζει **ωμό κλειδί στην οθόνη**.
 */
function expandTemplateKeys(node, ctx) {
  let texts = [node.head.text];
  let head = node.head.text;
  let forked = false;
  for (const span of node.templateSpans) {
    const values = spanValues(span.expression, ctx);
    if (values === null) return { texts: null, head, complete: false };
    if (values.length > 1) forked = true;
    texts = texts.flatMap(text => values.map(value => text + value + span.literal.text));
    if (!forked) head = texts[0];
  }
  return { texts, head, complete: true };
}



module.exports = {
  isScopeNode,
  readConstantDeclaration,
  collectScopeDeclarations,
  makeConstantScope,
  collectStringConstants,
  expandTemplate,
  spanValues,
  expandTemplateKeys,
  forEachModuleConstant,
};
