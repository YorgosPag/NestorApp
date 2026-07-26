/**
 * Anchor tests: η «Νέα Διεύθυνση» δεν γράφει πια κενή εγγραφή (ADR-332 D20, παραγωγός A).
 *
 * ΤΟ ΕΛΑΤΤΩΜΑ
 * Το `addBranch()` έβαζε **αμέσως** `createEmptyBranch()` στο `formData` μέσω
 * `onChange`. Αν ο χρήστης άλλαζε γνώμη — ή απλώς έφευγε από την καρτέλα — η κενή
 * εγγραφή έφτανε αυτούσια στη βάση. Μαζί με τη συνθετική κενή έδρα (παραγωγός B)
 * ένα και μόνο πάτημα παρήγαγε **δύο** κενές εγγραφές.
 *
 * ΤΙ ΚΑΘΗΛΩΝΕΤΑΙ ΕΔΩ
 * Η νέα γραμμή ζει τοπικά (προσχέδιο) και **προάγεται** στο `formData` μόνο όταν
 * αποκτήσει πρώτη πραγματική τιμή. Ακύρωση ⇒ δεν υπήρξε ποτέ.
 *
 * Οι editors διευθύνσεων είναι mocked: εδώ δοκιμάζεται η λογική προαγωγής, όχι ο
 * χάρτης ή η ιεραρχία — αυτά έχουν δικά τους tests.
 */

import React, { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import {
  CompanyAddressesSection,
  type CompanyAddressesSectionHandle,
} from '../CompanyAddressesSection';

// --- Mocks: ο,τιδήποτε ανοίγει χάρτη/τηλεμετρία δεν αφορά αυτό το συμβόλαιο ----

jest.mock('@/components/shared/addresses/editor', () => ({
  AddressEditor: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/shared/addresses/AddressWithHierarchy', () => ({
  AddressWithHierarchy: ({
    onChange,
  }: {
    onChange: (value: Record<string, unknown>) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          street: 'Ορφέως',
          number: '7',
          postalCode: '69100',
          country: 'GR',
          settlementName: 'Κομοτηνή',
          settlementId: null,
          communityName: '',
          municipalUnitName: '',
          municipalityName: '',
          municipalityId: null,
          regionalUnitName: '',
          regionName: '',
          decentAdminName: '',
          majorGeoName: '',
        })
      }
    >
      τυπωσε-διευθυνση
    </button>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const HQ: CompanyAddress = {
  type: 'headquarters',
  street: 'Ονειροπόλων',
  number: '42',
  postalCode: '54624',
  city: 'Θεσσαλονίκη',
};

/** Οι κάρτες υπαρχουσών διευθύνσεων χρησιμοποιούν Radix Tooltip. */
function Wrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

function renderSection(addresses: CompanyAddress[], onChange = jest.fn()) {
  const ref = createRef<CompanyAddressesSectionHandle>();
  render(
    <CompanyAddressesSection ref={ref} addresses={addresses} onChange={onChange} contactType="company" />,
    { wrapper: Wrapper },
  );
  return { ref, onChange };
}

describe('CompanyAddressesSection — προαγωγή προσχεδίου', () => {
  it('η «Νέα Διεύθυνση» ΔΕΝ γράφει τίποτα στο formData', async () => {
    const { ref, onChange } = renderSection([HQ]);

    await React.act(async () => { ref.current?.addBranch(); });

    // ΤΟ ΕΛΑΤΤΩΜΑ: εδώ καλούνταν `onChange([HQ, κενό])`.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('το προσχέδιο είναι ΟΡΑΤΟ αμέσως — ο χρήστης βλέπει τη φόρμα να ανοίγει', async () => {
    const { ref } = renderSection([HQ]);

    await React.act(async () => { ref.current?.addBranch(); });

    expect(screen.getByText('τυπωσε-διευθυνση')).toBeInTheDocument();
  });

  it('προάγεται μόλις αποκτήσει πραγματική τιμή', async () => {
    const user = userEvent.setup();
    const { ref, onChange } = renderSection([HQ]);

    await React.act(async () => { ref.current?.addBranch(); });
    await user.click(screen.getByText('τυπωσε-διευθυνση'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const promoted = onChange.mock.calls[0][0] as CompanyAddress[];
    expect(promoted).toHaveLength(2);
    expect(promoted[0]).toEqual(HQ);
    expect(promoted[1].street).toBe('Ορφέως');
    expect(promoted[1].city).toBe('Κομοτηνή');
  });

  it('η ακύρωση απορρίπτει το προσχέδιο — δεν υπήρξε ποτέ', async () => {
    const user = userEvent.setup();
    const { ref, onChange } = renderSection([HQ]);

    await React.act(async () => { ref.current?.addBranch(); });
    await user.click(screen.getByRole('button', { name: 'deleteDialog.cancel' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText('τυπωσε-διευθυνση')).not.toBeInTheDocument();
  });

  it('το κλείσιμο της επεξεργασίας (disabled) πετάει το κενό προσχέδιο', async () => {
    const onChange = jest.fn();
    const ref = createRef<CompanyAddressesSectionHandle>();
    const { rerender } = render(
      <CompanyAddressesSection ref={ref} addresses={[HQ]} onChange={onChange} contactType="company" />,
      { wrapper: Wrapper },
    );

    await React.act(async () => { ref.current?.addBranch(); });
    rerender(
      <CompanyAddressesSection ref={ref} addresses={[HQ]} onChange={onChange} contactType="company" disabled />,
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText('τυπωσε-διευθυνση')).not.toBeInTheDocument();
  });

  it('δεύτερη προσθήκη μετά από προαγωγή δεν μπερδεύει τους δείκτες', async () => {
    const user = userEvent.setup();
    const branch: CompanyAddress = { type: 'branch', street: 'Μοναστηρίου', number: '1', postalCode: '56224', city: 'Εύοσμος' };
    const { ref, onChange } = renderSection([HQ, branch]);

    await React.act(async () => { ref.current?.addBranch(); });
    await user.click(screen.getByText('τυπωσε-διευθυνση'));

    const promoted = onChange.mock.calls[0][0] as CompanyAddress[];
    expect(promoted).toHaveLength(3);
    // Το υπάρχον υποκατάστημα δεν αντικαταστάθηκε από το προσχέδιο.
    expect(promoted[1]).toEqual(branch);
    expect(promoted[2].street).toBe('Ορφέως');
  });
});
