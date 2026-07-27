/**
 * ADR-711 §5.6 — Ο ratchet των **inline** αντιγράφων του «δέχεται πληκτρολόγηση;».
 *
 * ── ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ CHECK 3.7 ──
 *
 * Το registry module `modal-keyboard-scope` φυλάει κατά **re-implementation με όνομα**:
 * `function isEditableTarget(`, `function isTypingInFormField(`, κ.λπ. Μετρημένο
 * 2026-07-27: αυτό πιάνει **μηδέν** αρχεία σήμερα (γι' αυτό μένει χωρίς baseline και
 * μπλοκάρει καθαρά). Ο πραγματικός πληθυσμός είναι **ανώνυμος** — η σύγκριση γραμμένη
 * σκέτη μέσα στον handler:
 *
 * ```ts
 * if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
 *     target.contentEditable === 'true') return;      // ← ούτε όνομα, ούτε import
 * ```
 *
 * Καθολικό `forbiddenPattern` για αυτό θα ταίριαζε **13 αρχεία**, κανένα στο
 * `.ssot-violations-baseline.json` ⇒ θα μπλόκαρε κάθε commit που αγγίζει ένα από αυτά,
 * και το `npm run ssot:baseline` που θα το θεράπευε (α) τρέχει **>22 λεπτά** σε Windows
 * (full-`src` grep ανά module × 349 modules) και (β) ξαναγράφει **κοινό** baseline,
 * αποτυπώνοντας μέσα του τα uncommitted ευρήματα όποιου άλλου πράκτορα δουλεύει στο ίδιο
 * δέντρο. Ίδιο σκεπτικό, ίδιο σχήμα και ίδια απόφαση με τον αδελφό ratchet των ωμών
 * listeners — δες `dxf-viewer/keyboard/__tests__/raw-keydown-listener-ratchet.test.ts`.
 *
 * ── ΓΙΑΤΙ ΕΧΕΙ ΣΗΜΑΣΙΑ (δεν είναι αισθητική) ──
 *
 * Και τα δώδεκα κάνουν **το ίδιο μετρημένο λάθος**, με δύο τρόπους:
 *
 *  1. `contentEditable === 'true'` — σύγκριση **συμβολοσειράς** αντί για την ιδιότητα
 *     `isContentEditable`. Χάνει το `contenteditable=""` (που κατά προδιαγραφή HTML
 *     σημαίνει `true`) **και** το κληρονομημένο contenteditable. Αυτή είναι η ακριβής
 *     ρίζα που τεκμηρίωσε το ADR-711 όταν ενοποίησε τα πρώτα δέκα.
 *  2. `tagName`-only — άρα **τυφλά** στο canonical Radix dropdown της εφαρμογής
 *     (ADR-001, `<button role="combobox">`, 237 αρχεία). Είναι το ίδιο κενό που
 *     μετρήθηκε ζωντανά στο §5.6: το πάτημα γράμματος πάνω σε εστιασμένο dropdown
 *     άνοιγε τη γραμμή εντολών αντί να κάνει type-ahead.
 *
 * ⚠️ **ΔΕΝ αρκεί να αντικατασταθεί με `isTextEntryTarget`.** Κάθε call site πρέπει πρώτα
 * να απαντήσει **ποια από τις δύο ερωτήσεις** κάνει (`keyboard-scope.ts` §1):
 * κλέβει εκτυπώσιμο χαρακτήρα ⇒ `consumesTypedCharacters`· ρωτά αν το `Escape`/`Enter`
 * ανήκει σε πεδίο κειμένου ⇒ `isTextEntryTarget`. Μηχανική αντικατάσταση του ενός με το
 * άλλο **είναι** το σφάλμα που κράτησε το §5.6 ανοιχτό.
 *
 * @see src/lib/a11y/keyboard-scope.ts — οι δύο ερωτήσεις και ποιος ρωτά ποια
 * @see ADR-711 §5.6
 */
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Το literal χτίζεται από κομμάτια επίτηδες: γραμμένο ολόκληρο, αυτό το αρχείο θα
 * εμφανιζόταν στη δική του σάρωση και θα μετρούσε τον εαυτό του.
 */
const INLINE_TAG_COMPARISON = new RegExp(
  '\\b(?:tagName|nodeName|tag)\\s*===?\\s*[\'"](?:' +
    [['IN', 'PUT'].join(''), 'TEXTAREA', 'SELECT'].join('|') +
    ')[\'"]',
);

/** Παράγωγα build/report δέντρα — δεν είναι πηγαίος κώδικας. */
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'coverage',
  'reports',
  '.next',
  'dist',
]);

/**
 * Αρχεία που **οφείλουν** να συγκρίνουν `tagName` ωμά. Κάθε εγγραφή φέρει τον λόγο, ώστε
 * ένα δεύτερο να πρέπει να δικαιολογηθεί αντί να προστεθεί σιωπηλά.
 */
const BY_DESIGN: ReadonlyMap<string, string> = new Map([
  [
    'lib/a11y/keyboard-scope.ts',
    'ο SSoT — το implicit role του <select> δεν φαίνεται σε getAttribute("role") ούτε στο IDL .role, άρα ο έλεγχος tagName είναι ο ΜΟΝΟΣ τρόπος να φανεί',
  ],
]);

/**
 * Ο ΡΑΤΣΕΤ. Inline αντίγραφα που δεν έχουν μεταναστεύσει ακόμη στον SSoT.
 * Μεταναστεύουν **Boy-Scout στο άγγιγμα** (N.0.2), αφού πρώτα απαντηθεί ΠΟΙΑ ερώτηση κάνει
 * το call site.
 *
 * 🔴 Η λίστα **μόνο μικραίνει**. Αν μεταναστεύσεις ένα, σβήσε τη γραμμή του — το test σε
 * αναγκάζει (βλ. «δεν κρατά μπαγιάτικη εγγραφή»). Αν πρέπει να **προσθέσεις** γραμμή,
 * σταμάτα: γράφεις το δέκατο τέταρτο αντίγραφο ενός predicate που έχει SSoT.
 */
const PENDING_MIGRATION: ReadonlySet<string> = new Set([
  'components/crm/calendar/useCalendarKeyboardShortcuts.ts',
  'subapps/dxf-viewer/components/dxf-layout/DistMeasureOverlayLeaf.tsx',
  'subapps/dxf-viewer/hooks/canvas/useCanvasKeyboardShortcuts.ts',
  'subapps/dxf-viewer/hooks/canvas/useCanvasSectionUI.ts',
  'subapps/dxf-viewer/hooks/dimensions/useDimToolRouting.ts',
  'subapps/dxf-viewer/hooks/drawing/use-polygon-sketch-chain.ts',
  'subapps/dxf-viewer/hooks/drawing/use-wall-tool-event-listeners.ts',
  'subapps/dxf-viewer/hooks/drawing/useStairTool.ts',
  'subapps/dxf-viewer/hooks/grips/useGripSpacebarCycle.ts',
  'subapps/dxf-viewer/hooks/useDxfToolbarShortcuts.ts',
  'subapps/dxf-viewer/statusbar/CadStatusBar.tsx',
  'subapps/dxf-viewer/systems/selection/use-selection-cycling.ts',
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
  return path.relative(SRC_ROOT, file).split(path.sep).join('/');
}

describe('ADR-711 §5.6 — ratchet: inline αντίγραφα του predicate πληκτρολόγησης', () => {
  const files = collectSourceFiles(SRC_ROOT).filter(
    (file) => !relative(file).startsWith('lib/a11y/__tests__/'),
  );
  const offenders = files
    .filter((file) => INLINE_TAG_COMPARISON.test(fs.readFileSync(file, 'utf8')))
    .map(relative);

  it('βρίσκει το δέντρο του src (φύλακας κατά σιωπηλά κενής σάρωσης)', () => {
    // Χωρίς αυτό, ένα σπασμένο glob θα έκανε ΟΛΟΥΣ τους παρακάτω ελέγχους πράσινους
    // σαρώνοντας μηδέν αρχεία — η κλασική «0 = κανείς δεν κοίταξε» παγίδα (N.11/N.12).
    expect(files.length).toBeGreaterThan(1000);
    expect(offenders.length).toBeGreaterThan(5);
  });

  it('καμία εγγραφή δεν είναι και by-design και pending', () => {
    const both = [...BY_DESIGN.keys()].filter((rel) => PENDING_MIGRATION.has(rel));
    expect(both).toEqual([]);
  });

  // Το αποφασιστικό: αρχείο που δεν είναι ούτε δικαιολογημένο ούτε καταγεγραμμένο είναι
  // ΝΕΟ inline αντίγραφο — δηλαδή το ίδιο κενό (contenteditable="" + Radix combobox)
  // μόλις γράφτηκε από την αρχή σε ένα δεκατέταρτο σημείο.
  it('κανένα ΝΕΟ αρχείο δεν γράφει inline αντίγραφο', () => {
    const unexpected = offenders.filter(
      (rel) => !BY_DESIGN.has(rel) && !PENDING_MIGRATION.has(rel),
    );
    expect(unexpected).toEqual([]);
  });

  // Η άλλη κατεύθυνση του ratchet: μεταναστευμένο αρχείο που έμεινε στη λίστα.
  // Μια λίστα που δεν αδειάζει είναι σχόλιο, όχι ratchet.
  it('δεν κρατά μπαγιάτικη εγγραφή (ο ratchet κινείται μόνο προς τα κάτω)', () => {
    const stale = [...PENDING_MIGRATION, ...BY_DESIGN.keys()].filter(
      (rel) => !offenders.includes(rel),
    );
    expect(stale).toEqual([]);
  });

  it('ο SSoT εξάγει και τις ΔΥΟ ερωτήσεις — αλλιώς η μετανάστευση δεν έχει προορισμό', () => {
    const ssot = fs.readFileSync(path.join(SRC_ROOT, 'lib', 'a11y', 'keyboard-scope.ts'), 'utf8');
    expect(ssot).toContain('export function isTextEntryTarget');
    expect(ssot).toContain('export function consumesTypedCharacters');
    // Ο λόγος ύπαρξης της ερώτησης 2: ο ρόλος, όχι το tagName (Radix = button).
    expect(ssot).toContain('combobox');
  });
});
