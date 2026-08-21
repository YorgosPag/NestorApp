#!/usr/bin/env node
/**
 * =============================================================================
 * ADR-744 / ADR-777 §8.39 — «ΠΟΙΟΣ ΠΙΝΑΚΑΣ ΚΛΕΙΔΙΩΝ ΥΠΑΡΧΕΙ, ΚΑΙ ΤΙ ΠΕΡΙΕΧΕΙ;»
 * =============================================================================
 *
 * Δεύτερη διάσπαση **κατά ευθύνη** (N.7.1): το `constant-resolution.js` έφτασε τις
 * **535** γραμμές κρατώντας **δύο** ερωτήματα.
 *
 * | Αρχείο | Ερώτημα |
 * |---|---|
 * | `constant-resolution.js` | «τι **ΤΙΜΗ** έχει αυτό το όνομα;» — σταθερές · templates · λεξιλογική εμβέλεια |
 * | **αυτό** | «ποιος **ΠΙΝΑΚΑΣ** κλειδιών υπάρχει, και τι περιέχει;» — μητρώο · module · κλειστότητα |
 *
 * ⚠️ **Η εξάρτηση είναι ΜΟΝΟΔΡΟΜΗ**: οι πίνακες ζητούν εμβέλεια (για τιμές `template`
 * μέσα τους), η εμβέλεια **δεν** ζητά πίνακες. Κυκλική εξάρτηση εδώ θα σήμαινε ότι η
 * διάσπαση δεν ήταν κατά ευθύνη αλλά κατά μέγεθος.
 *
 * ⚠️ **ΚΑΜΙΑ ΑΛΛΑΓΗ ΣΥΜΠΕΡΙΦΟΡΑΣ** — μετακόμιση αυτούσιων συναρτήσεων. Απόδειξη: τα
 * παραγόμενα artifacts **byte προς byte αμετάβλητα** και οι 101 άγκυρες πράσινες.
 *
 * @module scripts/lib/i18n-shell-slice/key-tables
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const {
  makeConstantScope,
  expandTemplate,
  forEachModuleConstant,
} = require('./constant-resolution');

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
  resolveAccessChain,
  looksLikeKeyTable,
  collectExportedTables,
  lookupTable,
  collectLocalConstants,
  harvestPropertyValues,
  leavesUnder,
};
