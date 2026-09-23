'use strict';
/**
 * =============================================================================
 * Κ2 — ΑΠΟ ΠΟΥ ΕΡΧΕΤΑΙ ΤΟ ΔΑΝΕΙΚΟ `t`  (CHECK 3.51 Κ2 · ADR-781 §16)
 * =============================================================================
 *
 * Ο Κ2 κρίνει ένα `t('κλειδί')` μόνο αν ξέρει **με βεβαιότητα** σε ποια namespaces θα
 * ψάξει το i18next. Μέχρι τώρα η βεβαιότητα ερχόταν **μόνο** από `useTranslation(...)`
 * στο ΙΔΙΟ αρχείο — άρα ένα component που γράφει
 *
 *     const { t, onNavigate } = useSidebarLinkBehavior()   // το hook δηλώνει 'navigation'
 *
 * έπεφτε στο `namespace-injected` (δηλωμένο κενό) και **κανένα** κλειδί του δεν κρινόταν.
 * Έτσι κοκκίνισαν τα Μ8/Μ9 όταν το `sidebar-menu-item.tsx` μετακόμισε το `t` σε hook
 * (`3a7699f1`): ο μετρητής **της πύλης** είχε τυφλωθεί, όχι το test.
 *
 * 🔑 ΜΙΑ ΚΑΤΕΥΘΥΝΣΗ, ΕΝΑ ΒΗΜΑ, ΜΙΑ ΔΗΛΩΣΗ — αλλιώς άρνηση (όχι μαντεψιά):
 *   - **προς τα κάτω μόνο** (hook που εισάγω). Το `t` ως **παράμετρος/prop** ανήκει
 *     στους καλούντες — πολλοί, με άλλα ns — και μένει `namespace-injected` (βλ.
 *     `photo-preview-helpers.ts`). Ο builder (ADR-744 §18) κληρονομεί ανεύθυντα γιατί
 *     εκεί η υπερ-απόδοση είναι δωρεάν· σε **επαληθευτή** ένα υπερσύνολο υποψηφίων
 *     θα έλεγε «απαντά» για κλειδί που ο runtime **δεν** βρίσκει.
 *   - το hook πρέπει να **παραδίδει** `t` (`return { t, … }`) και να έχει **ακριβώς
 *     ΜΙΑ** κλήση `useTranslation(...)` — δύο κλήσεις ⇒ ποιο `t` επιστρέφεται; άρνηση.
 *   - αλυσίδα hooks ⇒ άρνηση (χωρίς σταθερό σημείο — ίδια αρχή με το §18).
 *
 * Επαναχρησιμοποιεί: `translatorBindingCallee` / `isTranslatorReturn` (Κ1),
 * `resolveSpecifier` (module-graph), `extractNamespaces` (το λεξιλόγιο ns όλων των πυλών).
 * ⚠️ Φορτώνει `typescript` — ΜΟΝΟ ο Κ2 (pre-commit) το εισάγει, ποτέ η αλυσίδα του χρησμού Χ.
 * =============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const MG = require('../module-graph');
const { extractNamespaces } = require('../i18n-namespace-extract');
const { translatorBindingCallee, isTranslatorReturn } = require('./readiness-nodes');

const parse = (file, content) =>
  ts.createSourceFile(file, content, ts.ScriptTarget.Latest, /* setParentNodes */ true, ts.ScriptKind.TSX);

function someNode(source, predicate) {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (predicate(node)) { found = true; return; }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(source, visit);
  return found;
}

/** Τα ονόματα hook από τα οποία το αρχείο δανείζεται `t` (`const { t } = useX()`). */
function borrowingCallees(source) {
  const callees = new Set();
  someNode(source, (node) => {
    const callee = translatorBindingCallee(node);
    if (callee) callees.add(callee);
    return false;
  });
  return [...callees];
}

/** `import { useX } from 'spec'` (και `{ a as useX }`) ⇒ `'spec'`. */
function importSpecifierOf(source, localName) {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause && statement.importClause.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    if (bindings.elements.some((element) => element.name.text === localName)) return statement.moduleSpecifier.text;
  }
  return null;
}

const FILE_PROBE = { has: (abs) => { try { return fs.statSync(abs).isFile(); } catch { return false; } } };

/**
 * @returns {{ namespaces: string[], via: string } | { refused: string } | null}
 *   `null` = το αρχείο δεν δανείζεται `t` από hook · `refused` = δανείζεται, αλλά
 *   η προέλευση δεν αποδεικνύεται (⇒ ο καλών μένει στο δηλωμένο κενό).
 */
function borrowedNamespaces({ projectRoot, relFile, content, bundles, aliases }) {
  const source = parse(relFile, content);
  const callees = borrowingCallees(source);
  if (callees.length === 0) return null;
  if (callees.length > 1) return { refused: `δανεικό t από ${callees.length} hooks (${callees.join(', ')})` };

  const spec = importSpecifierOf(source, callees[0]);
  if (!spec) return { refused: `το ${callees[0]} δεν εισάγεται με όνομα` };
  const fromFile = MG.toPosix(path.join(projectRoot, relFile));
  const target = MG.resolveSpecifier(spec, fromFile, { projectRoot, aliases, fileSet: FILE_PROBE });
  if (target.kind !== 'internal') return { refused: `αδύνατη η επίλυση του '${spec}'` };

  const hookContent = fs.readFileSync(target.file, 'utf8');
  const via = MG.toPosix(path.relative(projectRoot, target.file));
  if (!someNode(parse(via, hookContent), isTranslatorReturn)) return { refused: `το ${via} δεν παραδίδει t` };
  const calls = (hookContent.match(/useTranslation\(/g) || []).length;
  if (calls !== 1) return { refused: `το ${via} έχει ${calls} κλήσεις useTranslation — ποιο t;` };
  const namespaces = extractNamespaces(hookContent, bundles);
  if (namespaces.length === 0) return { refused: `το ${via} δεν δηλώνει namespace` };
  return { namespaces, via };
}

module.exports = { borrowedNamespaces };
