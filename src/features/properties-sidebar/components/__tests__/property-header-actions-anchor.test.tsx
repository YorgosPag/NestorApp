/**
 * Υ — **ΚΟΥΜΠΙ ΧΩΡΙΣ ΧΕΙΡΙΣΤΗ ΔΕΝ ΖΩΓΡΑΦΙΖΕΤΑΙ** (ADR-777 §8.30).
 *
 * 🔴 **Η αφορμή, μετρημένη ΖΩΝΤΑΝΑ στην παραγωγή (2026-09-18)**: στη σελίδα `/properties/[id]` τα
 * κουμπιά «Νέο Ακίνητο» και «Μεταφορά στον κάδο» **δεν έκαναν τίποτα**. Δύο κλικ, καμία αντίδραση,
 * **κανένα σφάλμα στην κονσόλα**, κανένα modal στο δέντρο προσβασιμότητας. Αιτία: η κεφαλίδα
 * καλούσε `onNewProperty?.()` / `onDeleteProperty?.()` και η σελίδα **δεν τα περνούσε ποτέ** — το
 * προαιρετικό `?.` κατάπινε το κλικ **σιωπηλά**.
 *
 * 🔑 **Η θεραπεία είναι ΔΟΜΙΚΗ, όχι μπάλωμα σε μία σελίδα**: η κεφαλίδα ζωγραφίζει την ενέργεια
 * **μόνο** όταν υπάρχει χειριστής. Έτσι η επόμενη οθόνη που ξεχνά τη σύνδεση δείχνει ένα κουμπί
 * **λιγότερο** — ορατή απουσία — αντί για κουμπί που κοροϊδεύει τον άνθρωπο.
 *
 * ⚠️ Η «Επεξεργασία» και η «Επίδειξη» **μένουν πάντα**: τις τροφοδοτεί η ίδια η επιφάνεια.
 */

/* global describe, it, expect, jest */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertyDetailsHeader } from '../PropertyDetailsHeader';
import { createEntityAction } from '@/core/entity-headers';
import { RetiredRecordProvider } from '@/lib/firestore/retired-record-context';
import type { Property } from '@/types/property';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const PROPERTY = { id: 'prop_1', name: 'Δοκιμή' } as unknown as Property;

const NEW_ACTION = /navigation\.actions\.newUnit\.label/;
const DELETE_ACTION = /navigation\.actions\.delete\.label/;

describe('Υ — οι ενέργειες της κεφαλίδας ακινήτου', () => {
  it('🔴 Υ1 — ΧΩΡΙΣ χειριστές: τα δύο κουμπιά ΔΕΝ υπάρχουν καθόλου', () => {
    render(<PropertyDetailsHeader property={PROPERTY} />);

    // Ακριβώς το σενάριο της παραγωγής: η σελίδα δεν πέρασε τίποτα.
    expect(screen.queryByRole('button', { name: NEW_ACTION })).toBeNull();
    expect(screen.queryByRole('button', { name: DELETE_ACTION })).toBeNull();
    // …ενώ ό,τι τροφοδοτεί η ίδια η επιφάνεια μένει ορατό.
    expect(screen.getByRole('button', { name: /navigation\.actions\.edit\.label/ })).toBeInTheDocument();
  });

  it('✅ Υ2 — ΜΕ χειριστές: τα κουμπιά υπάρχουν και το κλικ φτάνει', async () => {
    const onNewProperty = jest.fn();
    const onDeleteProperty = jest.fn();
    render(
      <PropertyDetailsHeader
        property={PROPERTY}
        onNewProperty={onNewProperty}
        onDeleteProperty={onDeleteProperty}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: NEW_ACTION }));
    await userEvent.click(screen.getByRole('button', { name: DELETE_ACTION }));

    expect(onNewProperty).toHaveBeenCalledTimes(1);
    expect(onDeleteProperty).toHaveBeenCalledTimes(1);
  });
});

/**
 * Υ3 — **ΑΠΟΣΥΡΜΕΝΟ ΑΚΙΝΗΤΟ: ΜΟΝΟ Ο,ΤΙ ΠΛΟΗΓΕΙ** (ADR-329 §3.9).
 *
 * Η κεφαλίδα **ρωτά** `useRetiredKind()`· κανένα prop δεν της λέει ότι το ακίνητο είναι αποσυρμένο. Με όλους
 * τους χειριστές παρόντες (ό,τι θα περνούσε μια οθόνη που ξέχασε να τους αφαιρέσει), τα κουμπιά γραφής λείπουν.
 */
describe('Υ3 — αποσυρμένο ακίνητο', () => {
  const openPage = jest.fn();
  const OPEN_PAGE = createEntityAction('view', 'open-page', openPage);

  function mountRetired(status: string) {
    return render(
      <RetiredRecordProvider record={{ status }}>
        <PropertyDetailsHeader
          property={PROPERTY}
          onNewProperty={jest.fn()}
          onDeleteProperty={jest.fn()}
          onShowcaseProperty={jest.fn()}
          onToggleEditMode={jest.fn()}
          extraActions={[OPEN_PAGE]}
        />
      </RetiredRecordProvider>,
    );
  }

  it.each(['archived', 'deleted'])('🔴 `%s` ⇒ μένει ΜΟΝΟ το «Άνοιγμα σε σελίδα»', (status) => {
    mountRetired(status);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /open-page/ })).toBeInTheDocument();
  });

  it('🔴 αποσυρμένο ΚΑΙ `isEditMode` ⇒ ούτε «Αποθήκευση»: η λειτουργία επεξεργασίας δεν ξεκλειδώνει', () => {
    render(
      <RetiredRecordProvider record={{ status: 'archived' }}>
        <PropertyDetailsHeader property={PROPERTY} isEditMode extraActions={[OPEN_PAGE]} />
      </RetiredRecordProvider>,
    );

    expect(screen.queryByRole('button', { name: /buildingSelector\.save/ })).toBeNull();
  });

  it('✅ ζωντανό ακίνητο μέσα στον ίδιο πάροχο ⇒ τα κουμπιά γραφής υπάρχουν', () => {
    mountRetired('for-sale');

    expect(screen.getByRole('button', { name: /navigation\.actions\.edit\.label/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: DELETE_ACTION })).toBeInTheDocument();
  });
});
