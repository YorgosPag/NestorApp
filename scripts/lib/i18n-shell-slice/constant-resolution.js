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

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// ─── Key-constant SSoTs (e.g. src/config/notification-keys.ts) ────────────────

/** Folds an object-literal AST into dottedPath → string leaf. Non-literal values are skipped. */
function foldObjectLiteral(node, prefix, out, scope) {
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (name === null) continue;
    const dotted = prefix ? `${prefix}.${name}` : name;
    const init = prop.initializer;
    if (ts.isObjectLiteralExpression(init)) {
      foldObjectLiteral(init, dotted, out, scope);
    } else if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
      out.set(dotted, init.text);
    } else if (scope !== undefined && ts.isTemplateExpression(init)) {
      // 🔴 ADR-777 §8.39 — Η ΙΔΙΑ ΑΛΥΣΙΔΑ ΣΤΑΘΕΡΩΝ, ΕΝΑ ΕΠΙΠΕΔΟ ΠΙΟ ΜΕΣΑ.
      // Το κυρίαρχο ιδίωμα είναι `const K = 'ns:ρίζα'; export const KEYS = { title: `${K}.title` }`
      // — ολόκληρος ο κατάλογος εντολών γράφεται έτσι. Χωρίς αυτό ο πίνακας
      // γίνεται **κενός** και οι 37 κλήσεις της σελίδας μένουν ανεπίλυτες.
      // ⚠️ Μόνο όταν ολοκληρώνει — μισή τιμή δεν καταγράφεται (§8.36).
      const expanded = expandTemplate(init, scope);
      if (expanded.complete) out.set(dotted, expanded.text);
    }
  }
  return out;
}

/**
 * Reads the registered key-constant modules into `name → Map<dottedPath, key>`.
 * These constants exist precisely so keys are not hardcoded at call sites
 * (`src/config/notification-keys.ts`, `.ssot-registry.json → notification-keys`);
 * without this the shell would fall back to whole namespaces for every
 * notification hook it touches.
 *
 * @param {string} projectRoot
 * @param {Array<{file: string, exportName: string}>} specs
 */
function loadKeyConstants(projectRoot, specs) {
  const constants = new Map();
  for (const spec of specs) {
    const abs = path.join(projectRoot, spec.file);
    if (!fs.existsSync(abs)) continue;
    const source = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const decl of statement.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || decl.name.text !== spec.exportName) continue;
        const init = decl.initializer && ts.isAsExpression(decl.initializer)
          ? decl.initializer.expression
          : decl.initializer;
        if (init && ts.isObjectLiteralExpression(init)) {
          constants.set(spec.exportName, foldObjectLiteral(init, '', new Map()));
        }
      }
    }
  }
  return constants;
}

/**
 * Walks `NOTIFICATION_KEYS.files.upload` or `PHOTO_TYPE_I18N_MAP[photoType]`
 * back to its root identifier.
 *
 * `wildcard` marks a COMPUTED index: the call selects one of the table's values
 * but which one is a runtime decision, so every value under that point is a
 * possible key and all of them must travel. That is the fail-safe direction —
 * a map of 5 labels costs 5 strings, a missing one costs a raw key on screen.
 *
 * @returns {?{root: string, path: string, wildcard: boolean}}
 */
function resolveAccessChain(node) {
  const parts = [];
  let wildcard = false;
  let current = node;
  for (;;) {
    if (ts.isPropertyAccessExpression(current)) { parts.unshift(current.name.text); current = current.expression; continue; }
    if (ts.isElementAccessExpression(current)) {
      const index = current.argumentExpression;
      if (index && (ts.isStringLiteral(index) || ts.isNoSubstitutionTemplateLiteral(index))) parts.unshift(index.text);
      else wildcard = true;
      current = current.expression;
      continue;
    }
    break;
  }
  if (!ts.isIdentifier(current)) return null;
  return { root: current.text, path: parts.join('.'), wildcard };
}

/**
 * **Οι ΕΞΑΓΟΜΕΝΟΙ πίνακες σταθερών ενός module** — για να τους δει *άλλο* αρχείο.
 *
 * 🔴 ADR-777 §8.39 — ΤΟ ΚΕΝΟ ΠΟΥ ΕΚΛΕΙΣΕ, ΜΕ ΑΡΙΘΜΟ. Ο κατάλογος εντολών γράφει
 * `t(CATALOG_KEYS.empty)` και το `CATALOG_KEYS` ζει στο `mandate-catalog-labels.ts`:
 * ο generator έβλεπε **ρίζα που δεν είναι σε κανέναν πίνακα** και δήλωνε **37**
 * ανεπίλυτες κλήσεις σε μία σελίδα — δηλαδή **αρνιόταν** route slice και η οθόνη
 * έμενε χωρίς λέξεις.
 *
 * 🔑 **Είναι η ΓΕΝΙΚΕΥΣΗ του `keyConstants`, όχι δεύτερος μηχανισμός.** Το μητρώο
 * (`config.js`) είναι **χειρόγραφη** λίστα δύο αρχείων· εδώ η ίδια ερώτηση απαντιέται
 * για **κάθε** module της κλειστότητας, χωρίς να γράψει κανείς λίστα. Το μητρώο μένει
 * γιατί έχει **προτεραιότητα** (ρητή δήλωση SSoT) και γιατί καλύπτει και αρχεία εκτός
 * κλειστότητας.
 *
 * ⚠️ **Μόνο `export`** — μια ιδιωτική σταθερά δεν μπορεί να διαβαστεί από αλλού, άρα
 * η συμπερίληψή της θα έλυνε κλήσεις που στην πραγματικότητα **δεν** μπορούν να
 * υπάρξουν, κρύβοντας πραγματικά σφάλματα.
 */
/**
 * **Είναι αυτός ο πίνακας λεξιλόγιο i18n;** — όλα τα φύλλα μοιάζουν με κλειδιά;
 *
 * 🔴 **ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΨΕΥΔΕΣ ΚΛΕΙΔΙ ΠΟΥ ΕΦΤΑΣΕ ΣΤΗΝ ΑΓΚΥΡΑ.** Η πρώτη γραφή ινδεξοδοτούσε
 * **κάθε** εξαγόμενο αντικείμενο με συμβολοσειρές — και το `config/jobs-registry.ts` εξάγει
 * `JOBS = { site: { id: 'site', … } }`, που **δεν είναι λεξιλόγιο**. Το φύλλο `'site'`
 * μπήκε στα κλειδιά του κελύφους και το έπιασε το `shell-slice-no-raw-keys` («*το μήνυμα
 * αποτυχίας ΕΙΝΑΙ η συμβολοσειρά που θα έβλεπε ο χρήστης*»).
 *
 * ⚠️ **Η υπερ-συλλογή ΔΕΝ είναι αθώα εδώ**, σε αντίθεση με το `harvestPropertyValues`:
 * εκεί ένα άσχετο string πετιέται στο κλάδεμα, εδώ καταγράφεται ως **κλειδί που
 * το κέλυφος οφείλει να λύνει**. Γι' αυτό το κριτήριο είναι **ΟΛΑ τα φύλλα** και όχι
 * «μερικά»: ένας πίνακας με μισά κλειδιά και μισά αναγνωριστικά είναι αναγνωριστικά.
 *
 * ⚠️ **Fail-closed**: πίνακας που δεν περνά απλώς **δεν ινδεξοδοτείται** ⇒ η κλήση
 * μένει ανεπίλυτη ⇒ ο generator **αρνείται**. Θορυβώδης άρνηση, όχι σιωπηλό λάθος.
 */
function looksLikeKeyTable(folded) {
  for (const value of folded.values()) {
    if (!value.includes('.') && !value.includes(':')) return false;
  }
  return true;
}

function collectExportedTables(source) {
  const tables = new Map();
  const scope = makeConstantScope(source, null);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = (statement.modifiers || []).some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = ts.isAsExpression(decl.initializer) ? decl.initializer.expression : decl.initializer;
      if (!ts.isObjectLiteralExpression(init)) continue;
      const folded = foldObjectLiteral(init, '', new Map(), scope);
      if (folded.size > 0 && looksLikeKeyTable(folded)) tables.set(decl.name.text, folded);
    }
  }
  return tables;
}

/**
 * **Ο ΕΝΑΣ αναζητητής πίνακα**, με ρητή σειρά προτεραιότητας.
 *
 * ⚠️ Η σειρά **είναι** συμβόλαιο: το μητρώο (ρητή δήλωση) νικά· μετά ο **τοπικός**
 * πίνακας του αρχείου (πιο κοντά στην κλήση από οποιονδήποτε ξένο)· τελευταίοι οι
 * πίνακες της κλειστότητας. Δύο σημεία που ρωτούσαν με **διαφορετική** σειρά θα ήταν
 * δύο απαντήσεις στο ίδιο ερώτημα (ADR-749) — γι' αυτό ρωτούν και τα δύο **αυτήν**.
 */
function lookupTable(ctx, root) {
  return ctx.keyConstants.get(root)
    || ctx.localConstants.get(root)
    || (ctx.closureConstants ? ctx.closureConstants.get(root) : undefined);
}

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

function collectLocalConstants(source) {
  const tables = new Map();
  const scope = makeConstantScope(source, null);
  forEachModuleConstant(source, (name, init) => {
    if (!ts.isObjectLiteralExpression(init)) return;
    const folded = foldObjectLiteral(init, '', new Map(), scope);
    if (folded.size > 0) tables.set(name, folded);
  });
  return tables;
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
    const access = resolveAccessChain(expression);
    const table = access === null ? null : lookupTable(ctx, access.root);
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

/**
 * Harvests `propertyName → every string literal assigned to it` from all
 * module-level literals in the file (objects AND arrays, at any depth).
 *
 * WHY THIS RUNG EXISTS. The commonest unresolvable shape is not an opaque
 * variable — it is a config row walked by `.map()`:
 *
 *   const ACCOUNT_NAV = [{ href: …, labelKey: 'account.nav.profile' }, …]
 *   …ACCOUNT_NAV.map(item => <span>{t(item.labelKey)}</span>)
 *
 * `item` is a loop binding, so the access chain has no resolvable root and the
 * table lookup fails. But the answer is sitting in the same file: every value
 * `labelKey` can hold is a literal a few lines above. Asking "what strings does
 * this property ever hold here?" resolves it exactly.
 *
 * Over-collection is harmless by construction: a property that is not an i18n
 * key yields strings no locale defines, and `pruneNamespace` drops them. The
 * lookup only ever fires for a property that an actual `t()` call reads.
 */
function harvestPropertyValues(source) {
  const values = new Map();
  const remember = (name, text) => {
    if (!values.has(name)) values.set(name, new Set());
    values.get(name).add(text);
  };
  const walk = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      const init = node.initializer;
      if (name !== null && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))) {
        remember(name, init.text);
      }
    }
    ts.forEachChild(node, walk);
  };
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) walk(statement);
  }
  return values;
}

/** Every leaf at or below `dotted` — a call may reference a whole subtree. */
function leavesUnder(table, dotted) {
  const exact = table.get(dotted);
  if (exact !== undefined) return [exact];
  const prefix = `${dotted}.`;
  const out = [];
  for (const [key, value] of table) if (key.startsWith(prefix)) out.push(value);
  return out;
}

module.exports = {
  foldObjectLiteral,
  loadKeyConstants,
  collectExportedTables,
  looksLikeKeyTable,
  lookupTable,
  resolveAccessChain,
  forEachModuleConstant,
  collectLocalConstants,
  isScopeNode,
  readConstantDeclaration,
  collectScopeDeclarations,
  makeConstantScope,
  collectStringConstants,
  expandTemplate,
  spanValues,
  expandTemplateKeys,
  harvestPropertyValues,
  leavesUnder,
};
