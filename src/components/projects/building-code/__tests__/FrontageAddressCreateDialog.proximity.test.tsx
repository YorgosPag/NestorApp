/**
 * @fileoverview **Η ΠΡΟΣΟΨΗ ΞΕΡΕΙ ΣΕ ΠΟΙΟ ΟΙΚΟΠΕΔΟ ΑΝΗΚΕΙ** — ADR-332 **D25**.
 * @related ADR-332 D23 *(ο κανόνας)* · utils/address/address-list-center
 *
 * Ο **τρίτος** καταναλωτής, και ο πιο κατηγορηματικός από τους έξι: μια *πρόσοψη* δεν
 * είναι απλώς «άλλη διεύθυνση της ίδιας οντότητας» — είναι **η ίδια πλευρά του ίδιου
 * οικοπέδου**. Ό,τι πληκτρολογείται εδώ οφείλει να απέχει **δεκάδες μέτρα** από τις
 * υπόλοιπες διευθύνσεις του έργου· ένας υποψήφιος 300 km μακριά είναι, με βεβαιότητα,
 * λάθος γραμμή — και ως τις 05/09 μπορούσε να εμφανιστεί **πρώτος**.
 *
 * ⚠️ **Καμία υποχώρηση στη «θέση αυτής της εγγραφής»**, σε αντίθεση με το
 * `BuildingAddressesEditor`: η εγγραφή **γεννιέται τώρα** και δεν έχει θέση. Ο δεύτερος
 * έλεγχος το κατοχυρώνει — αν κάποιος πρόσθετε υποχώρηση, θα κοκκίνιζε.
 */

import React from 'react';
import { render } from '@testing-library/react';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import { FrontageAddressCreateDialog } from '../FrontageAddressCreateDialog';

// --- Mocks ---

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const receivedSuggestions: unknown[] = [];
jest.mock('@/components/shared/addresses/editor', () => ({
  AddressEditor: (props: { suggestions?: unknown }) => {
    receivedSuggestions.push(props.suggestions);
    return null;
  },
}));

/** Το Radix Dialog απαιτεί pointer-events που η jsdom δεν έχει. */
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/services/projects/project-mutation-gateway', () => ({
  updateProjectWithPolicy: jest.fn(),
}));

// --- Fixtures ---

/** Το οικόπεδο, στη Θεσσαλονίκη. */
const PLOT_POINT = { lat: 40.6401, lng: 22.9444 };

function address(overrides: Partial<ProjectAddress> = {}): ProjectAddress {
  return {
    id: 'addr-1',
    street: 'Εγνατία',
    number: '147',
    city: 'Θεσσαλονίκη',
    postalCode: '54630',
    country: 'Greece',
    type: 'site',
    isPrimary: true,
    ...overrides,
  } as ProjectAddress;
}

function renderDialog(addresses: readonly ProjectAddress[] | undefined) {
  receivedSuggestions.length = 0;
  render(
    <FrontageAddressCreateDialog
      open
      onOpenChange={jest.fn()}
      project={{ id: 'p-1', addresses } as Project}
      frontageIndex={1}
      onCreated={jest.fn()}
    />,
  );
  return receivedSuggestions;
}

// --- Tests ---

describe('FrontageAddressCreateDialog — η αφετηρία είναι το οικόπεδο (D25)', () => {
  it('η θέση του έργου φτάνει ως αφετηρία εγγύτητας', () => {
    const captured = renderDialog([address({ coordinates: PLOT_POINT })]);

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ proximityAnchor: PLOT_POINT });
  });

  it('έργο χωρίς καμία θέση ⇒ `undefined` — καμία υποχώρηση, η εγγραφή δεν υπάρχει ακόμη', () => {
    expect(renderDialog([address({ coordinates: undefined })])[0]).toEqual({
      proximityAnchor: undefined,
    });
  });

  it('έργο χωρίς καθόλου διευθύνσεις ⇒ `undefined`, χωρίς να σκάσει', () => {
    expect(renderDialog(undefined)[0]).toEqual({ proximityAnchor: undefined });
  });
});
