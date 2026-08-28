/**
 * @fileoverview **ADR-824 Φάση 4 — Ο ΚΑΤΑΛΟΓΟΣ ΕΝΤΟΛΩΝ ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ ΧΩΡΙΣ ΑΔΕΙΑ.**
 * @related ADR-824 §8 Κ7 · components/mandate/MandateCatalogContent.tsx
 *
 * ⛔ **ΔΕΝ δοκιμάζει ασφάλεια.** Ο φρουρός είναι ο τύπος `BrokerageAuthority` στον
 * διακομιστή και ο ίδιος κριτής στο `GET`. Εδώ κρίνεται **ειλικρίνεια της οθόνης**.
 *
 * 🔴 **ΔΙΑΒΑΖΕΙ ΑΠΟΔΟΣΗ, ΟΧΙ ΥΠΑΡΞΗ IMPORT** *(ίδιο μάθημα με το Κ5)*: αποδίδεται το
 * δέντρο και ελέγχεται **τι βλέπει ο άνθρωπος**.
 *
 * 🔑 **Ο ζωντανός δείκτης είναι το ΚΟΥΜΠΙ «Νέα καταχώρηση»**, όχι ο τίτλος: ο τίτλος
 * αποδίδεται και στις δύο περιπτώσεις (ο άνθρωπος πρέπει να ξέρει πού βρίσκεται), ενώ
 * το κουμπί **είναι** η προσφορά της ρυθμιζόμενης πράξης.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { MandateCatalogContent } from '../MandateCatalogContent';
import { CATALOG_KEYS } from '../catalog/mandate-catalog-labels';
import type { CapabilityStatus } from '@/types/organization-capability';

const capabilities = jest.fn<
  { view: Record<string, CapabilityStatus>; settled: boolean },
  unknown[]
>();

jest.mock('@/services/realtime/hooks/useOrganizationCapability', () => ({
  useMyOrganizationCapabilities: () => capabilities(),
}));

/**
 * ⚠️ **Ο κατάλογος επιστρέφει ΠΑΝΤΑ έτοιμο περιεχόμενο σε αυτή τη δοκιμή.** Έτσι, αν
 * ο φρουρός λείπει, η οθόνη **θα δείξει** τον κατάλογο — δηλαδή η αποτυχία είναι
 * ορατή. Ένα mock που επιστρέφει «φορτώνει» θα έκρυβε τη διαφορά.
 */
const catalog = jest.fn(() => ({
  view: { state: 'ready', catalog: { rows: [], tally: {}, truncated: false }, busyId: null, feedback: null },
  reload: jest.fn(),
  act: jest.fn(),
  setPresence: jest.fn(),
}));

jest.mock('@/hooks/mandate/useMandateCatalog', () => ({
  useMandateCatalog: () => catalog(),
}));

// Το κλειδί επιστρέφεται **αυτούσιο**: η δοκιμή ρωτά «ποιο μήνυμα διάλεξε η οθόνη;»,
// όχι «πώς μεταφράστηκε» — η μετάφραση είναι δουλειά των locales.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

function renderWith(status: CapabilityStatus, settled = true): void {
  capabilities.mockReturnValue({ view: { brokerage_listings: status }, settled });
  render(<MandateCatalogContent />);
}

/** Η ρυθμιζόμενη προσφορά, όπως τη βλέπει ο άνθρωπος. */
function offersCreation(): boolean {
  return screen.queryByText(CATALOG_KEYS.create) !== null;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Κ7 — ο κατάλογος εντολών προσφέρεται ΜΟΝΟ με ενεργή ικανότητα', () => {
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΚΑΤΑ ΤΟΥ ΨΕΜΑΤΟΣ — και το ελάττωμα που την γέννησε ήταν ΠΡΑΓΜΑΤΙΚΟ.**
   *
   * Μετρήθηκε ζωντανά (2026-08-28): το `companyId` φτάνει **αργότερα** από την πρώτη
   * απόδοση, οπότε ένα **εγκεκριμένο** μεσιτικό γραφείο διάβαζε *«δεν έχεις δηλώσει
   * μεσιτική δραστηριότητα»* για ~1,5 δευτερόλεπτο σε **κάθε** άνοιγμα.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τον κλάδο `if (!settled)` ⇒ κόκκινο.
   */
  it('Ο1 — όσο ΔΕΝ ξέρουμε, λέει «φορτώνει» και ΚΑΜΙΑ κατάσταση', () => {
    renderWith('active', false);

    expect(screen.getByText(CATALOG_KEYS.loading)).toBeInTheDocument();
    expect(screen.queryByText(/denyReason/)).not.toBeInTheDocument();
    expect(offersCreation()).toBe(false);
  });

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τον κλάδο `if (!isCapabilityActive(brokerage))` ⇒ κόκκινο
   *    και στις τρεις καταστάσεις (η ρυθμιζόμενη πράξη ξαναπροσφέρεται).
   */
  it.each([['unrequested'], ['pending'], ['revoked']] as const)(
    'Ο2 — «%s»: το μήνυμα ΤΗΣ κατάστασης, και ΚΑΜΙΑ πρόταση καταχώρησης',
    (status) => {
      renderWith(status);

      expect(screen.getByText(`auth:brokerage.denyReason.${status}`)).toBeInTheDocument();
      expect(offersCreation()).toBe(false);
    },
  );

  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γράψε τον έλεγχο ως `brokerage === 'unrequested'` (δηλαδή άσε το
   *    `pending`/`revoked` να περάσουν) ⇒ κόκκινο. Είναι η μετάλλαξη Κ3 του §8
   *    μεταφερμένη στην **επιφάνεια**.
   */
  it('Ο3 — ο κατάλογος ΔΕΝ μοντάρεται καν χωρίς ενεργή ικανότητα', () => {
    renderWith('pending');
    expect(catalog).not.toHaveBeenCalled();
  });

  /**
   * 🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — χωρίς αυτόν, ένας φρουρός που κρύβει ΤΑ ΠΑΝΤΑ περνά.**
   *
   * Είναι η ίδια πρόταση του §10 #2: *«Γραφείο με `active` βλέπει τα πάντα ακριβώς
   * όπως πριν»*.
   */
  it('Ο4 — «active»: ο κατάλογος αποδίδεται και η καταχώρηση προσφέρεται', () => {
    renderWith('active');

    expect(offersCreation()).toBe(true);
    expect(screen.getByText(CATALOG_KEYS.title)).toBeInTheDocument();
    expect(catalog).toHaveBeenCalled();
    expect(screen.queryByText(/denyReason/)).not.toBeInTheDocument();
  });
});
