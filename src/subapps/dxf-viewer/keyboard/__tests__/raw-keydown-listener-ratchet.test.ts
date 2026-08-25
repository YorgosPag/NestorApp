/**
 * ADR-711 §5 — Ο ratchet των ωμών window keydown listeners του viewer.
 *
 * ── ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ CHECK 3.7 ──
 *
 * Το προφανές ήταν ένα registry module με `forbiddenPatterns:
 * ["window\\.addEventListener\\(.keydown."]`. Μετρήθηκε: ταιριάζει **38 αρχεία** και
 * **κανένα** δεν υπάρχει στο `.ssot-violations-baseline.json` ⇒ ενεργό, θα ΜΠΛΟΚΑΡΕ
 * κάθε commit που αγγίζει έστω ένα. Το `npm run ssot:baseline` που θα το θεράπευε
 * (α) έτρεχε **>22 λεπτά χωρίς έξοδο** σε Windows — ο audit κάνει ένα full-`src`
 * `grep` **ανά module**, και τα modules είναι 349 — και (β) ξαναγράφει **κοινό**
 * baseline αρχείο, αποτυπώνοντας μέσα του τα uncommitted ευρήματα όποιου άλλου
 * πράκτορα δουλεύει στο ίδιο δέντρο.
 *
 * Ίδιο σχήμα με το `numeric-field` (ADR-706): το registry module φυλάει **μόνο** κατά
 * re-implementation του predicate· ο **πληθυσμός** των call sites είναι ratchet, και ο
 * ratchet ζει εδώ. Ο αριθμός σε αρχείο δικό μου = κανένα κοινό αρχείο δεν αγγίζεται,
 * καμία 22-λεπτη regeneration, και το σήμα είναι **ονομαστικό**: ένα νέο αρχείο
 * εμφανίζεται με το όνομά του, όχι ως «+1 violation».
 *
 * ── ΤΙ ΠΙΑΝΕΙ ──
 *
 *  1. **Νέος ωμός listener** ⇒ κόκκινο με το όνομα του αρχείου. Αυτός ήταν ο μόνος
 *     ανοιχτός κίνδυνος του ADR-711: ο 44ος listener ξανασπάει το `Tab` μέσα στα modals.
 *  2. **Μεταναστευμένο αρχείο που έμεινε στη λίστα** ⇒ κόκκινο «βγάλ' το». Ο ratchet
 *     κινείται **μόνο προς τα κάτω** — μια λίστα που δεν αδειάζει είναι σχόλιο.
 *
 * @see src/subapps/dxf-viewer/keyboard/global-shortcut-listener.ts — ο wrapper
 * @see src/lib/a11y/keyboard-scope.ts — το predicate SSoT
 * @see ADR-711 §4-§5 · ADR-364 §10.15
 */
import fs from 'fs';
import path from 'path';

const VIEWER_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Το literal χτίζεται από κομμάτια επίτηδες: γραμμένο ολόκληρο, αυτό το αρχείο θα
 * εμφανιζόταν στα ίδια greps με τα οποία μετριέται ο ratchet — και θα μετρούσε τον
 * εαυτό του.
 */
const RAW_LISTENER = ['window', '.addEventListener(', "'keydown'"].join('');
const RAW_LISTENER_DOUBLE_QUOTED = ['window', '.addEventListener(', '"keydown"'].join('');

/** Παράγωγα build/report δέντρα μέσα στο subapp — δεν είναι πηγαίος κώδικας. */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'coverage',
  'reports',
  'node_modules',
]);

/**
 * Listeners που **οφείλουν** να είναι ωμοί. Κάθε εγγραφή φέρει τον λόγο, ώστε ένας
 * ενδέκατος να πρέπει να δικαιολογηθεί αντί να προστεθεί σιωπηλά.
 */
const BY_DESIGN: ReadonlyMap<string, string> = new Map([
  ['keyboard/global-shortcut-listener.ts', 'ο wrapper — εδώ ζει ο ΕΝΑΣ ωμός listener'],
  [
    'keyboard/createModifierKeyTracker.ts',
    'παρακολουθεί κατάσταση Shift/Ctrl/Alt, δεν εκτελεί εντολή — δεν υπάρχει τι να παραιτηθεί',
  ],
  [
    'systems/escape-bus/EscapeCommandBus.ts',
    'ο bus οφείλει να δουλεύει ΜΕΣΑ στα modals — εκεί ζει το ESC_PRIORITY.MODAL_DIALOG (ADR-364)',
  ],
  ['systems/escape-bus/escape-dev-audit.ts', 'dev παρατηρητής του bus — ίδιος λόγος με τον bus'],
  ['systems/escape-bus/__tests__/EscapeCommandBus.test.ts', 'test — στέλνει συμβάντα, δεν εγγράφεται'],
  ['systems/escape-bus/__tests__/escape-dev-audit.test.ts', 'test — στέλνει συμβάντα, δεν εγγράφεται'],
  [
    'systems/dynamic-input/components/DynamicInputOverlay.tsx',
    'το πεδίο ΕΙΝΑΙ ο ιδιοκτήτης του πλήκτρου — gate εδώ θα το σκότωνε (ADR-711 §3)',
  ],
  [
    // ADR-711 §5.6 (2026-07-27) — μετακόμισε από το `RadialCommandRing.tsx` (N.7.1 SRP split).
    // Ο ratchet το έπιασε και προς τις **δύο** κατευθύνσεις: νέο αρχείο με ωμό listener ΚΑΙ
    // μπαγιάτικη εγγραφή για το παλιό. Αυτό είναι το test να κάνει τη δουλειά του.
    'systems/dynamic-input/components/use-ring-heads-up-key.ts',
    'δαχτυλίδι εντολών: κατέχει τον χρόνο πληκτρολόγησης (ADR-513 direct distance entry)',
  ],
  [
    'systems/dynamic-input/hooks/useDynamicInputKeyboard.ts',
    'ο ιδιοκτήτης του πληκτρολογίου του Dynamic Input',
  ],
  [
    // ΔΥΟ ΚΑΤΑΣΚΟΠΟΙ, ΟΧΙ ΔΙΕΚΔΙΚΗΤΕΣ (ADR-711 §10, 2026-08-25). Και οι δύο εγγράφουν για να
    // **παρατηρήσουν σειρά** — καταγράφουν τι είδε ο κόσμος και αποδεσμεύονται μέσα στην ίδια
    // άγκυρα. Δεν μπορούν να περάσουν από την πόρτα `observeModifierSnapshot`: εκείνη δίνει
    // **στιγμιότυπο**, ενώ αυτό που κρίνεται εδώ είναι ακριβώς το `EventTarget` και η φάση —
    // δηλαδή ό,τι η πόρτα σκόπιμα κρύβει.
    'ui/table-cell-editor/__tests__/table-format-cells-shortcut.test.tsx',
    'κατάσκοπος σειράς: επιβεβαιώνει ότι το Ctrl+1 ΦΤΑΝΕΙ στο κελί (§61) — παρατηρεί, δεν διεκδικεί',
  ],
  [
    'ui/table-cell-editor/__tests__/table-range-transfer-drag.test.ts',
    'κατάσκοπος σειράς: αποδεικνύει ότι ο παραγωγός γράφει ΠΡΙΝ διαβάσει ο αναγνώστης (§31)',
  ],
  [
    'ui/components/tests-modal/examples/advanced-usage.tsx',
    'παράδειγμα τεκμηρίωσης μέσα σε σχόλιο/επίδειξη, δεν είναι accelerator του viewer',
  ],
]);

/**
 * Ο ΡΑΤΣΕΤ. Global accelerators που δεν έχουν μεταναστεύσει ακόμη στον wrapper.
 * Μεταναστεύουν **Boy-Scout στο άγγιγμα** (N.0.2 / ADR-711 §4).
 *
 * 🔴 Η λίστα **μόνο μικραίνει**. Αν μεταναστεύσεις ένα, σβήσε τη γραμμή του — το test
 * σε αναγκάζει (βλ. «carries no stale entry»). Αν πρέπει να **προσθέσεις** γραμμή,
 * σταμάτα: αυτό είναι το ελάττωμα Ε1/Ε4 να ξαναγράφεται.
 */
const PENDING_MIGRATION: ReadonlySet<string> = new Set([
  'accessibility/SelectionCursorIcon.tsx',
  'app/useDxfViewerEffects.ts',
  'bim-3d/animation/use-waypoint-drag-interaction.ts',
  'bim-3d/preview/preview-orbit-controls.ts',
  'bim-3d/render/crop-region/CropRegionTool.ts',
  'bim-3d/viewport/use-bim3d-entity-clipboard.ts',
  'bim-3d/viewport/use-polygon-clipboard-shortcuts.ts',
  'components/dxf-layout/DistMeasureOverlayLeaf.tsx',
  // ✅ ΜΕΤΑΝΑΣΤΕΥΣΑΝ (ADR-739 Φ.Δ βήμα 4) — μη τα ξαναπροσθέσεις:
  //   · `core/commands/useCommandHistory.ts` — Ctrl+Z/Y· έκλεβε το undo μέσα από κελί πίνακα
  //   · `hooks/drawing/attach-image-tool.ts` — Enter· ρωτούσε μόνο «γράφει ο χρήστης;»
  //     (δεν ήταν καν σε αυτή τη λίστα: μπήκε με το ADR-736 και άφησε τον ratchet κόκκινο)
  'debug/layout-debug/coordinate-clipboard-copy.ts',
  'debug/layout-debug/LayoutMapper.tsx',
  'debug/useDebugToolbarShortcuts.ts',
  'hooks/canvas/useCanvasKeyboardShortcuts.ts',
  'hooks/canvas/useCanvasSectionUI.ts',
  'hooks/dimensions/useDimAssociationGhostPreview.ts',
  'hooks/drawing/use-polygon-sketch-chain.ts',
  'hooks/drawing/use-wall-tool-event-listeners.ts',
  'hooks/drawing/useStairTool.ts',
  'hooks/grips/useGripHoverMenuController.ts',
  'hooks/grips/useGripSpacebarCycle.ts',
  'hooks/tools/useMirrorPreview.ts',
  'hooks/tools/useMirrorTool.ts',
  'hooks/useDxfToolbarShortcuts.ts',
  'statusbar/CadStatusBar.tsx',
  'systems/properties/QuickPropertiesMiniPanel.tsx',
  'systems/selection/use-selection-cycling.ts',
]);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      collectSourceFiles(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

function relative(file: string): string {
  return path.relative(VIEWER_ROOT, file).split(path.sep).join('/');
}

/**
 * 🔴 **Η ΠΡΟΖΑ ΔΕΝ ΕΙΝΑΙ ΕΓΓΡΑΦΗ.**
 *
 * Ο έλεγχος ήταν `source.includes(...)` σε **ολόκληρο** το αρχείο, οπότε ένα σχόλιο που
 * *περιγράφει* το πρόβλημα μετριόταν ως το πρόβλημα. Το πλήρωσε το πρώτο αρχείο που
 * τεκμηρίωσε τον κανόνα: το `keyboard/modifier-snapshot.ts` — η **πόρτα που υπάρχει για να
 * μην εγγράφεται κανείς** — αναφέρθηκε ως παραβάτης, επειδή η κεφαλίδα του εξηγεί τι
 * μετράει αυτός εδώ ο ratchet.
 *
 * Το ίδιο μάθημα με τον `Κ7β` του CHECK 3.50: *ένα σχόλιο που τεκμηριώνει παλιό λεξιλόγιο
 * δεν πρέπει να μετριέται ως ζωντανό, αλλιώς κάθε τεκμηρίωση της βλάβης γίνεται η βλάβη*.
 *
 * ⚠️ **Καμία έκτη μηχανή αφαίρεσης σχολίων** (υπάρχουν ήδη πέντε τοπικές στο `scripts/` —
 * ADR-749). Η ερώτηση εδώ είναι στενή: *«υπάρχει **εντολή** εγγραφής;»*. Μια εντολή δεν
 * ξεκινά ποτέ με `//` ή `*`, άρα ο έλεγχος γίνεται **ανά γραμμή** και αγνοεί την πρόζα.
 * Σχόλιο **στο τέλος** γραμμής με κώδικα μετριέται κανονικά — εκεί υπάρχει και εντολή.
 */
function isProse(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function hasRawListener(source: string): boolean {
  return source
    .split('\n')
    .some(
      (line) =>
        !isProse(line) &&
        (line.includes(RAW_LISTENER) || line.includes(RAW_LISTENER_DOUBLE_QUOTED)),
    );
}
describe('ADR-711 — ratchet: ωμοί window keydown listeners στον viewer', () => {
  const files = collectSourceFiles(VIEWER_ROOT).filter(
    (file) => !relative(file).startsWith('keyboard/__tests__/'),
  );
  const offenders = files.filter((file) => hasRawListener(fs.readFileSync(file, 'utf8'))).map(relative);

  it('βρίσκει το δέντρο του viewer (φύλακας κατά σιωπηλά κενής σάρωσης)', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(offenders.length).toBeGreaterThan(10);
  });

  it('καμία εγγραφή δεν είναι και by-design και pending', () => {
    const both = [...BY_DESIGN.keys()].filter((rel) => PENDING_MIGRATION.has(rel));
    expect(both).toEqual([]);
  });

  // Το αποφασιστικό: ένα αρχείο που δεν είναι ούτε δικαιολογημένο ούτε καταγεγραμμένο
  // είναι ΝΕΟΣ ωμός listener — δηλαδή το Tab μόλις ξαναπέθανε μέσα στα modals.
  it('κανένα ΝΕΟ αρχείο δεν εγγράφει ωμό listener', () => {
    const unexpected = offenders.filter(
      (rel) => !BY_DESIGN.has(rel) && !PENDING_MIGRATION.has(rel),
    );
    expect(unexpected).toEqual([]);
  });

  // Η άλλη κατεύθυνση του ratchet: μεταναστευμένο αρχείο που έμεινε στη λίστα.
  it('δεν κρατά μπαγιάτικη εγγραφή (ο ratchet κινείται μόνο προς τα κάτω)', () => {
    const stale = [...PENDING_MIGRATION, ...BY_DESIGN.keys()].filter(
      (rel) => !offenders.includes(rel),
    );
    expect(stale).toEqual([]);
  });

  it('ο wrapper είναι ο ΕΝΑΣ ωμός listener του μονοπατιού των accelerators', () => {
    const wrapper = fs.readFileSync(
      path.join(VIEWER_ROOT, 'keyboard', 'global-shortcut-listener.ts'),
      'utf8',
    );
    expect(hasRawListener(wrapper)).toBe(true);
    expect(wrapper).toContain('shouldGlobalShortcutYield');
    expect(wrapper).toContain('isModalKeyboardScopeActive');
  });
});
