/**
 * Λ — **ΛΙΣΤΑ + ΛΕΠΤΟΜΕΡΕΙΕΣ: ΣΤΗΛΕΣ ΣΤΟ DESKTOP, ΦΥΛΛΟ ΣΤΟ ΚΙΝΗΤΟ** (ADR-912 §12.11).
 *
 * 🔴 **Η αφορμή, μετρημένη 2026-10-12 στα 390px** (`/spaces/parking`): η στήλη λεπτομερειών στηνόταν δίπλα στη λίστα
 * και στο κινητό — στο x=391, έξω από την οθόνη, με τις ενέργειές της κρυμμένες.
 *
 * 🔑 Το πλάτος εδώ το δίνει το `useIsMobile` (το jsdom δεν έχει διάταξη): οι άγκυρες ελέγχουν **ποιο δέντρο στήνεται**,
 * όχι pixels. Τα pixels μετριούνται στον browser.
 */

/* global describe, it, expect, jest, beforeEach */

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Warehouse } from 'lucide-react';

import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { ListDetailsSplit } from '../ListDetailsSplit';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let mobile = false;
jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => mobile }));

const mounts = { details: 0 };

function Details() {
  mounts.details += 1;
  return (
    <EntityDetailsHeader icon={Warehouse} title="Αποθήκη 1" actions={[createEntityAction('edit', 'Επεξεργασία', jest.fn())]} />
  );
}

function renderSplit(props: { sheetOpen: boolean; peek?: boolean; onCloseSheet?: () => void }) {
  return render(
    <ListDetailsSplit
      list={<ul aria-label="λίστα"><li>Αποθήκη 1</li></ul>}
      details={<Details />}
      sheetOpen={props.sheetOpen}
      sheetTitle="Αποθήκη 1"
      onCloseSheet={props.onCloseSheet ?? jest.fn()}
      peek={props.peek}
    />,
  );
}

const sheet = () => document.querySelector('[role="dialog"] [data-details-sheet]');
const peekPanel = () => document.querySelector<HTMLElement>('[data-details-peek]');

describe('Λ — λίστα + λεπτομέρειες', () => {
  beforeEach(() => {
    mobile = false;
    mounts.details = 0;
  });

  it('Λ1 — desktop: λίστα και λεπτομέρειες δίπλα-δίπλα, κανένα φύλλο — και χωρίς επιλογή (κενή κατάσταση)', () => {
    renderSplit({ sheetOpen: false });

    expect(screen.getAllByRole('list', { name: 'λίστα' })).toHaveLength(1);
    expect(mounts.details).toBe(1);
    expect(sheet()).toBeNull();
  });

  it('🔴 Λ2 — κινητό χωρίς επιλογή: ΜΟΝΟ η λίστα· οι λεπτομέρειες δεν στήνονται πουθενά', () => {
    mobile = true;
    renderSplit({ sheetOpen: false });

    expect(screen.getAllByRole('list', { name: 'λίστα' })).toHaveLength(1);
    expect(mounts.details).toBe(0);
    expect(sheet()).toBeNull();
  });

  it('🔴 Λ3 — κινητό με επιλογή: οι λεπτομέρειες ζουν στο ΦΥΛΛΟ, ΜΙΑ φορά, και η περιοχή της λίστας κρύβεται', () => {
    mobile = true;
    renderSplit({ sheetOpen: true });

    expect(sheet()).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Επεξεργασία' })).toHaveLength(1);
    expect(document.querySelector('[data-details-sheet-actions]')?.querySelector('[data-entity-action]')).not.toBeNull();
    expect(screen.getByRole('list', { name: 'λίστα', hidden: true }).parentElement?.className).toBe('hidden');
  });

  it('🔴 Λ4 — ΕΝΑ αντίτυπο λεπτομερειών σε κάθε πλάτος (φόρμα με κοινό ref αποθήκευσης δεν στήνεται δύο φορές)', () => {
    renderSplit({ sheetOpen: true });
    expect(screen.getAllByRole('button', { name: 'Επεξεργασία' })).toHaveLength(1);
    expect(sheet()).toBeNull();
  });

  it('Λ5 — ο ✕ του φύλλου καλεί το κλείσιμο της σελίδας', async () => {
    mobile = true;
    const onCloseSheet = jest.fn();
    renderSplit({ sheetOpen: true, onCloseSheet });

    await userEvent.click(document.querySelector('[data-details-sheet-leave]') as HTMLElement);
    expect(onCloseSheet).toHaveBeenCalledTimes(1);
  });

  it('🔴 Λ6 — πλέγμα (`peek`): στο desktop οι λεπτομέρειες ανοίγουν ΔΙΠΛΑ (side peek) με την «Επεξεργασία» στη μπάρα· στο κινητό ως φύλλο', () => {
    // Ως 2026-10-19 (`listOnly`) εδώ υπήρχε `expect(mounts.details).toBe(0)` — δηλαδή η άγκυρα ΚΛΕΙΔΩΝΕ το σφάλμα.
    const { unmount } = renderSplit({ sheetOpen: true, peek: true });
    expect(peekPanel()).not.toBeNull();
    expect(sheet()).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Αποθήκη 1' })).toBe(peekPanel());
    expect(screen.getAllByRole('button', { name: 'Επεξεργασία' })).toHaveLength(1);
    expect(mounts.details).toBe(1);
    unmount();

    mobile = true;
    mounts.details = 0;
    renderSplit({ sheetOpen: true, peek: true });
    expect(sheet()).not.toBeNull();
    expect(peekPanel()).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Επεξεργασία' })).toHaveLength(1);
  });

  it('Λ7 — πλέγμα χωρίς επιλογή: μόνο το πλέγμα, οι λεπτομέρειες δεν στήνονται πουθενά (ούτε αθέατες)', () => {
    renderSplit({ sheetOpen: false, peek: true });
    expect(peekPanel()).toBeNull();
    expect(mounts.details).toBe(0);
    expect(screen.getByRole('list', { name: 'λίστα' })).toBeInTheDocument();
  });

  it('🔴 Λ8 — side peek: το focus μπαίνει στο panel· ✕ και Esc καλούν το κλείσιμο της σελίδας', async () => {
    const onCloseSheet = jest.fn();
    renderSplit({ sheetOpen: true, peek: true, onCloseSheet });
    expect(peekPanel()).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(onCloseSheet).toHaveBeenCalledTimes(1);

    await userEvent.click(document.querySelector('[data-details-sheet-leave]') as HTMLElement);
    expect(onCloseSheet).toHaveBeenCalledTimes(2);
  });

  it('Λ9 — side peek κλείνει ⇒ το focus γυρνά στην κάρτα που το άνοιξε', async () => {
    function Grid() {
      const [open, setOpen] = useState(false);
      return (
        <ListDetailsSplit
          peek
          list={<button type="button" onClick={() => setOpen(true)}>Κάρτα</button>}
          details={<Details />}
          sheetOpen={open}
          sheetTitle="Αποθήκη 1"
          onCloseSheet={() => setOpen(false)}
        />
      );
    }
    render(<Grid />);
    await userEvent.click(screen.getByRole('button', { name: 'Κάρτα' }));
    expect(peekPanel()).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(peekPanel()).toBeNull();
    expect(screen.getByRole('button', { name: 'Κάρτα' })).toHaveFocus();
  });
});
