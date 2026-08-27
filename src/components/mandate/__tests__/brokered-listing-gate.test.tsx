/**
 * @fileoverview **Κ5 — Η ΟΘΟΝΗ ΔΕΝ ΠΡΟΣΦΕΡΕΙ ΠΟΡΤΑ ΠΟΥ ΘΑ ΑΠΑΝΤΗΣΕΙ 403.**
 * @related ADR-824 §8 Κ5 · components/mandate/BrokeredListingPageContent.tsx
 *
 * ⛔ **ΔΕΝ δοκιμάζει ασφάλεια.** Ο φρουρός είναι ο τύπος `BrokerageAuthority` στον
 * διακομιστή, και μια διαδρομή που τον ξεχνά **δεν μεταγλωττίζεται**. Εδώ κρίνεται
 * **ειλικρίνεια της οθόνης**: μια φόρμα που ο άνθρωπος συμπληρώνει και **δεν μπορεί**
 * να υποβάλει είναι χειρότερη από απουσία — του ζητά δουλειά που θα πεταχτεί.
 *
 * 🔴 **ΔΙΑΒΑΖΕΙ ΑΠΟΔΟΣΗ, ΟΧΙ ΥΠΑΡΞΗ IMPORT** *(μάθημα «mixanikos» §4 #7)*: ένα test
 * που ρωτά *«εισάγεται ο φρουρός;»* μένει **πράσινο** όταν ο φρουρός εισάγεται και
 * δεν καλείται — που είναι ακριβώς ο τρόπος με τον οποίο πεθαίνουν οι φρουροί. Εδώ
 * αποδίδεται το δέντρο και ελέγχεται **τι βλέπει ο άνθρωπος**.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { BrokeredListingPageContent } from '../BrokeredListingPageContent';
import type { CapabilityStatus } from '@/types/organization-capability';

const capability = jest.fn<CapabilityStatus, unknown[]>();

jest.mock('@/services/realtime/hooks/useOrganizationCapability', () => ({
  useOrganizationCapability: (...args: unknown[]) => capability(...args),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', companyId: 'comp_alfa' } }),
}));

// ⚠️ Το κλειδί επιστρέφεται **αυτούσιο**: η δοκιμή ρωτά *«ποιο μήνυμα διάλεξε η
//    οθόνη;»*, όχι *«πώς μεταφράστηκε»* — η μετάφραση είναι δουλειά των locales.
// ⚠️ **`requireActual` και ΟΧΙ ολικό mock**: το `src/i18n/config.ts` ζητά το
//    `initReactI18next` τη στιγμή της εισαγωγής της οθόνης, και ένα ολικό mock το
//    έσβηνε ⇒ *«You are passing an undefined module»* **πριν** τρέξει καμία δοκιμή.
//    Αντικαθίσταται **μόνο** ο μεταφραστής.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/services/contacts-query.service', () => ({
  getAllContacts: jest.fn(async () => ({ contacts: [] })),
}));

/** Ο ζωντανός δείκτης της φόρμας — αν αποδοθεί, η ρυθμιζόμενη πράξη προσφέρεται. */
jest.mock('@/components/owner-property/OwnerPropertyFormContent', () => ({
  OwnerPropertyFormContent: () => <div data-testid="brokered-form" />,
}));
jest.mock('@/components/mandate/BrokeredMandateFields', () => ({
  BrokeredMandateFields: () => <div />,
}));

function renderWith(status: CapabilityStatus): void {
  capability.mockReturnValue(status);
  render(<BrokeredListingPageContent />);
}

describe('Κ5 — η φόρμα εντολής αποδίδεται ΜΟΝΟ με ενεργή ικανότητα', () => {
  beforeEach(() => {
    capability.mockReset();
  });

  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ, ΠΡΩΤΟΣ.** Χωρίς αυτόν, τα υπόλοιπα θα ήταν πράσινα και αν η
   * φόρμα **δεν αποδιδόταν ποτέ** — δηλαδή αν είχαμε «λύσει» το πρόβλημα σπάζοντας
   * την οθόνη για όλους.
   */
  it('`active` ⇒ η φόρμα ΑΠΟΔΙΔΕΤΑΙ', () => {
    renderWith('active');

    expect(screen.getByTestId('brokered-form')).toBeInTheDocument();
  });

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε τον κλάδο `if (brokerage !== 'active')` ⇒ **κόκκινο** και στις
   * τρεις καταστάσεις.
   */
  it.each(['unrequested', 'pending', 'revoked'] as const)(
    '«%s» ⇒ καμία φόρμα, και μήνυμα ΤΗΣ ΣΥΓΚΕΚΡΙΜΕΝΗΣ κατάστασης',
    (status) => {
      renderWith(status);

      expect(screen.queryByTestId('brokered-form')).toBeNull();
      // 🔑 **Το μήνυμα είναι διαφορετικό ανά κατάσταση**: «δεν δήλωσες» ≠ «εκκρεμεί»
      //    ≠ «σου ανακλήθηκε». Κοινό κείμενο θα έστελνε τον άνθρωπο που **περιμένει
      //    έγκριση** να ξαναδηλώσει.
      expect(screen.getByText(`auth:brokerage.denyReason.${status}`)).toBeInTheDocument();
    },
  );

  /** Ο φρουρός ρωτά για τη **σωστή** ικανότητα, με τον **σωστό** οργανισμό. */
  it('ρωτά τη ΜΕΣΙΤΙΚΗ ικανότητα του ΔΙΚΟΥ του οργανισμού', () => {
    renderWith('active');

    expect(capability).toHaveBeenCalledWith('comp_alfa', 'brokerage_listings');
  });
});
