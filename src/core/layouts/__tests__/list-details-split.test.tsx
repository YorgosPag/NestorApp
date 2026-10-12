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

function renderSplit(props: { sheetOpen: boolean; listOnly?: boolean; onCloseSheet?: () => void }) {
  return render(
    <ListDetailsSplit
      list={<ul aria-label="λίστα"><li>Αποθήκη 1</li></ul>}
      details={<Details />}
      sheetOpen={props.sheetOpen}
      sheetTitle="Αποθήκη 1"
      onCloseSheet={props.onCloseSheet ?? jest.fn()}
      listOnly={props.listOnly}
    />,
  );
}

const sheet = () => document.querySelector('[data-details-sheet]');

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

  it('Λ6 — πλέγμα (`listOnly`): στο desktop καμία στήλη λεπτομερειών· στο κινητό το φύλλο ανοίγει κανονικά', () => {
    const { unmount } = renderSplit({ sheetOpen: true, listOnly: true });
    expect(mounts.details).toBe(0);
    unmount();

    mobile = true;
    renderSplit({ sheetOpen: true, listOnly: true });
    expect(sheet()).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Επεξεργασία' })).toHaveLength(1);
  });
});
