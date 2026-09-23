/**
 * **Η πατημένη κατάσταση γραμμένη ως παραλλαγή επιφάνειας** — `<Button variant={x ? 'default' : 'outline'}>`
 * (ADR-770 §19, άγκυρα Ο5ε).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ
 * ═══════════════════════════════════════════════════════════════════════════════
 * Στο σκοτεινό θέμα `bg-primary` ≡ `bg-secondary` ≡ `--card` (1,00:1). Ένα κουμπί που δηλώνει «πατημένο»
 * αλλάζοντας παραλλαγή ανάμεσα σε `default | secondary | outline | ghost` **χάνει** την επιλογή του, και το μη
 * πατημένο (`bg-background`) μοιάζει επιλεγμένο (ADR-777 §8.72.8 #2, ζωντανή σελίδα). Το handoff μέτρησε 42
 * σημεία με `grep` ενός σχήματος· ο σαρωτής, **101** σε `<Button>` (έξι σχήματα, και σε πολλές γραμμές).
 *
 * 🔑 **ΓΙΑΤΙ AST ΚΑΙ ΟΧΙ REGEX.** Ένα ternary σπασμένο σε γραμμές ή φωλιασμένο
 * (`a ? 'outline' : b ? 'default' : 'outline'`) είναι αόρατο στο `grep`. Μετράμε τα **φύλλα** της συνθήκης.
 *
 * 🔑 **ΜΟΝΟ `<Button>`.** Το `<Badge variant={…}>` δείχνει **κατάσταση οντότητας**, όχι πατημένο χειριστήριο —
 * άλλη ερώτηση (CHECK 3.41), άλλη θεραπεία.
 *
 * @module scripts/lib/contrast/pressed-variant-ternary
 * @see ADR-770 §19 · components/ui/toggle-button · components/ui/segmented-control
 */

'use strict';

const ts = require('typescript');

/** Οι παραλλαγές που είναι **επιφάνεια** (ή απουσία της) — όχι ρόλος. */
const SURFACE_VARIANTS = new Set(['default', 'secondary', 'outline', 'ghost']);

/**
 * **Έμφαση ενέργειας, ΟΧΙ επιλογή** — ποιο από δύο κουμπιά είναι το κύριο (π.χ. «Αποδοχή» έναντι «Απόρριψη»).
 * Δεν είναι πατημένη κατάσταση, άρα δεν ανήκουν στο `ToggleButton`· ανήκουν στην ιεραρχία ενεργειών
 * (`COLOR_BRIDGE.action`), που περιμένει απόφαση για ΟΛΟ το `<Button variant="default">` (ADR-770 §18.7 #1).
 * Ratchet κατά ταυτότητα: **ακριβές** πλήθος ανά αρχείο — λιγότερα ⇒ σβήσε τη γραμμή, περισσότερα ⇒ ⛔.
 */
const DECLARED_EMPHASIS_TERNARIES = Object.freeze({
  'src/components/account/ShowcaseDoor.tsx': 1,
  'src/components/contact/FirstContactAwaitingProof.tsx': 1,
  'src/components/mandate/ShowcaseEmailConfirmationContent.tsx': 2,
  'src/components/mandate/inbox/MandateInboxRow.tsx': 1,
  'src/components/projects/ika/components/QrCodePanel.tsx': 1,
  'src/components/workspace-invite/WorkspaceInviteContent.tsx': 1,
  'src/subapps/procurement/components/ComparisonPanel.tsx': 1,
});

function unwrap(node) {
  let current = node;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

/** Τα φύλλα μιας (φωλιασμένης) συνθήκης· `null` για ό,τι δεν είναι σταθερό κείμενο. */
function conditionalLeaves(node) {
  const expr = unwrap(node);
  if (ts.isConditionalExpression(expr)) return [...conditionalLeaves(expr.whenTrue), ...conditionalLeaves(expr.whenFalse)];
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
  return [null];
}

/** Είναι αυτό το `variant={…}` κατάσταση γραμμένη ως επιφάνεια; */
function isSurfaceTernary(attribute) {
  const init = attribute.initializer;
  if (!init || !ts.isJsxExpression(init) || !init.expression) return false;
  if (!ts.isConditionalExpression(unwrap(init.expression))) return false;
  const leaves = conditionalLeaves(init.expression);
  if (leaves.includes(null)) return false;
  const distinct = new Set(leaves);
  return distinct.size > 1 && [...distinct].every((leaf) => SURFACE_VARIANTS.has(leaf));
}

/** Τα σημεία ενός αρχείου: `{ line, text }` για κάθε `<Button variant={συνθήκη επιφανειών}>`. */
function findPressedVariantTernaries(source, fileName = 'file.tsx') {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits = [];
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'variant' && isSurfaceTernary(node)) {
      const owner = node.parent.parent;
      if (owner.tagName.getText(sf) === 'Button') {
        hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: node.getText(sf) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/**
 * Σύγκριση με τη δήλωση. Επιστρέφει γραμμές αναγνώσιμες μέσα σε `expect(...).toEqual([])`.
 * @param {Map<string, ReturnType<typeof findPressedVariantTernaries>>} found αρχείο → σημεία
 */
function ternaryRatchetViolations(found, declared = DECLARED_EMPHASIS_TERNARIES) {
  const out = [];
  for (const [rel, hits] of found) {
    const allowed = declared[rel] ?? 0;
    if (hits.length > allowed) {
      out.push(...hits.map((h) => `${rel}:${h.line} ${h.text} — χρησιμοποίησε ToggleButton / SegmentedControl (ADR-770 §19)`));
    }
  }
  for (const [rel, count] of Object.entries(declared)) {
    const actual = (found.get(rel) ?? []).length;
    if (actual < count) out.push(`${rel}: δηλωμένα ${count}, βρέθηκαν ${actual} — μίκρυνε τη δήλωση (μόνο μικραίνει)`);
  }
  return out;
}

module.exports = {
  SURFACE_VARIANTS,
  DECLARED_EMPHASIS_TERNARIES,
  findPressedVariantTernaries,
  ternaryRatchetViolations,
};
