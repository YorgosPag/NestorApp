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

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Building2 } from 'lucide-react';

import { EntityDetailsHeader, createEntityAction, inDeclaredOrder, orderEntityActions } from '@/core/entity-headers';
import { MobileDetailsSlideIn } from '../MobileDetailsSlideIn';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const TITLE = 'Κτίριο Α';

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
