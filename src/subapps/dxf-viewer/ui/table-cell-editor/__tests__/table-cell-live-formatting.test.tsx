/**
 * 🔴 ADR-753 §28 — **Η ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΜΟΡΦΟΠΟΙΗΣΗ ΦΑΙΝΕΤΑΙ ΟΣΟ ΓΡΑΦΕΙΣ.**
 *
 * ## Τι ακριβώς κλειδώνει, και γιατί καμία υπάρχουσα άγκυρα δεν το έπιανε
 * Το §16.5 ήταν δηλωμένο όριο επί μήνες: το κελί σε γραφή έδειχνε **μονόχρωμο** κείμενο και η
 * μορφοποίηση εμφανιζόταν μόνο **μετά** το `Enter`, όταν ξαναζωγράφιζε ο καμβάς. Και τα 595
 * tests του φακέλου ήταν πράσινα πάνω σε αυτό, γιατί κανένα δεν ρωτούσε **τι χρώμα έχουν τα
 * γράμματα μέσα στο πεδίο** — ρωτούσαν ποιος κατέχει τα πλήκτρα, πού πέφτει ο δρομέας, τι
 * γράφεται στο μοντέλο.
 *
 * Η ομάδα **Α** είναι ακριβώς αυτή η άγκυρα: αποδίδει τον **πραγματικό** επεξεργαστή με
 * πραγματικά `runs` και διαβάζει το **DOM** — όχι εικόνα, όχι πρόθεση.
 *
 * ⚠️ Ο έλεγχος γίνεται ανά **χαρακτήρα** και όχι «υπάρχει κάπου κόκκινο»: το ADR-753 §26.1
 * κατέγραψε περιστατικό όπου τα μάτια έλεγαν «τέσσερα έντονα» και το DOM έλεγε «δύο». Ένα
 * assertion που ρωτά μόνο «βάφτηκε κάτι;» θα ήταν πράσινο και στις δύο περιπτώσεις.
 *
 * @see ui/table-cell-editor/table-cell-editor-spans.ts — ο υπολογισμός
 * @see docs/centralized-systems/reference/adrs/ADR-753-table-cell-rich-text.md §28
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * 🔴 Ο γραφέας του προχείρου, κατασκοπευμένος — δες την **ομάδα Ε**.
 *
 * Το `requireActual` κρατά **όλες** τις υπόλοιπες εξαγωγές ζωντανές: ο επεξεργαστής καλεί έξι
 * ακόμη πράγματα από αυτό το store, και ένα σκέτο `jest.mock` θα τα έκανε `undefined` — δηλαδή
 * θα αντικαθιστούσε το ελάττωμα που κυνηγάμε με ένα δικό μας.
 */
const setDraftSpy = jest.fn();
jest.mock('../../../state/table-cell-cursor-store', () => ({
  ...jest.requireActual('../../../state/table-cell-cursor-store'),
  setTableCellCursorDraft: (value: string) => setDraftSpy(value),
}));

import { TableCellEditorOverlay } from '../TableCellEditorOverlay';
import { tableCellEditorSpans, widestCellTypography } from '../table-cell-editor-spans';
import {
  setTableTextFieldSelection,
  tableTextFieldSelection,
  tableTextFieldValue,
} from '../table-text-field-ops';
import { baseCellStyle } from '../../../bim/table/table-style';
import { hierarchicalTableStyle } from '../../../bim/table/__tests__/hierarchical-table-style-fixture';
import type { TextEditorAnchor } from '../../text-toolbar/TextEditorAnchorLayer';
import type { TableCellTextRun } from '../../../types/table';

const ANCHOR: TextEditorAnchor = {
  project: () => ({ x: 0, y: 0 }),
  subscribe: () => () => {},
  size: { width: 120, height: 24 },
};

const NOOP = (): void => {};
const CELL_STYLE = baseCellStyle(hierarchicalTableStyle().rowClasses.data);

/** «ΝΕΣΤΩΡ» με τα δύο τελευταία γράμματα κόκκινα — το παράδειγμα του ιδιοκτήτη. */
const RED = '#ff0000';
/**
 * Το ίδιο χρώμα όπως το **επιστρέφει το CSSOM**.
 *
 * Δεν είναι λεπτομέρεια του test: το `element.style.color` δεν επιστρέφει ποτέ ό,τι γράφτηκε,
 * επιστρέφει τη **σειριοποίηση** του parser. Ένα assertion πάνω στο `#ff0000` θα έλεγχε τι
 * νομίζουμε ότι γράψαμε αντί για το τι λέει η οθόνη — και η διαφορά των δύο είναι ακριβώς ο
 * λόγος που αυτό το ADR απαιτεί ανάγνωση DOM αντί για οπτική επιθεώρηση.
 */
const RED_AS_PAINTED = 'rgb(255, 0, 0)';
const OMEGA_RHO: readonly TableCellTextRun[] = [{ start: 4, end: 6, style: { textColorHex: RED } }];

function mountEditor(overrides: {
  draft: string;
  initialText: string;
  runs?: readonly TableCellTextRun[];
}): HTMLElement {
  render(
    <TableCellEditorOverlay
      entityId="tbl-1"
      rowId="r1"
      colId="c1"
      mode="edit"
      draft={overrides.draft}
      initialText={overrides.initialText}
      {...(overrides.runs !== undefined && { runs: overrides.runs })}
      cellStyle={CELL_STYLE}
      caretRevision={0}
      anchor={ANCHOR}
      readOnly={false}
      onCommit={NOOP}
      onMove={NOOP}
      onClear={NOOP}
      onHistory={NOOP}
      onExtend={NOOP}
      onSelectAll={NOOP}
      onToggleAbsoluteRef={NOOP}
      onCopy={NOOP}
      onCut={NOOP}
      onPaste={NOOP}
      onOpenLink={NOOP}
    />,
  );
  const field = document.querySelector<HTMLElement>('[data-table-rich-text="true"]');
  if (!field) throw new Error('ο πλούσιος επεξεργαστής δεν αποδόθηκε');
  return field;
}

/** Το ίδιο, με δεμένο (read-only) κελί — δες την ομάδα Ε. */
function mountEditorReadOnly(): HTMLElement {
  render(
    <TableCellEditorOverlay
      entityId="tbl-1" rowId="r1" colId="c1" mode="edit"
      draft="ΤΙΜΗ" initialText="ΤΙΜΗ" cellStyle={CELL_STYLE}
      caretRevision={0} anchor={ANCHOR} readOnly
      onCommit={NOOP} onMove={NOOP} onClear={NOOP} onHistory={NOOP} onExtend={NOOP}
      onSelectAll={NOOP} onToggleAbsoluteRef={NOOP}
      onCopy={NOOP} onCut={NOOP} onPaste={NOOP} onOpenLink={NOOP}
    />,
  );
  const field = document.querySelector<HTMLElement>('[data-table-rich-text="true"]');
  if (!field) throw new Error('ο πλούσιος επεξεργαστής δεν αποδόθηκε');
  return field;
}

/**
 * Το χρώμα **κάθε χαρακτήρα** του πεδίου, διαβασμένο από το DOM.
 *
 * Κενό αλφαριθμητικό ⇒ «κληρονομεί από το κελί». Δες την κεφαλίδα για το γιατί ανά χαρακτήρα.
 */
function colourPerCharacter(field: HTMLElement): string[] {
  const out: string[] = [];
  for (const span of Array.from(field.querySelectorAll('span'))) {
    const colour = (span as HTMLElement).style.color;
    for (let i = 0; i < (span.textContent ?? '').length; i += 1) out.push(colour);
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// ΟΜΑΔΑ Α — Η ΑΓΚΥΡΑ: το βαμμένο κείμενο υπάρχει ΜΕΣΑ στο πεδίο, χωρίς δέσμευση
// ──────────────────────────────────────────────────────────────────────────────

describe('Α — η μορφοποίηση φαίνεται μέσα στο πεδίο που γράφεται', () => {
  test('Α1: τα δύο τελευταία γράμματα είναι κόκκινα και τα τέσσερα πρώτα όχι', () => {
    const field = mountEditor({ draft: 'ΝΕΣΤΩΡ', initialText: 'ΝΕΣΤΩΡ', runs: OMEGA_RHO });
    expect(tableTextFieldValue(field)).toBe('ΝΕΣΤΩΡ');
    expect(colourPerCharacter(field)).toEqual(['', '', '', '', RED_AS_PAINTED, RED_AS_PAINTED]);
  });

  test('Α2: κελί ΧΩΡΙΣ runs δεν δηλώνει καμία τυπογραφία — η αναλλοίωτη του §28', () => {
    const field = mountEditor({ draft: 'ΝΕΣΤΩΡ', initialText: 'ΝΕΣΤΩΡ' });
    const spans = Array.from(field.querySelectorAll('span'));
    expect(spans).toHaveLength(1);
    // Ό,τι μετακινεί glyph πρέπει να απουσιάζει· η υπογράμμιση δηλώνεται πάντα (δες
    // `spanCssDelta`) και είναι μετρικά ουδέτερη.
    const { color, fontWeight, fontStyle, fontSize, fontFamily } = spans[0].style;
    expect({ color, fontWeight, fontStyle, fontSize, fontFamily }).toEqual({
      color: '', fontWeight: '', fontStyle: '', fontSize: '', fontFamily: '',
    });
  });

  test('Α3: το κείμενο του DOM είναι ΑΚΡΙΒΩΣ το πρόχειρο — κανένας χαρακτήρας δεν χάθηκε', () => {
    const field = mountEditor({ draft: 'Α  Β', initialText: 'Α  Β', runs: OMEGA_RHO });
    expect(field.textContent).toBe('Α  Β');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΟΜΑΔΑ Β — ΟΙ ΔΕΙΚΤΕΣ ΑΚΟΛΟΥΘΟΥΝ ΤΟ ΠΡΟΧΕΙΡΟ (ο ίδιος κανόνας με τη δέσμευση)
// ──────────────────────────────────────────────────────────────────────────────

describe('Β — τα runs μετατοπίζονται στο πρόχειρο', () => {
  test('Β1: πληκτρολόγηση ΣΤΗΝ ΑΡΧΗ σπρώχνει το βάψιμο δεξιά', () => {
    // Το δεσμευμένο είναι «ΝΕΣΤΩΡ» με [4,6) κόκκινα· ο χρήστης πρόσθεσε «Ο» μπροστά.
    const spans = tableCellEditorSpans({
      draft: 'ΟΝΕΣΤΩΡ',
      committedText: 'ΝΕΣΤΩΡ',
      runs: OMEGA_RHO,
      style: CELL_STYLE,
    });
    expect(spans.map((s) => s.text)).toEqual(['ΟΝΕΣΤ', 'ΩΡ']);
    expect(spans[1].style.color).toBe(RED);   // καθαρό επίπεδο: εδώ δεν έχει περάσει CSSOM
  });

  test('Β2: χωρίς μετατόπιση θα έβαφε ΑΛΛΑ γράμματα — η μετάλλαξη που πιάνει το Β1', () => {
    // Η «λάθος» υλοποίηση: δείκτες του δεσμευμένου, εφαρμοσμένοι ωμά στο πρόχειρο.
    const naive = tableCellEditorSpans({
      draft: 'ΟΝΕΣΤΩΡ',
      committedText: 'ΟΝΕΣΤΩΡ', // ⟵ ψεύτικη βάση: «το πρόχειρο ΕΙΝΑΙ το δεσμευμένο»
      runs: OMEGA_RHO,
      style: CELL_STYLE,
    });
    expect(naive.map((s) => s.text)).toEqual(['ΟΝΕΣ', 'ΤΩ', 'Ρ']);
    // Δηλαδή θα βάφονταν τα «ΤΩ» αντί για τα «ΩΡ» — ορατό, σιωπηλό, και ακριβώς το
    // ελάττωμα που περιγράφει το §25.
    expect(naive[1].text).not.toBe('ΩΡ');
  });

  test('Β3: το κενό πρόχειρο δίνει ΕΝΑ κενό τμήμα — ο δρομέας χρειάζεται κόμβο', () => {
    const spans = tableCellEditorSpans({
      draft: '', committedText: 'ΝΕΣΤΩΡ', runs: OMEGA_RHO, style: CELL_STYLE,
    });
    expect(spans).toEqual([{ text: '', style: {} }]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΟΜΑΔΑ Γ — ΟΙ ΤΡΕΙΣ ΠΡΑΞΕΙΣ ΤΟΥ ΠΕΔΙΟΥ ΠΑΝΩ ΣΕ ΠΟΛΛΑ ΤΜΗΜΑΤΑ
// ──────────────────────────────────────────────────────────────────────────────

describe('Γ — επιλογή που περνά ΠΑΝΩ ΑΠΟ ΟΡΙΟ τμήματος', () => {
  test('Γ1: δείκτες που διασχίζουν δύο span διαβάζονται και ξαναγράφονται ίδιοι', () => {
    const field = mountEditor({ draft: 'ΝΕΣΤΩΡ', initialText: 'ΝΕΣΤΩΡ', runs: OMEGA_RHO });
    // [3,5) πέφτει μέσα στο πρώτο span ΚΑΙ μέσα στο δεύτερο — ακριβώς το σημείο όπου ένας
    // δικός μας βρόχος πάνω σε κόμβους θα μπορούσε να διαφωνήσει με το `textContent`.
    setTableTextFieldSelection(field, 3, 5);
    expect(tableTextFieldSelection(field)).toEqual({ start: 3, end: 5 });
  });

  test('Γ2: δείκτης εκτός ορίων κόβεται στο τέλος — ποτέ εξαίρεση', () => {
    const field = mountEditor({ draft: 'ΝΕΣΤΩΡ', initialText: 'ΝΕΣΤΩΡ', runs: OMEGA_RHO });
    setTableTextFieldSelection(field, 2, 999);
    expect(tableTextFieldSelection(field)).toEqual({ start: 2, end: 6 });
  });

  test('Γ3: το όριο δύο τμημάτων ανήκει στο ΑΡΙΣΤΕΡΟ — ο δρομέας κληρονομεί από πριν', () => {
    const field = mountEditor({ draft: 'ΝΕΣΤΩΡ', initialText: 'ΝΕΣΤΩΡ', runs: OMEGA_RHO });
    setTableTextFieldSelection(field, 4, 4);
    const selection = window.getSelection();
    expect(selection?.rangeCount).toBe(1);
    // Ο κόμβος στον οποίο κάθισε ο δρομέας είναι το **πρώτο** (άβαφο) τμήμα, στο τέλος του.
    const range = selection?.getRangeAt(0);
    expect(range?.startContainer.nodeValue).toBe('ΝΕΣΤ');
    expect(range?.startOffset).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΟΜΑΔΑ Δ — ΤΟ ΚΟΥΤΙ ΜΕΤΡΙΕΤΑΙ ΜΕ ΤΟ ΧΕΙΡΟΤΕΡΟ, ΠΟΤΕ ΔΕΝ ΚΟΒΕΙ
// ──────────────────────────────────────────────────────────────────────────────

describe('Δ — η πλατύτερη τυπογραφία', () => {
  test('Δ1: χωρίς runs δεν ζητείται καμία αλλαγή μέτρησης', () => {
    expect(widestCellTypography({
      draft: 'ΝΕΣΤΩΡ', committedText: 'ΝΕΣΤΩΡ', style: CELL_STYLE,
    })).toBeNull();
  });

  test('Δ2: runs που δηλώνουν ό,τι ΗΔΗ ισχύει δεν πλαταίνουν τίποτα', () => {
    expect(widestCellTypography({
      draft: 'ΝΕΣΤΩΡ',
      committedText: 'ΝΕΣΤΩΡ',
      runs: [{ start: 0, end: 3, style: { textHeightMm: CELL_STYLE.textHeightMm } }],
      style: CELL_STYLE,
    })).toBeNull();
  });

  test('Δ3: διπλάσιο ύψος σε δύο γράμματα ανεβάζει ΟΛΗ τη μέτρηση', () => {
    const widest = widestCellTypography({
      draft: 'ΝΕΣΤΩΡ',
      committedText: 'ΝΕΣΤΩΡ',
      runs: [{ start: 4, end: 6, style: { textHeightMm: CELL_STYLE.textHeightMm * 2 } }],
      style: CELL_STYLE,
    });
    expect(widest?.heightMm).toBe(CELL_STYLE.textHeightMm * 2);
  });

  test('Δ4: τα έντονα μετρούν ως πλατύτερα, ακόμη κι όταν το ύψος δεν αλλάζει', () => {
    const widest = widestCellTypography({
      draft: 'ΝΕΣΤΩΡ',
      committedText: 'ΝΕΣΤΩΡ',
      runs: [{ start: 0, end: 2, style: { bold: true } }],
      style: { ...CELL_STYLE, bold: false },
    });
    expect(widest).toEqual({ heightMm: CELL_STYLE.textHeightMm, bold: true });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΟΜΑΔΑ Ε — 🔴 ΟΙ ΧΕΙΡΙΣΤΕΣ **ΕΚΤΕΛΟΥΝΤΑΙ**, ΔΕΝ ΑΡΚΕΙ ΝΑ ΥΠΑΡΧΟΥΝ
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΟΜΑΔΑ — ΤΗΝ ΓΕΝΝΗΣΕ ΜΕΤΡΗΜΕΝΗ ΑΣΤΟΧΙΑ, ΟΧΙ ΠΡΟΒΛΕΨΗ.**
 *
 * Στη διάρκεια του §28 ο επεξεργαστής έμεινε **χωρίς την εισαγωγή** του
 * `setTableCellCursorDraft`. Η εφαρμογή έσκαγε στο **πρώτο πάτημα πλήκτρου** μέσα σε κελί
 * (`ReferenceError: setTableCellCursorDraft is not defined`) — και **και τα 608 tests του
 * φακέλου ήταν πράσινα**, γιατί κανένα δεν **εκτελούσε** τον χειριστή: όλα απέδιδαν το
 * component, διάβαζαν DOM, πατούσαν πλήκτρα που δρομολογούνται αλλού.
 *
 * Ένας χειριστής που **υπάρχει** δεν είναι χειριστής που **δουλεύει**. Ο μεταγλωττιστής θα το
 * έπιανε, αλλά ο N.17 τον απαγορεύει στον πράκτορα — άρα η άγκυρα είναι το **μόνο** όργανο
 * που μένει, και οφείλει να πυροδοτεί **πραγματικά συμβάντα** στο **πραγματικό** στοιχείο.
 */
describe('Ε — οι χειριστές εισόδου εκτελούνται πάνω στο πραγματικό στοιχείο', () => {
  beforeEach(() => setDraftSpy.mockClear());

  test('Ε1: ένα `input` φτάνει στο πρόχειρο — ο δρόμος που έσπαγε', () => {
    const field = mountEditor({ draft: 'ΝΕΣΤΩΡ', initialText: 'ΝΕΣΤΩΡ', runs: OMEGA_RHO });
    field.textContent = 'ΝΕΣΤΩΡΑ';
    fireEvent.input(field);
    expect(setDraftSpy).toHaveBeenCalledWith('ΝΕΣΤΩΡΑ');
  });

  test('Ε2: η αλλαγή γραμμής ισοπεδώνεται πριν φτάσει στο μοντέλο', () => {
    const field = mountEditor({ draft: '', initialText: '' });
    field.textContent = 'ΠΡΩΤΗ\nΔΕΥΤΕΡΗ';
    fireEvent.input(field);
    expect(setDraftSpy).toHaveBeenCalledWith('ΠΡΩΤΗ ΔΕΥΤΕΡΗ');
  });

  test('Ε3: το τέλος σύνθεσης IME ξαναδιαβάζει το πεδίο — ο δεύτερος δρόμος', () => {
    const field = mountEditor({ draft: 'Α', initialText: 'Α' });
    field.textContent = 'Ά';
    fireEvent.compositionEnd(field);
    expect(setDraftSpy).toHaveBeenCalledWith('Ά');
  });

  test('Ε4: δεμένο κελί ΑΡΝΕΙΤΑΙ την είσοδο — και η άρνηση είναι εκτελεσμένη, όχι δηλωμένη', () => {
    const field = mountEditorReadOnly();
    const event = new Event('beforeinput', { bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  test('Ε5: γράψιμο κελί ΔΕΝ αρνείται — αλλιώς ο φύλακας θα έκλεινε τα πάντα', () => {
    const field = mountEditor({ draft: 'Α', initialText: 'Α' });
    const event = new Event('beforeinput', { bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ΟΜΑΔΑ ΣΤ — Η ΕΠΙΛΟΓΗ ΔΕΝ ΣΒΗΝΕΙ ΤΟ ΧΡΩΜΑ (§28.13)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 **Το ελάττωμα που βρήκε ο ιδιοκτήτης πάνω στην πρώτη δουλεύουσα εκδοχή** (2026-08-11):
 * μαρκάροντας βαμμένα γράμματα, ο browser τα έβαφε με το **δικό του** `highlighttext` — άρα η
 * μορφοποίηση εξαφανιζόταν **τη μόνη στιγμή που ο χρήστης την επιθεωρεί**, πριν πατήσει την
 * επόμενη εντολή. Το Excel κρατά το μελάνι κάτω από ημιδιαφανές highlight.
 *
 * ⚠️ **Δηλωμένο όριο της άγκυρας**: το jsdom δεν υπολογίζει ψευδοστοιχεία, οπότε **κανένα**
 * test δεν μπορεί να μετρήσει το ζωγραφισμένο χρώμα μιας επιλογής. Ό,τι κλειδώνεται εδώ είναι
 * τα **δύο μισά** που μαζί κάνουν τη δουλειά: ότι το πεδίο **φέρει** την κλάση, και ότι το
 * φύλλο στυλ **δηλώνει** `color: inherit` και για τα τμήματα. Η ζωγραφιά επαληθεύεται στην
 * οθόνη (§28.12) — και ο κανόνας μετρήθηκε ζωντανά ότι **γίνεται δεκτός** από τον μηχανισμό
 * CSS, δηλαδή δεν πετάγεται σιωπηλά ως άκυρος.
 */
describe('ΣΤ — η επιλογή κρατά το χρώμα του τμήματος', () => {
  test('ΣΤ1: το πεδίο φέρει την κλάση που μεταφέρει τον κανόνα', () => {
    const field = mountEditor({ draft: 'ΝΕΣΤΩΡ', initialText: 'ΝΕΣΤΩΡ', runs: OMEGA_RHO });
    expect(field.className).toContain('richField');
  });

  test('ΣΤ2: ο κανόνας δηλώνει `color: inherit` ΚΑΙ για τα τμήματα, όχι μόνο για το κουτί', () => {
    const css = readFileSync(join(__dirname, '..', 'TableCellEditor.module.css'), 'utf8');
    // Χωρίς τον δεύτερο επιλογέα ο κανόνας θα ίσχυε μόνο για κείμενο εκτός τμήματος — δηλαδή
    // για τίποτα, αφού κάθε χαρακτήρας ζει μέσα σε `span`.
    expect(css).toContain('.richField::selection');
    expect(css).toContain('.richField *::selection');
    expect(css).toContain('color: inherit');
    // ⚠️ Κανένα σταθερό χρώμα: θα ήταν τρίτη αυθεντία για το μελάνι (δες την κεφαλίδα του CSS).
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
