/**
 * 🔴 ADR-739 §70 — **Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ ΒΕΛΑΚΙ ↶ ΤΗΣ ΚΟΡΔΕΛΑΣ ΔΕΝ ΒΓΑΖΕΙ ΤΟΝ ΠΙΝΑΚΑ ΑΠΟ ΤΗ
 * ΣΥΝΕΔΡΙΑ — ΚΑΙ ΟΤΙ ΑΦΗΝΕΙ ΤΑΥΤΟΣΗΜΗ ΚΑΤΑΣΤΑΣΗ ΜΕ ΤΟ `Ctrl+Z`.**
 *
 * ## Τι ακριβώς έσπασε (αναφορά ιδιοκτήτη, 2026-08-29)
 * Δύο δρόμοι για **μία** εντολή, δύο αποτελέσματα: το `Ctrl+Z` αναιρούσε και η συνεδρία
 * έμενε ανοιχτή· το κουμπί ↶ αναιρούσε και **έκλεινε τη συνεδρία**. Η αιτία δεν ήταν στο
 * `onClick` — ήταν η **προεπιλεγμένη ενέργεια του `mousedown`**, που μετέφερε την εστίαση
 * στο κουμπί πριν καν εκδοθεί το `click`.
 *
 * ## 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ TEST ΕΙΝΑΙ ΑΓΚΥΡΑ ΚΑΙ ΟΧΙ ΣΧΟΛΙΟ
 * Δεν ρωτά «έχει το κουμπί το γνώρισμα Χ;». Στήνει **πραγματικό** πεδίο συνεδρίας με τον
 * **πραγματικό** φύλακα (`useTableCellSessionBlur`), μοντάρει την **πραγματική**
 * `RibbonTabBar`, στέλνει **πραγματικό** `mousedown` — και ρωτά αν ο δρομέας **ΖΕΙ** μετά.
 * Ένα test που έλεγχε το γνώρισμα θα ήταν πράσινο και με τον φρουρό δηλωμένο στη λάθος
 * φάση, ή με το `preventDefault` σε λάθος συμβάν.
 *
 * ## ⚠️ Τι ΔΕΝ αποδεικνύει
 * Ότι η αναίρεση κάνει το σωστό πράγμα στο μοντέλο — αυτό είναι το `CommandHistory`
 * (ADR-032) και το ίδιο και για τους δύο δρόμους. Εδώ ελέγχεται **η επιβίωση της
 * συνεδρίας** και η **ισοδυναμία των δύο δρόμων**, που είναι το συμβόλαιο που έσπασε.
 *
 * @see src/lib/a11y/non-activating-surface.ts — ο κανόνας (καθαρός, ελέγχεται χωριστά)
 * @see docs/centralized-systems/reference/adrs/specs/SPEC-739D-excel-parity.md §70
 */

import React, { useCallback } from 'react';
import { render, screen, fireEvent, createEvent, act } from '@testing-library/react';
import { RibbonTabBar } from '../RibbonTabBar';
import { RibbonCommandProvider, type RibbonCommandsApi } from '../../context/RibbonCommandContext';
import type { RibbonTab } from '../../types/ribbon-types';
import type { TabDragHandlers } from '../../hooks/useRibbonTabDrag';
import { RIBBON_SPECIALTY_ALL } from '../../data/ribbon-tab-specialties';
import {
  TABLE_CELL_SESSION_MARKER,
  useTableCellSessionBlur,
  __resetTableCellSessionFocusForTests,
} from '../../../table-cell-editor/table-cell-session-focus';
import { useTableCellSessionKeys } from '../../../table-cell-editor/use-table-cell-session-keys';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const TABS: readonly RibbonTab[] = [
  { id: 'home', labelKey: 'ribbon.tabs.home', panels: [] },
];

const NO_DRAG: TabDragHandlers = {
  draggingId: null,
  dropTargetId: null,
  onDragStart: () => () => {},
  onDragOver: () => () => {},
  onDragLeave: () => {},
  onDrop: () => () => {},
  onDragEnd: () => {},
};

/** Ό,τι κατέγραψε η συνεδρία μετά από μία διαδρομή αναίρεσης. */
interface SessionOutcome {
  readonly undoRuns: number;
  readonly sessionClosed: boolean;
  readonly fieldStillHasKeyboard: boolean;
}

interface HarnessProps {
  readonly onUndo: () => void;
  readonly onClose: () => void;
}

/**
 * Πεδίο συνεδρίας + κορδέλα, με τους **πραγματικούς** φύλακες και των δύο δρόμων.
 *
 * ⚠️ Το `tabIndex={-1}` υπάρχει για το **jsdom**, όχι για την παραγωγή: εκεί το πεδίο του
 * κελιού είναι `contenteditable` και εστιάζεται φυσιολογικά, ενώ το jsdom δεν θεωρεί ένα
 * `contenteditable` `<div>` εστιάσιμο. Το γνώρισμα `contenteditable` **μένει**, γιατί αυτό
 * είναι που ρωτά ο κανόνας (`isTextEntryTarget`) — δηλαδή η διαδρομή που ελέγχεται είναι η
 * πραγματική, όχι μια παράκαμψη για το test.
 */
const Harness: React.FC<HarnessProps> = ({ onUndo, onClose }) => {
  const commit = useCallback(() => {}, []);
  const reclaim = useCallback(() => {}, []);
  const handleBlur = useTableCellSessionBlur(commit, onClose, reclaim);

  // Ο **πραγματικός** δρόμος του πληκτρολογίου: ίδια σημασιολογία, ίδιο `switch`, ίδιο
  // `onHistory` που καλεί το `CommandHistory`.
  const handleKeyDown = useTableCellSessionKeys({
    mode: 'nav',
    initialText: '',
    commit,
    onMove: () => {},
    onClear: () => {},
    onHistory: (direction) => { if (direction === 'undo') onUndo(); },
    onExtend: () => {},
    onSelectAll: () => {},
    onToggleAbsoluteRef: () => {},
  });

  const commands: RibbonCommandsApi = {
    onToolChange: () => {},
    onComingSoon: () => {},
    onAction: (action) => { if (action === 'undo') onUndo(); },
    canUndo: true,
    canRedo: true,
  };

  return (
    <RibbonCommandProvider commands={commands}>
      <div
        data-testid="cell-field"
        contentEditable
        suppressContentEditableWarning
        tabIndex={-1}
        {...TABLE_CELL_SESSION_MARKER}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      <RibbonTabBar
        tabs={TABS}
        activeTabId="home"
        minimizeState="full"
        onTabActivate={() => {}}
        onTabDoubleClick={() => {}}
        onTabContextMenu={() => {}}
        onCycleMinimize={() => {}}
        drag={NO_DRAG}
        activeSpecialty={RIBBON_SPECIALTY_ALL}
        onSpecialtyChange={() => {}}
      />
    </RibbonCommandProvider>
  );
};

function undoButton(): HTMLElement {
  return screen.getByLabelText('ribbon.commands.undo');
}

/**
 * 🔴 ΤΟ ΟΡΓΑΝΟ ΧΡΕΙΑΖΕΤΑΙ ΒΑΘΜΟΝΟΜΗΣΗ — αλλιώς το test είναι πράσινο για λάθος λόγο.
 *
 * **Το jsdom δεν μεταφέρει εστίαση στο `mousedown`.** Άρα ένα `fireEvent.mouseDown` και μετά
 * «κρατά ακόμη το πεδίο την εστίαση;» περνά **και με σπασμένη υλοποίηση** — δηλαδή θα
 * αποδείκνυε το jsdom, όχι τον κώδικα. Ίδια βαθμονόμηση με το `table-toolbar-keyboard-ownership`
 * (ADR-753 §26.9 `Ο1`): η προεπιλεγμένη ενέργεια αναπαράγεται **ρητά**, και γίνεται **μόνο αν
 * κανείς δεν την απέτρεψε** — αυτή ακριβώς η γραμμή **είναι** το ελάττωμα.
 *
 * @returns `true` αν η μεταφορά εστίασης αποτράπηκε
 */
function pressPointer(target: HTMLElement): boolean {
  const event = createEvent.mouseDown(target, { bubbles: true, cancelable: true, detail: 1 });
  fireEvent(target, event);
  if (!event.defaultPrevented) target.focus();
  return event.defaultPrevented;
}

describe('🔴 ADR-739 §70 — το κουμπί ↶ της κορδέλας με ανοιχτή συνεδρία κελιού', () => {
  let undoRuns: number;
  let sessionClosed: boolean;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetTableCellSessionFocusForTests();
    undoRuns = 0;
    sessionClosed = false;
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetTableCellSessionFocusForTests();
  });

  function mount(): HTMLElement {
    render(<Harness onUndo={() => { undoRuns += 1; }} onClose={() => { sessionClosed = true; }} />);
    const field = screen.getByTestId('cell-field');
    act(() => { field.focus(); });
    expect(document.activeElement).toBe(field);
    return field;
  }

  /** Αφήνει να τρέξει το `requestAnimationFrame` μέσα στο οποίο αποφασίζει ο φύλακας. */
  function settleGuard(): void {
    act(() => { jest.advanceTimersByTime(20); });
  }

  it('🔴 ΤΟ ΕΛΑΤΤΩΜΑ: το `mousedown` ΔΕΝ μετακινεί το πληκτρολόγιο ⇒ η συνεδρία ζει', () => {
    const field = mount();

    // Πραγματικό πάτημα. Ο browser θα μετέφερε την εστίαση ως **προεπιλεγμένη ενέργεια** —
    // εκτός αν κάποιος την ακυρώσει σε αυτό ακριβώς το συμβάν.
    expect(pressPointer(undoButton())).toBe(true);

    fireEvent.click(undoButton());
    settleGuard();

    expect(undoRuns).toBe(1);
    expect(sessionClosed).toBe(false);
    expect(document.activeElement).toBe(field);
  });

  it('🔴 ΧΩΡΙΣ ανοιχτό πεδίο, το κουμπί ΟΦΕΙΛΕΙ να εστιάζεται κανονικά (WAI-ARIA APG)', () => {
    render(<Harness onUndo={() => { undoRuns += 1; }} onClose={() => { sessionClosed = true; }} />);
    act(() => { (document.activeElement as HTMLElement | null)?.blur(); });

    // Καμία επέμβαση: αλλιώς ~700 κουμπιά της κορδέλας θα έμεναν μη εστιάσιμα με ποντίκι,
    // δηλαδή θα αφαιρούσαμε άγκυρα εστίασης από χρήστη αναγνώστη οθόνης χωρίς αντάλλαγμα.
    const button = undoButton();
    expect(pressPointer(button)).toBe(false);
    // Και η βαθμονόμηση το κάνει **συνέπεια**, όχι σημαία: το κουμπί όντως εστιάστηκε.
    expect(document.activeElement).toBe(button);
  });

  it('🔴 Η ΑΓΚΥΡΑ ΙΣΟΔΥΝΑΜΙΑΣ — `Ctrl+Z` και κουμπί ↶ αφήνουν ΤΑΥΤΟΣΗΜΗ κατάσταση', () => {
    // Αυτό είναι το συμβόλαιο που έσπασε, και **κανένα** προηγούμενο test δεν το ρωτούσε:
    // δύο δρόμοι για την ίδια εντολή οφείλουν να αφήνουν την ίδια συνεδρία πίσω τους.
    const fieldA = mount();
    fireEvent.keyDown(fieldA, { key: 'z', code: 'KeyZ', ctrlKey: true });
    settleGuard();
    const viaKeyboard: SessionOutcome = {
      undoRuns,
      sessionClosed,
      fieldStillHasKeyboard: document.activeElement === fieldA,
    };

    // Καθαρή δεύτερη συνεδρία, ίδιο σημείο εκκίνησης.
    document.body.innerHTML = '';
    __resetTableCellSessionFocusForTests();
    undoRuns = 0;
    sessionClosed = false;

    const fieldB = mount();
    pressPointer(undoButton());
    fireEvent.click(undoButton());
    settleGuard();
    const viaRibbon: SessionOutcome = {
      undoRuns,
      sessionClosed,
      fieldStillHasKeyboard: document.activeElement === fieldB,
    };

    expect(viaRibbon).toEqual(viaKeyboard);
    // Και όχι «ταυτόσημα λάθος»: η αναίρεση έγινε και η συνεδρία έζησε, και στους δύο.
    expect(viaKeyboard).toEqual({ undoRuns: 1, sessionClosed: false, fieldStillHasKeyboard: true });
  });

  it('η δήλωση ζει στη ΜΠΑΡΑ, άρα καλύπτει και τα ΥΠΟΛΟΙΠΑ χειριστήριά της', () => {
    // Η αξία της μιας δήλωσης: το κουμπί επανάληψης δεν χρειάστηκε να «θυμηθεί» τίποτα, και
    // το επόμενο κουμπί που θα μπει στη μπάρα δεν θα χρειαστεί κι εκείνο.
    const field = mount();
    expect(pressPointer(screen.getByLabelText('ribbon.commands.redo'))).toBe(true);
    expect(document.activeElement).toBe(field);

    // ⚠️ Και το ρητό όριο (§70.10 #1): οι καρτέλες είναι `draggable`, άρα ο κανόνας τις
    // **εξαιρεί** — αλλιώς το `preventDefault` θα σκότωνε την αναδιάταξη. Το test το δηλώνει
    // ώστε η μέρα που θα φύγει το εγγενές drag να **κοκκινίσει** εδώ, όχι να περάσει σιωπηλά.
    expect(pressPointer(screen.getByRole('tab', { name: /home/i }))).toBe(false);
  });
});
