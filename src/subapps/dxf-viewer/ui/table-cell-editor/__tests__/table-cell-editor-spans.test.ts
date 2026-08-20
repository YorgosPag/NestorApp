/**
 * 🔴 ADR-786 §4 (γ) — **Η ΔΕΥΤΕΡΗ ΜΟΡΦΗ ΤΟΥ ΙΔΙΟΥ ΕΛΑΤΤΩΜΑΤΟΣ: τα ΤΜΗΜΑΤΑ.**
 *
 * Το ADR-753 §28 έβαλε τα βαμμένα τμήματα να δηλώνουν **μόνο ό,τι διαφέρει** από το κελί, με
 * το μέγεθος ως **λόγο** του `--tce-em`. Και τα δύο ήταν σωστά — όσο η ερώτηση «ποια
 * γραμματοσειρά;» είχε την ίδια απάντηση για όλους. Δεν την έχει:
 *
 *  - το κελί (κανονικό) λύνεται στο **υποκατάστατο** face και ζωγραφίζεται από opentype·
 *  - ένα **έντονο** τμήμα δεν βρίσκει bundled bold face, **πέφτει στο tier CSS** και
 *    ζωγραφίζεται με την **αιτούμενη** οικογένεια, σε **άλλο em** για το ίδιο ύψος.
 *
 * Δηλαδή δύο τμήματα της ίδιας λέξης ζωγραφίζονται από **δύο διαφορετικές μηχανές**, και η
 * σύγκριση ωμών ονομάτων (`typography.fontFamily !== cell.fontFamily`) δεν βλέπει τίποτα:
 * κανένα από τα δύο δεν άλλαξε οικογένεια. Ο επεξεργαστής θα κληρονομούσε το face του κελιού
 * και το μέγεθος του κελιού για ένα τμήμα που ο καμβάς ζωγραφίζει **αλλιώς και στα δύο**.
 *
 * ⚠️ Οι άγκυρες εγκαθιστούν ρητά face: χωρίς αυτό όλα πέφτουν στο ίδιο tier, οι δύο
 * απαντήσεις συμπίπτουν και το test είναι πράσινο με **κάθε** κώδικα.
 *
 * @see ui/table-cell-editor/table-cell-editor-spans.ts
 * @see bim/table/__tests__/table-text-font.test.ts — η ίδια ερώτηση, στην πηγή της
 */

import { tableCellEditorSpans } from '../table-cell-editor-spans';
import { TABLE_CELL_EDITOR_VARS } from '../table-cell-editor-vars';
import { tableTextFont } from '../../../bim/table/table-text-font';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';
import type { TableCellStyle } from '../../../bim/table/table-style';
import type { TableCellTextRun } from '../../../types/table';

const HEIGHT_MM = 4;
const CELL: TableCellStyle = {
  textHeightMm: HEIGHT_MM,
  textColorHex: '#eeeeee',
  bold: false,
  italic: false,
  underline: false,
  align: 'ML',
  indentLevel: 0,
  margins: { hMm: 2, vMm: 1 },
};

const TEXT = 'ΤΕΣΤ';
/** Τα δύο τελευταία γράμματα έντονα — το «ΤΕ**ΣΤ**» του στιγμιότυπου του Giorgio. */
const BOLD_TAIL: readonly TableCellTextRun[] = [{ start: 2, end: 4, style: { bold: true } }];

const spansOf = (runs?: readonly TableCellTextRun[]) =>
  tableCellEditorSpans({
    draft: TEXT,
    committedText: TEXT,
    style: CELL,
    ...(runs !== undefined && { runs }),
  });

/** Ο λόγος μέσα στο `calc(var(--tce-em) * N)`, ή `null` όταν δεν δηλώθηκε μέγεθος. */
function declaredRatio(fontSize: string | number | undefined): number | null {
  if (typeof fontSize !== 'string') return null;
  const match = new RegExp(`var\\(${TABLE_CELL_EDITOR_VARS.fontSize}\\) \\* ([\\d.]+)\\)`).exec(fontSize);
  return match ? Number(match[1]) : null;
}

describe('🔴 ADR-786 (γ) — το τμήμα δηλώνει ό,τι διαφέρει ΣΤΗΝ ΟΘΟΝΗ, όχι στο μοντέλο', () => {
  let restore: () => void;
  beforeAll(() => { restore = installStubFont(0.6, 'Liberation Sans'); });
  afterAll(() => restore());

  it('Σ1 — η αναλλοίωτη του §28 ΕΠΙΒΙΩΝΕΙ: κελί χωρίς runs ⇒ τμήμα χωρίς καμία τυπογραφία', () => {
    // Αυτό είναι που κρατά τα κερδισμένα: κάθε πίνακας που υπάρχει σήμερα παράγει τμήμα που
    // δεν αγγίζει ούτε οικογένεια ούτε βάρος ούτε μέγεθος — ίδια θέση κάθε glyph.
    const [only] = spansOf();
    expect(only.style.fontFamily).toBeUndefined();
    expect(only.style.fontWeight).toBeUndefined();
    expect(only.style.fontSize).toBeUndefined();
  });

  it('Σ2 — το ΕΝΤΟΝΟ τμήμα ξαναδηλώνει ΟΙΚΟΓΕΝΕΙΑ, όχι μόνο βάρος', () => {
    // Χωρίς αυτό το τμήμα θα κληρονομούσε το «Liberation Sans» του κελιού ενώ ο καμβάς το
    // ζωγραφίζει με την αιτούμενη οικογένεια — δύο διαφορετικά περιγράμματα μέσα στη λέξη.
    const bold = spansOf(BOLD_TAIL)[1];
    expect(bold.text).toBe('ΣΤ');
    expect(bold.style.fontWeight).toBe('bold');
    expect(bold.style.fontFamily).toBe(tableTextFont(1, true, false).cssFamily);
    expect(bold.style.fontFamily).not.toBe(tableTextFont(1, false, false).cssFamily);
  });

  it('🔴 Σ3 — ο λόγος μεγέθους ΑΝΑΙΡΕΙ τη διαφορά em, ώστε το τμήμα να βγει στο ύψος του καμβά', () => {
    // Η απόδειξη δεν ξαναγράφει τον τύπο: ρωτά το **ίδιο** SSoT για το τι θα ζωγραφίσει ο
    // καμβάς σε καθένα από τα δύο tiers, και απαιτεί το γινόμενο «em κελιού × λόγος» να
    // πέσει πάνω στο em του τμήματος. Με σκέτο λόγο υψών (η προηγούμενη εκδοχή) το τμήμα θα
    // έβγαινε στο em του **κελιού**, δηλαδή ~25% μεγαλύτερο από ό,τι ζωγραφίζεται.
    const cellEm = tableTextFont(HEIGHT_MM, false, false).em;
    const spanEm = tableTextFont(HEIGHT_MM, true, false).em;
    const ratio = declaredRatio(spansOf(BOLD_TAIL)[1].style.fontSize);

    expect(ratio).not.toBeNull();
    expect(cellEm * (ratio ?? 0)).toBeCloseTo(spanEm, 9);
    // Ο παρονομαστής: τα δύο em **όντως** διαφέρουν εδώ, αλλιώς η άγκυρα δεν κρίνει τίποτα.
    expect(spanEm).not.toBeCloseTo(cellEm, 6);
  });

  it('Σ4 — τμήμα με ΙΔΙΑ τυπογραφία δεν δηλώνει μέγεθος (καμία περιττή διαδρομή)', () => {
    const runs: readonly TableCellTextRun[] = [{ start: 2, end: 4, style: { textColorHex: '#ff0000' } }];
    expect(spansOf(runs)[1].style.fontSize).toBeUndefined();
    expect(spansOf(runs)[1].style.color).toBe('#ff0000');
  });
});
