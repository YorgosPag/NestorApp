/**
 * 🔴 ADR-833 Φάση 4 — **ΤΟ ΚΟΥΤΙ ΜΕΤΟΝΟΜΑΣΙΑΣ ΠΡΕΠΕΙ ΝΑ ΕΠΙΒΙΩΝΕΙ ΤΟΥ ΜΕΝΟΥ ΠΟΥ ΤΟ ΑΝΟΙΞΕ.**
 *
 * ## Το σύμπτωμα (ζωντανή επαλήθευση 2026-09-01)
 * «Δεξί κλικ σε καρτέλα → Μετονομασία» ⇒ **τίποτα**. Το `<input>` δεν υπήρχε στο DOM ούτε 2″
 * αργότερα. Ο overlay ήταν μονταρισμένος, το store έγραφε, και οι πέντε εντολές είχαν ήδη
 * διορθωθεί (§5.4.10) — το κουτί εξακολουθούσε να μη φαίνεται **ποτέ**.
 *
 * ## Η υπόθεση που το handoff έδινε ως κύρια — και που ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΙΕΨΕΥΣΕ
 * *«ο overlay κάνει `subscribeTransform(commit)`, άρα κάθε ειδοποίηση προβολής τον κλείνει»*.
 * Η ομάδα (β) το μετρά και το αποκλείει: το `updateImmediateTransform` ειδοποιεί **μόνο** σε
 * πραγματική αλλαγή `scale`/`offset`, οπότε ένα απλό ξαναζωγράφισμα **δεν** αγγίζει τη
 * συνεδρία. Η δέσμευση σε πραγματικό pan/zoom παραμένει δηλωμένη απόφαση — και κλειδώνεται
 * εδώ **ως τέτοια**, ώστε να μη «διορθωθεί» κατά λάθος από όποιον διαβάσει το ίδιο handoff.
 *
 * ## Η ΠΡΑΓΜΑΤΙΚΗ αιτία — ίχνος εστίασης, όχι εικασία
 * ```
 *   focusin  menuContent      ← το μενού πήρε την εστίαση όταν άνοιξε
 *   focusin  INPUT(rename)    ← ο επεξεργαστής μοντάρεται με `autoFocus`
 *   focusout INPUT(rename)    ← ⚡ η ΠΑΓΙΔΑ ΕΣΤΙΑΣΗΣ του μενού τον τραβά πίσω
 *   focusin  menuContent      ← …και κερδίζει
 * ```
 * Το `<input>` έκανε `blur`· ο `onBlur={commit}` το διάβασε —**σωστά**— ως «ο άνθρωπος
 * έφυγε», δέσμευσε με **ίδιο όνομα** (no-op) και έκλεισε. Το κουτί άνοιγε **πάντα** και
 * πέθαινε **πάντα**, στο ίδιο καρέ, σιωπηλά.
 *
 * 🔑 Ο ένοχος δεν είναι ο επεξεργαστής: είναι ότι η παγίδα ενός `modal` μενού Radix μένει
 * **οπλισμένη** ανάμεσα στο «ο άνθρωπος διάλεξε» και στο «το μενού ξεφορτώθηκε» — παγίδα σε
 * **passive** effect, `autoFocus` σε **layout**. Η διόρθωση ζει στον κύκλο ζωής του κελύφους
 * (`useAnchoredContextMenu.runAfterClose`) και **δεν μαντεύει χρόνο**: το Radix ανακοινώνει
 * τη στιγμή που παραδίδει την εστίαση (`onCloseAutoFocus`).
 *
 * ## Γιατί καμία υπάρχουσα άγκυρα δεν το έβλεπε
 * Το `table-worksheet-menu-actions.test.tsx` **μοκάρει** το `openWorksheetRenameById` και
 * σταματά στο «η εντολή φτάνει στη θύρα». Καμία δοκιμασία δεν περνούσε από το **πραγματικό
 * μενού Radix μαζί με τον πραγματικό overlay** — δηλαδή από το μοναδικό σημείο όπου οι δύο
 * διεκδικούν την ίδια εστίαση.
 *
 * @see ../../components/dxf-context-menu/use-anchored-context-menu.ts — ο ΕΝΑΣ ιδιοκτήτης
 * @see ../TableWorksheetRenameOverlay.tsx — ο επεξεργαστής (και γιατί το blur δεσμεύει)
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createRef, type RefObject } from 'react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const execute = jest.fn();
jest.mock('../../../core/commands', () => ({
  useCommandHistory: () => ({ execute }),
}));

jest.mock('../../../systems/levels', () => ({
  useLevels: () => ({ currentLevelId: 'lvl', getLevelScene: () => ({ entities: [] }) }),
}));

const applyWorksheet = jest.fn(() => true);
jest.mock('../use-table-worksheet-apply', () => ({
  useTableWorksheetApply: () => applyWorksheet,
  useTableWorksheetAdd: () => jest.fn(),
}));

const resolveTableById = jest.fn(() => null);
jest.mock('../table-entity-lookup', () => ({
  resolveTableById: (...args: unknown[]) => resolveTableById(...args),
}));

import { useAnchoredContextMenu } from '../../components/dxf-context-menu/use-anchored-context-menu';
import { TableWorksheetRenameOverlay } from '../TableWorksheetRenameOverlay';
import {
  TableWorksheetContextMenu,
  type TableWorksheetContextMenuHandle,
  type TableWorksheetMenuTarget,
} from '../../components/TableWorksheetContextMenu';
import {
  __resetTableWorksheetRenameForTests,
  openTableWorksheetRename,
} from '../../../state/table-worksheet-rename-store';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { tableWorksheetId } from '../../../types/table-worksheet';

const WS = tableWorksheetId('ws_2');

const TARGET: TableWorksheetMenuTarget = {
  entityId: 'tbl_1',
  worksheetId: WS,
  name: 'Fyllo2',
  canAdd: true,
  canDelete: true,
  canMoveLeft: true,
  canMoveRight: true,
};

/** Ό,τι γράφει το `openWorksheetRename` — χωρίς τη γεωμετρία, που δεν είναι το θέμα εδώ. */
function openRename(): void {
  openTableWorksheetRename({
    entityId: 'tbl_1',
    worksheetId: WS,
    initialName: '',
    placeholder: 'Fyllo2',
    anchorRect: { x: 10, y: 20, width: 80, height: 18 },
  });
}

function renameField(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>('input[type="text"]');
}

/** Η στιγμή που το Radix παραδίδει την εστίαση ζει σε `setTimeout(0)` — δώσ' της να τρέξει. */
async function settleFocusHandover(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

beforeEach(() => {
  __resetTableWorksheetRenameForTests();
  updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  jest.clearAllMocks();
});

describe('ADR-833 F4 — (a) ο επεξεργαστής υπάρχει όταν το store ανοίξει', () => {
  it('το `<input>` μπαίνει στο DOM (η προϋπόθεση κάθε άλλης ερώτησης)', () => {
    render(<TableWorksheetRenameOverlay />);
    act(() => openRename());
    expect(renameField()).not.toBeNull();
  });
});

describe('ADR-833 F4 — (b) η ΠΡΟΒΟΛΗ: η υπόθεση που διαψεύστηκε, και η απόφαση που μένει', () => {
  it('🔴 ξαναζωγράφισμα με ΙΔΙΕΣ τιμές ΔΕΝ αγγίζει τη συνεδρία (η υπόθεση καταρρέει εδώ)', () => {
    render(<TableWorksheetRenameOverlay />);
    act(() => openRename());
    act(() => updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 }));
    expect(renameField()).not.toBeNull();
  });

  it('πραγματικό pan/zoom ΔΕΣΜΕΥΕΙ και κλείνει — δηλωμένη απόφαση, όχι παρενέργεια', () => {
    render(<TableWorksheetRenameOverlay />);
    act(() => openRename());
    act(() => updateImmediateTransform({ scale: 2, offsetX: 5, offsetY: 5 }));
    expect(renameField()).toBeNull();
  });
});

describe('🔴 ADR-833 F4 — (g) ΜΕΝΟΥ ΚΑΙ ΕΠΕΞΕΡΓΑΣΤΗΣ ΔΙΕΚΔΙΚΟΥΝ ΤΗΝ ΙΔΙΑ ΕΣΤΙΑΣΗ', () => {
  function mountMenuAndOverlay(onRename: () => void): RefObject<TableWorksheetContextMenuHandle | null> {
    const ref = createRef<TableWorksheetContextMenuHandle>();
    render(
      <>
        <TableWorksheetContextMenu
          ref={ref}
          onAdd={() => {}}
          onRename={onRename}
          onMoveLeft={() => {}}
          onMoveRight={() => {}}
          onDelete={() => {}}
        />
        <TableWorksheetRenameOverlay />
      </>,
    );
    return ref;
  }

  async function chooseRename(
    ref: RefObject<TableWorksheetContextMenuHandle | null>,
  ): Promise<void> {
    act(() => ref.current!.open(10, 20, TARGET));
    fireEvent.click(await screen.findByText('table.worksheetMenu.rename'));
  }

  it('🔑 ΤΟ ΚΟΥΤΙ ΕΠΙΒΙΩΝΕΙ — το μενού παραδίδει την εστίαση, δεν την αρπάζει πίσω', async () => {
    const ref = mountMenuAndOverlay(openRename);
    await chooseRename(ref);
    await settleFocusHandover();
    expect(renameField()).not.toBeNull();
  });

  it('🔑 …και την ΚΡΑΤΑΕΙ: χωρίς εστιασμένο πεδίο, κανένα πλήκτρο δεν φτάνει σε αυτό', async () => {
    const ref = mountMenuAndOverlay(openRename);
    await chooseRename(ref);
    await settleFocusHandover();
    expect(document.activeElement).toBe(renameField());
  });

  it('🔴 η εντολή ΕΚΤΕΛΕΙΤΑΙ ΑΦΟΥ φύγει το μενού — ποτέ όσο η παγίδα του είναι οπλισμένη', async () => {
    const order: string[] = [];
    const ref = mountMenuAndOverlay(() => {
      order.push(document.querySelector('[role="menu"]') ? 'menu-still-open' : 'menu-gone');
      openRename();
    });
    await chooseRename(ref);
    await settleFocusHandover();
    expect(order).toEqual(['menu-gone']);
  });

  it('οι υπόλοιπες εντολές ΔΕΝ αναβάλλονται — τρέχουν στο πάτημα, όπως πάντα', async () => {
    const hits: string[] = [];
    const ref = createRef<TableWorksheetContextMenuHandle>();
    render(
      <TableWorksheetContextMenu
        ref={ref}
        onAdd={() => hits.push('add')}
        onRename={() => hits.push('rename')}
        onMoveLeft={() => {}}
        onMoveRight={() => {}}
        onDelete={() => hits.push('delete')}
      />,
    );
    act(() => ref.current!.open(10, 20, TARGET));
    fireEvent.click(await screen.findByText('table.worksheetMenu.delete'));
    expect(hits).toEqual(['delete']);
  });
});

/**
 * 🔴 Η **δήλωση** προς το Radix, ξεχωριστά από το αν σήμερα την ακούει κανείς.
 *
 * ⚠️ Μετρημένο 2026-09-01: ο κρυφός trigger είναι `<span>` **χωρίς `tabindex`**, άρα το
 * `triggerRef.current?.focus()` του Radix είναι **ήδη** no-op — μια μετάλλαξη που έσβηνε το
 * `preventDefault` έμενε πράσινη στην ομάδα (γ). Δηλαδή ο φρουρός θα ήταν **αδρανής**, το
 * είδος που το `ssot:audit --dormant` κυνηγά. Δεν διαγράφεται (N.7.2 #4: ζώνη + τιράντες —
 * την ημέρα που κάποιος δώσει `tabindex` στον trigger, το ελάττωμα επιστρέφει σιωπηλά) και
 * δεν μένει **αμέτρητος**: εδώ ελέγχεται η ίδια η δήλωση.
 */
describe('🔴 ADR-833 F4 — (d) Η ΔΗΛΩΣΗ ΠΡΟΣ ΤΟ ΜΕΝΟΥ, ΜΕΤΡΗΜΕΝΗ', () => {
  function closeEvent(): Event {
    return new Event('closeAutoFocus', { cancelable: true });
  }

  it('🔑 με εκκρεμή πράξη: το μενού ΠΑΡΑΙΤΕΙΤΑΙ από την εστίαση, και η πράξη τρέχει', () => {
    const { result } = renderHook(() => useAnchoredContextMenu(createRef()));
    const ran = jest.fn();
    act(() => result.current.runAfterClose(ran));

    const event = closeEvent();
    act(() => result.current.onCloseAutoFocus(event));

    expect(event.defaultPrevented).toBe(true);
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it('🔑 ΧΩΡΙΣ εκκρεμή πράξη: το Radix κάνει ό,τι κάνει πάντα — μηδέν αλλαγή για τα άλλα μενού', () => {
    const { result } = renderHook(() => useAnchoredContextMenu(createRef()));

    const event = closeEvent();
    act(() => result.current.onCloseAutoFocus(event));

    expect(event.defaultPrevented).toBe(false);
  });

  it('η πράξη καταναλώνεται ΜΙΑ φορά — δεύτερο κλείσιμο δεν την ξανατρέχει', () => {
    const { result } = renderHook(() => useAnchoredContextMenu(createRef()));
    const ran = jest.fn();
    act(() => result.current.runAfterClose(ran));

    act(() => result.current.onCloseAutoFocus(closeEvent()));
    const second = closeEvent();
    act(() => result.current.onCloseAutoFocus(second));

    expect(ran).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(false);
  });
});
