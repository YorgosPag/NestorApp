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

/**
 * 🔑 **ΤΟ ΔΙΠΛΟ ΕΝΩΝΕΙ ΤΑΥΤΟΤΗΤΑ ΚΑΙ ΙΚΑΝΟΤΗΤΑ — ΟΠΩΣ Ο ΠΡΑΓΜΑΤΙΚΟΣ ΜΗΧΑΝΙΣΜΟΣ.**
 *
 * Ως τις 2026-08-28 εδώ γινόταν mock το `useOrganizationCapability` και **χωριστά** το
 * `useAuth` — δηλαδή η δοκιμή έστηνε τα δύο σήματα **ανεξάρτητα**, ενώ στην πραγματικότητα
 * φτάνουν **σε σειρά**, και ακριβώς αυτή η σειρά γεννούσε το ψέμα. Πλέον γίνεται mock ο
 * ΕΝΑΣ αναγνώστης που τα ενώνει, μαζί με το `settled` — άρα η δοκιμή μπορεί να ρωτήσει
 * και *«τι λέει η οθόνη όσο ΔΕΝ ξέρει;»*, που πριν ήταν **αδύνατο να διατυπωθεί**.
 */
const capabilities = jest.fn<
  { view: Record<string, CapabilityStatus>; settled: boolean },
  []
>();

jest.mock('@/services/realtime/hooks/useOrganizationCapability', () => ({
  useMyOrganizationCapabilities: () => capabilities(),
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

function renderWith(status: CapabilityStatus, settled = true): void {
  capabilities.mockReturnValue({ view: { brokerage_listings: status }, settled });
  render(<BrokeredListingPageContent />);
}

describe('Κ5 — η φόρμα εντολής αποδίδεται ΜΟΝΟ με ενεργή ικανότητα', () => {
  beforeEach(() => {
    capabilities.mockReset();
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

  /**
   * 🔴 **Κ5.β — ΟΣΟ ΔΕΝ ΞΕΡΩ, ΔΕΝ ΜΙΛΑΩ.** *(νέα κατάσταση, 2026-08-28 — η Κ5 δεν
   * αποδυναμώνεται, αποκτά μία ακόμη)*
   *
   * **Μετρημένο ζωντανά σε ΕΓΚΕΚΡΙΜΕΝΟ γραφείο**: σε **5 από 7** αποδόσεις η οθόνη έλεγε
   * *«δεν έχεις δηλώσει μεσιτική δραστηριότητα»*, επειδή το `companyId` της **αναμονής**
   * είναι `null` και το `null` διαβαζόταν ως *«δεν έχει οργανισμό»*. Δεν ήταν τρεμόπαιγμα:
   * το κείμενο διαβαζόταν στην οθόνη.
   *
   * ⚠️ Η άρνηση είναι **κατηγορία** προς τον άνθρωπο *(«δεν είσαι εγγεγραμμένος»)*. Το να
   * την εκφωνεί η οθόνη ενώ **δεν έχει ρωτήσει ακόμη** δεν είναι λεπτομέρεια απόδοσης.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τον κλάδο `if (!settled)` ⇒ κόκκινο.
   */
  it('Κ5.β — όσο ΔΕΝ ξέρουμε: ούτε φόρμα, ούτε ΚΑΜΙΑ άρνηση', () => {
    renderWith('unrequested', /* settled */ false);

    expect(screen.queryByTestId('brokered-form')).toBeNull();
    for (const status of ['unrequested', 'pending', 'revoked'] as const) {
      expect(screen.queryByText(`auth:brokerage.denyReason.${status}`)).toBeNull();
    }
  });

  /**
   * ✅ **Ο ΔΕΥΤΕΡΟΣ ΠΑΡΟΝΟΜΑΣΤΗΣ**: μια «διόρθωση» που μένει **για πάντα** στο «φορτώνει»
   * περνά την Κ5.β και σπάει την οθόνη για όλους. Εδώ κρίνεται ότι το `settled` **ανοίγει**.
   */
  it('Κ5.γ — μόλις μάθει, μιλά: settled ⇒ η κατάσταση εκφωνείται', () => {
    renderWith('pending');

    expect(screen.getByText('auth:brokerage.denyReason.pending')).toBeInTheDocument();
  });
});
