/**
 * 🔴 **ADR-768 Δ1 — ΤΟ ΚΟΥΜΠΙ ΤΟΥ ΠΙΝΕΛΟΥ ΔΕΙΧΝΕΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΜΕ ΔΙΤΙΜΟ `aria-pressed`.**
 *
 * ## Η ερώτηση που ρωτούν αυτά τα anchors
 * **«Τι ανακοινώνει το κουμπί;»** — και ειδικά: *«ξεχωρίζει το κλειδωμένο από το μία-χρήση;»*.
 * Το Excel **δεν** το ξεχωρίζει: το κουμπί είναι οπτικά ταυτόσημο μετά από μονό και μετά από
 * διπλό κλικ, και ο χρήστης μαθαίνει τι πάτησε μόνο δοκιμάζοντας. Εδώ το ξεχωρίζει το
 * **σήμα κλειδώματος** — και η ύπαρξή του είναι το κύριο ζητούμενο αυτού του αρχείου.
 *
 * ## 🔴 `user-event`, ΠΟΤΕ `fireEvent.click`
 * Το `fireEvent.click` **δεν στέλνει `mousedown`** και δεν μεταφέρει εστίαση — είναι δομικά
 * τυφλό σε χειριστήρια που ζουν δίπλα σε εστιασμένο πεδίο, και είναι ακριβώς ο λόγος που ένα
 * κουμπί έμεινε «νεκρό στην οθόνη» επί τρεις αναφορές με 717 πράσινα tests. Και **μόνο** το
 * `user-event` παράγει τη σειρά `click → click → dblclick` που κάνει το διπλό κλικ να δουλεύει
 * χωρίς timer (Α1).
 *
 * ⚠️ Καμία **γεωμετρική** άγκυρα: το jsdom δεν υπολογίζει διάταξη, οπότε «πού κάθεται το
 * λουκέτο» δεν είναι ερώτηση που μπορεί να απαντηθεί εδώ. Ελέγχεται η **παρουσία** του.
 *
 * @see ui/components/table-format-toolbar/TableFormatPainterButton.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import elDxfViewer from '@/i18n/locales/el/dxf-viewer.json';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TableFormatPainterButton } from '../TableFormatPainterButton';
import {
  __resetTableFormatPortForTests,
  setTableFormatPort,
  type TableFormatPort,
} from '../../../table-cell-editor/table-format-port';
import {
  __resetTableFormatPainterForTests,
  armTableFormatPainter,
  disarmTableFormatPainter,
  getTableFormatPainterState,
} from '../../../../state/table-format-painter-store';
import {
  __resetTableCellCursorStoreForTests,
  setTableCellCursor,
} from '../../../../state/table-cell-cursor-store';
import type { TableFormatBrush } from '../../../../bim/table/table-format-payload';
import type { RovingItemProps } from '../use-roving-toolbar';
import { setTableCellCursorById } from '../../../../bim/table/__tests__/make-table-entity';

// Ίδιο μοτίβο με τα αδέλφια tests της γραμμής: ο πραγματικός `loadNamespace` κάνει δυναμικό
// import αρχείων που δεν χρειάζονται εδώ — το bundle δίνεται έτοιμο παρακάτω.
jest.mock('@/i18n/lazy-config', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  CRITICAL_NAMESPACES: [],
}));

const i18nInstance = i18next.createInstance();

beforeAll(async () => {
  await i18nInstance.use(initReactI18next).use(ICU).init({
    lng: 'el',
    fallbackLng: 'el',
    resources: {},
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
  });
  i18nInstance.addResourceBundle('el', 'dxf-viewer', elDxfViewer, true, true);
});

const ROVING: RovingItemProps = {
  ref: () => {},
  tabIndex: 0,
  onKeyDown: () => {},
  onFocus: () => {},
};

/** Ένα φορτίο-φάντασμα: το κουμπί δεν το κοιτά ποτέ, μόνο τη **διάρκεια** που το συνοδεύει. */
const BRUSH = { facets: new Set(), rows: 1, columns: 1, cells: [] } as unknown as TableFormatBrush;

/** Τι ζήτησε το κουμπί από τη θύρα — η **πρόθεση**, δίπλα στην κατάσταση που προκύπτει. */
let asked: string[] = [];

/**
 * Η θύρα, με **αληθινό** store από πίσω.
 *
 * Ένα σκέτο `jest.fn()` θα κατέγραφε κλήσεις και θα άφηνε το `aria-pressed` παγωμένο — δηλαδή
 * θα δοκίμαζε ότι το κουμπί «ζητά», όχι ότι **δείχνει**. Η δεύτερη είναι η προδιαγραφή.
 */
function publishPort(canArm: boolean): void {
  setTableFormatPort({
    painter: {
      state: getTableFormatPainterState,
      canArm: () => canArm,
      arm: (mode) => {
        asked.push(`arm:${mode}`);
        armTableFormatPainter(BRUSH, mode);
      },
      disarm: () => {
        asked.push('disarm');
        disarmTableFormatPainter();
      },
    },
  } as TableFormatPort);
}

function renderButton(): void {
  render(
    // Ο `TooltipProvider` υπάρχει στην παραγωγή γύρω από ολόκληρη τη γραμμή (`use-toolbar-surface`).
    // Χωρίς αυτόν το Radix πετά — και θα ήταν αστοχία **του harness**, όχι του κουμπιού.
    <I18nextProvider i18n={i18nInstance}>
      <TooltipProvider>
        <TableFormatPainterButton roving={ROVING} />
      </TooltipProvider>
    </I18nextProvider>,
  );
}

const button = (): HTMLElement => screen.getByRole('button');

/** Το σήμα κλειδώματος — ο **μόνος** `aria-hidden` απόγονος αυτού του κουμπιού. */
const lockBadge = (): Element | null => button().querySelector('span[aria-hidden="true"]');

describe('🔴 ADR-768 Δ1 — το κουμπί του πινέλου μορφοποίησης', () => {
  beforeEach(() => {
    asked = [];
    __resetTableFormatPortForTests();
    __resetTableFormatPainterForTests();
    __resetTableCellCursorStoreForTests();
    // Το `armTableFormatPainter` αρνείται χωρίς ζωντανό δρομέα — και σωστά: «οπλισμένο χωρίς
    // στόχο» είναι κολλημένη διεπαφή. Εδώ ο δρομέας υπάρχει, ώστε να δοκιμάζεται το κουμπί.
    setTableCellCursorById('t1', { rowId: 'r0', colId: 'c0', anchorColId: 'c0' }, 'nav');
  });

  afterEach(() => {
    __resetTableFormatPortForTests();
    __resetTableFormatPainterForTests();
    __resetTableCellCursorStoreForTests();
  });

  it('χωρίς στόχο να ρουφήξει: σβηστό, και **δεν** υπόσχεται τίποτα', () => {
    publishPort(false);
    renderButton();

    // `aria-disabled` και όχι `disabled`: το κουμπί μένει εστιάσιμο (APG toolbar).
    expect(button()).toHaveAttribute('aria-disabled', 'true');
    expect(button()).toHaveAttribute('aria-pressed', 'false');
  });

  it('🔴 μονό κλικ ⇒ «μία χρήση»: πατημένο, ΧΩΡΙΣ λουκέτο', async () => {
    publishPort(true);
    renderButton();

    await userEvent.click(button());

    expect(asked).toEqual(['arm:once']);
    expect(getTableFormatPainterState()).toBe('once');
    expect(button()).toHaveAttribute('aria-pressed', 'true');
    // Το λουκέτο λέει «θα μείνει ενεργό». Στη «μία χρήση» θα ήταν ψέμα.
    expect(lockBadge()).toBeNull();
  });

  it('🔴 δεύτερο μονό κλικ ⇒ σβήνει — ο ίδιος διακόπτης, ανάποδα', async () => {
    publishPort(true);
    renderButton();

    await userEvent.click(button());
    await userEvent.click(button());

    expect(asked).toEqual(['arm:once', 'disarm']);
    expect(getTableFormatPainterState()).toBe('idle');
    expect(button()).toHaveAttribute('aria-pressed', 'false');
  });

  it('🔴 ΔΙΠΛΟ κλικ ⇒ «κλειδωμένο», ΜΕ λουκέτο — και χωρίς κανέναν timer', async () => {
    publishPort(true);
    renderButton();

    await userEvent.dblClick(button());

    // Η φυσική σειρά του browser: `click → click → dblclick`. Η τελική κατάσταση προκύπτει από
    // τη **σειρά**, όχι από κατώφλι χρόνου που ο χρήστης ρυθμίζει στο λειτουργικό του.
    expect(asked).toEqual(['arm:once', 'disarm', 'arm:locked']);
    expect(getTableFormatPainterState()).toBe('locked');
    expect(button()).toHaveAttribute('aria-pressed', 'true');
    // 🏆 Η μία ευκρινής υπεροχή έναντι του Excel, που δείχνει το κουμπί **ταυτόσημο**.
    expect(lockBadge()).not.toBeNull();
  });

  it('🔴 `aria-pressed` είναι ΔΙΤΙΜΟ — ποτέ `"mixed"` (WAI-ARIA: μερική επιλογή, όχι κλείδωμα)', async () => {
    publishPort(true);
    renderButton();

    await userEvent.dblClick(button());

    expect(button().getAttribute('aria-pressed')).not.toBe('mixed');
    expect(['true', 'false']).toContain(button().getAttribute('aria-pressed'));
  });

  it('🔴 ΟΠΛΙΣΜΕΝΟ μένει ενεργό ακόμη κι όταν δεν υπάρχει πια τι να ρουφήξει', async () => {
    // Αλλιώς ο χρήστης θα έχανε τον έναν από τους δύο δρόμους εξόδου — και ο άλλος (`Esc`)
    // δεν ανακοινώνεται πουθενά στην οθόνη.
    publishPort(true);
    renderButton();
    await userEvent.click(button());

    publishPort(false);

    expect(button()).not.toHaveAttribute('aria-disabled');
  });
});
