/**
 * Φ — **ΟΙ ΕΝΕΡΓΕΙΕΣ ΤΗΣ ΟΝΤΟΤΗΤΑΣ ΦΤΑΝΟΥΝ ΣΤΟ ΦΥΛΛΟ ΚΙΝΗΤΟΥ** (ADR-912 §12).
 *
 * 🔴 **Η αφορμή, μετρημένη 2026-10-11 στα 390px**: οι κεφαλίδες οντότητας ήταν τυλιγμένες σε `hidden md:block` («no
 * header duplication») και το φύλλο δεχόταν χειρόγραφα κουμπιά ανά σελίδα. Στο κτίριο υπήρχε μόνο κάδος ⇒ η φόρμα
 * **δεν ξεκλείδωνε** από κινητό· στα ακίνητα υπήρχε «Επεξεργασία» με `onClick={() => {}}`.
 *
 * 🔑 Η θεραπεία είναι δομική: ό,τι **δηλώνει** η κεφαλίδα αποδίδεται στην μπάρα του φύλλου, από το ίδιο component.
 */

/* global describe, it, expect, jest */

import { render as renderAlone, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Building2 } from 'lucide-react';
import type { ReactElement } from 'react';

import { UnsavedEditsLeaveHost } from '@/components/unsaved-edits/UnsavedEditsLeaveHost';

import { EntityDetailsHeader, createEntityAction, inDeclaredOrder, orderEntityActions } from '@/core/entity-headers';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useUnsavedEdits } from '@/hooks/useUnsavedEdits';
import { hasUnsavedWork } from '@/lib/app-version/unsaved-work-registry';
import { MobileDetailsSlideIn } from '../MobileDetailsSlideIn';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Ο ξενιστής δίνει στο σύνορο πλοήγησης τον δρομολογητή του (`useLeaveNavigator`)· το `useRouter` του Next ρίχνει
// χωρίς app router.
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const TITLE = 'Κτίριο Α';

/**
 * Όπως στην εφαρμογή: η ερώτηση εξόδου ζει στον ΕΝΑ ξενιστή της ρίζας, όχι μέσα στο φύλλο (ADR-912 §12.12).
 * Χωρίς αυτόν ο ✕ θα έφευγε χωρίς να ρωτήσει — και τα Φ με διάλογο θα περνούσαν για λάθος λόγο.
 */
function render(ui: ReactElement) {
  const withHost = (node: ReactElement) => (
    <>
      {node}
      <UnsavedEditsLeaveHost />
    </>
  );
  const result = renderAlone(withHost(ui));
  return { ...result, rerender: (node: ReactElement) => result.rerender(withHost(node)) };
}

function sheetBar(): HTMLElement {
  const host = document.querySelector<HTMLElement>('[data-details-sheet-actions]');
  if (!host) throw new Error('η μπάρα του φύλλου δεν έχει θυρίδα ενεργειών');
  return host;
}

function sheetContent(): HTMLElement {
  const content = document.querySelector<HTMLElement>('[data-details-sheet]');
  if (!content) throw new Error('το φύλλο δεν έχει περιεχόμενο');
  return content;
}

describe('Φ — ενέργειες οντότητας στο φύλλο κινητού', () => {
  it('🔴 Φ1 — η ενέργεια της κεφαλίδας ζει στην ΜΠΑΡΑ του φύλλου, μία φορά, και το κλικ φτάνει', async () => {
    const onEdit = jest.fn();
    render(
      <MobileDetailsSlideIn isOpen onClose={jest.fn()} title={TITLE}>
        <EntityDetailsHeader icon={Building2} title={TITLE} actions={[createEntityAction('edit', 'Επεξεργασία', onEdit)]} />
      </MobileDetailsSlideIn>,
    );

    expect(screen.getAllByRole('button', { name: 'Επεξεργασία' })).toHaveLength(1);
    await userEvent.click(within(sheetBar()).getByRole('button', { name: 'Επεξεργασία' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('🔴 Φ2 — ο τίτλος γράφεται ΜΙΑ φορά (στην μπάρα), όχι και στο περιεχόμενο', () => {
    render(
      <MobileDetailsSlideIn isOpen onClose={jest.fn()} title={TITLE}>
        <EntityDetailsHeader icon={Building2} title={TITLE} actions={[createEntityAction('edit', 'Επεξεργασία', jest.fn())]} />
      </MobileDetailsSlideIn>,
    );

    expect(screen.getAllByText(TITLE)).toHaveLength(1);
    expect(within(sheetContent()).queryByText(TITLE)).toBeNull();
  });

  it('🔴 Φ3 — ό,τι ΔΕΝ είναι όνομα ή ενέργεια μένει στο περιεχόμενο (χάπι κατάστασης · υπότιτλος)', () => {
    render(
      <MobileDetailsSlideIn isOpen onClose={jest.fn()} title={TITLE}>
        <EntityDetailsHeader
          icon={Building2}
          title={TITLE}
          subtitle="Οδός Δοκιμής 1"
          titleAdornment={<span>Υπό κατασκευή</span>}
          actions={[createEntityAction('edit', 'Επεξεργασία', jest.fn())]}
        />
      </MobileDetailsSlideIn>,
    );

    expect(within(sheetContent()).getByText('Υπό κατασκευή')).toBeInTheDocument();
    expect(within(sheetContent()).getByText('Οδός Δοκιμής 1')).toBeInTheDocument();
  });

  it('✅ Φ4 — ΕΚΤΟΣ φύλλου η κεφαλίδα κρατά τίτλο και ενέργειες επιτόπου', () => {
    const { container } = render(
      <EntityDetailsHeader icon={Building2} title={TITLE} actions={[createEntityAction('edit', 'Επεξεργασία', jest.fn())]} />,
    );

    expect(within(container).getByText(TITLE)).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: 'Επεξεργασία' })).toBeInTheDocument();
  });

  it('✅ Φ5 — το κλείσιμο έχει όνομα προσβασιμότητας και καλεί τον χειριστή', async () => {
    const onClose = jest.fn();
    render(<MobileDetailsSlideIn isOpen onClose={onClose} title={TITLE}><p>σώμα</p></MobileDetailsSlideIn>);

    await userEvent.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Φ — ο ✕ της μπάρας ΕΙΝΑΙ η Ακύρωση όσο τρέχει επεξεργασία (ADR-912 §12.5)', () => {
  function renderEditing(onCancel: () => void, onClose: () => void, cancel: Parameters<typeof createEntityAction>[3] = {}) {
    render(
      <MobileDetailsSlideIn isOpen onClose={onClose} title={TITLE}>
        <EntityDetailsHeader
          icon={Building2}
          title={TITLE}
          actions={[
            createEntityAction('save', 'Αποθήκευση', jest.fn()),
            createEntityAction('cancel', 'Ακύρωση', onCancel, cancel),
          ]}
        />
      </MobileDetailsSlideIn>,
    );
  }
  const leaveButton = () => document.querySelector<HTMLButtonElement>('[data-details-sheet-leave]')!;

  it('🔴 Φ10 — η «Ακύρωση» ΔΕΝ είναι κουμπί της μπάρας· την ονομάζει ο ✕, και μένει μόνο η «Αποθήκευση»', () => {
    renderEditing(jest.fn(), jest.fn());

    expect(within(sheetBar()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Αποθήκευση']);
    expect(screen.getAllByRole('button', { name: 'Ακύρωση' })).toEqual([leaveButton()]);
    expect(leaveButton().dataset.detailsSheetLeave).toBe('dismiss');
    expect(screen.queryByRole('button', { name: 'actions.close' })).toBeNull();
  });

  it('🔴 Φ11 — φόρμα που ΔΕΝ δήλωσε αν έχει αλλαγές ⇒ ο ✕ ρωτά· «Συνέχεια» δεν ακυρώνει, «Απόρριψη» ακυρώνει — και δεν κλείνει το φύλλο', async () => {
    const onCancel = jest.fn();
    const onClose = jest.fn();
    renderEditing(onCancel, onClose);

    await userEvent.click(leaveButton());
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'discardChanges.keep' }));
    expect(onCancel).not.toHaveBeenCalled();

    await userEvent.click(leaveButton());
    await userEvent.click(await screen.findByRole('button', { name: 'discardChanges.confirm' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('🔴 Φ12 — φόρμα που δήλωσε «τίποτα να χαθεί» ⇒ ο ✕ ακυρώνει ΧΩΡΙΣ ερώτηση', async () => {
    const onCancel = jest.fn();
    renderEditing(onCancel, jest.fn(), { discards: false });

    await userEvent.click(leaveButton());
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'discardChanges.confirm' })).toBeNull();
  });

  it('✅ Φ13 — Ακύρωση απενεργοποιημένη (τρέχει αποθήκευση) ⇒ ο ✕ δεν εγκαταλείπει την πράξη', () => {
    renderEditing(jest.fn(), jest.fn(), { disabled: true });
    expect(leaveButton()).toBeDisabled();
  });

  it('✅ Φ14 — η επεξεργασία τελειώνει ⇒ ο ✕ ξαναγίνεται «Κλείσιμο»', async () => {
    const onClose = jest.fn();
    const header = (editing: boolean) => (
      <MobileDetailsSlideIn isOpen onClose={onClose} title={TITLE}>
        <EntityDetailsHeader
          icon={Building2}
          title={TITLE}
          actions={editing
            ? [createEntityAction('save', 'Αποθήκευση', jest.fn()), createEntityAction('cancel', 'Ακύρωση', jest.fn())]
            : [createEntityAction('edit', 'Επεξεργασία', jest.fn())]}
        />
      </MobileDetailsSlideIn>
    );
    const { rerender } = render(header(true));
    expect(leaveButton().dataset.detailsSheetLeave).toBe('dismiss');

    rerender(header(false));
    expect(leaveButton().dataset.detailsSheetLeave).toBe('close');
    await userEvent.click(screen.getByRole('button', { name: 'actions.close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Φ — ο ✕ ρωτά ΜΟΝΟ όταν η φόρμα έχει αλλαγές (ADR-912 §12.5)', () => {
  const SAVED = { name: 'Κτίριο Α' };
  function Form({ value }: { readonly value: { name: string } }) {
    useUnsavedEdits(true, value, SAVED);
    return null;
  }
  function renderForm(value: { name: string }, onCancel: () => void) {
    return render(
      <MobileDetailsSlideIn isOpen onClose={jest.fn()} title={TITLE}>
        <EntityDetailsHeader
          icon={Building2}
          title={TITLE}
          actions={[createEntityAction('save', 'Αποθήκευση', jest.fn()), createEntityAction('cancel', 'Ακύρωση', onCancel)]}
        />
        <Form value={value} />
      </MobileDetailsSlideIn>,
    );
  }
  const leave = () => userEvent.click(document.querySelector<HTMLButtonElement>('[data-details-sheet-leave]')!);

  it('🔴 Φ18 — φόρμα ίδια με το αποθηκευμένο (άλλο αντικείμενο, ίδιο περιεχόμενο) ⇒ ακύρωση ΧΩΡΙΣ ερώτηση', async () => {
    const onCancel = jest.fn();
    renderForm({ name: 'Κτίριο Α' }, onCancel);

    await leave();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'discardChanges.confirm' })).toBeNull();
  });

  it('🔴 Φ19 — φόρμα που διαφέρει ⇒ ο ✕ ρωτά πριν απορρίψει', async () => {
    const onCancel = jest.fn();
    renderForm({ name: 'Κτίριο Β' }, onCancel);

    await leave();
    expect(onCancel).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'discardChanges.confirm' })).toBeInTheDocument();
  });

  it('✅ Φ20 — εκτός φύλλου η δήλωση δεν πετά, και γράφει στο μητρώο `unsaved-work` (φύλαξη `beforeunload`)', () => {
    const { unmount } = render(<Form value={{ name: 'Κτίριο Β' }} />);
    expect(hasUnsavedWork()).toBe(true);
    unmount();
    expect(hasUnsavedWork()).toBe(false);
  });
});

describe('Φ — μακρύς τίτλος (ADR-912 §12.6)', () => {
  const LONG = 'Συγκρότημα Κατοικιών Ανατολικής Θεσσαλονίκης — Κτίριο Α';
  const widths = (scrollWidth: number, clientWidth: number) => {
    const scroll = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth);
    const client = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth);
    return () => { scroll.mockRestore(); client.mockRestore(); };
  };
  const renderLong = () => render(
    <MobileDetailsSlideIn isOpen onClose={jest.fn()} title={LONG}>
      <EntityDetailsHeader icon={Building2} title={LONG} actions={[createEntityAction('edit', 'Επεξεργασία', jest.fn())]} />
    </MobileDetailsSlideIn>,
  );

  it('🔴 Φ15 — η μπάρα ΚΟΒΕΙ τον τίτλο ⇒ το πλήρες όνομα γράφεται στο περιεχόμενο, μόνο για το μάτι', () => {
    const restore = widths(320, 150);
    try {
      renderLong();
      const full = within(sheetContent()).getByText(LONG);
      expect(full).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getAllByRole('heading', { name: LONG })).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it('🔴 Φ16 — ο τίτλος ΧΩΡΑ ⇒ δεν ξαναγράφεται (ο διπλός τίτλος δεν επιστρέφει)', () => {
    const restore = widths(150, 150);
    try {
      renderLong();
      expect(within(sheetContent()).queryByText(LONG)).toBeNull();
    } finally {
      restore();
    }
  });
});

describe('Φ — σύνορο: συρτάρι που ανοίγει από το φύλλο (ADR-912 §12.7)', () => {
  it('🔴 Φ17 — κεφαλίδα μέσα σε `Sheet` κρατά τίτλο και ενέργειες ΕΠΙΤΟΠΟΥ, όχι στην μπάρα από κάτω', () => {
    render(
      <MobileDetailsSlideIn isOpen onClose={jest.fn()} title={TITLE}>
        <Sheet open>
          <SheetContent aria-describedby={undefined}>
            <SheetTitle>Προμέτρηση</SheetTitle>
            <EntityDetailsHeader
              icon={Building2}
              title="Νέα προμέτρηση"
              actions={[createEntityAction('save', 'Αποθήκευση', jest.fn()), createEntityAction('cancel', 'Ακύρωση', jest.fn())]}
            />
          </SheetContent>
        </Sheet>
      </MobileDetailsSlideIn>,
    );

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByRole('button', { name: 'Αποθήκευση' })).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Ακύρωση' })).toBeInTheDocument();
    expect(within(drawer).getByText('Νέα προμέτρηση')).toBeInTheDocument();
    expect(sheetBar().querySelector('button')).toBeNull();
  });
});

describe('Φ — κανονική σειρά ενεργειών', () => {
  const labels = (actions: readonly { label: string }[]) => actions.map((action) => action.label);

  it('🔴 Φ6 — η «Επεξεργασία» προηγείται της «Επίδειξης», η καταστροφική έρχεται τελευταία, όπως κι αν δηλώθηκαν', () => {
    const declared = [
      createEntityAction('showcase', 'Επίδειξη', jest.fn()),
      createEntityAction('new', 'Νέο', jest.fn()),
      createEntityAction('delete', 'Διαγραφή', jest.fn()),
      createEntityAction('edit', 'Επεξεργασία', jest.fn()),
    ];

    expect(labels(orderEntityActions(declared))).toEqual(['Επεξεργασία', 'Νέο', 'Επίδειξη', 'Διαγραφή']);
  });

  it('🔴 Φ7 — η κεφαλίδα ΑΠΟΔΙΔΕΙ με την κανονική σειρά (σειρά DOM = σειρά Tab)', () => {
    render(
      <EntityDetailsHeader
        icon={Building2}
        title={TITLE}
        actions={[
          createEntityAction('showcase', 'Επίδειξη', jest.fn()),
          createEntityAction('edit', 'Επεξεργασία', jest.fn()),
          createEntityAction('cancel', 'Ακύρωση', jest.fn()),
          createEntityAction('save', 'Αποθήκευση', jest.fn()),
        ]}
      />,
    );

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Αποθήκευση', 'Ακύρωση', 'Επεξεργασία', 'Επίδειξη',
    ]);
  });

  it('✅ Φ8 — ρητή προτεραιότητα υπερισχύει του πίνακα· `inDeclaredOrder` κρατά τη σειρά δήλωσης', () => {
    const first = createEntityAction('view', 'Άνοιγμα σε σελίδα', jest.fn(), { priority: 0 });
    const edit = createEntityAction('edit', 'Επεξεργασία', jest.fn());
    expect(labels(orderEntityActions([edit, first]))).toEqual(['Άνοιγμα σε σελίδα', 'Επεξεργασία']);

    const workflow = inDeclaredOrder([
      createEntityAction('edit', 'Αλλαγή τιμής', jest.fn()),
      createEntityAction('new', 'Κράτηση', jest.fn()),
      createEntityAction('save', 'Πώληση', jest.fn()),
    ]);
    expect(labels(orderEntityActions(workflow))).toEqual(['Αλλαγή τιμής', 'Κράτηση', 'Πώληση']);
  });

  it('✅ Φ9 — ήδη σε σειρά ⇒ ο ΙΔΙΟΣ πίνακας (καμία νέα ταυτότητα)', () => {
    const ordered = [createEntityAction('save', 'Αποθήκευση', jest.fn()), createEntityAction('cancel', 'Ακύρωση', jest.fn())];
    expect(orderEntityActions(ordered)).toBe(ordered);
  });
});
