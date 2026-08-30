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
import {
  BROKERAGE_DENY_REASON_KEYS,
  BROKERAGE_SETTINGS,
} from '@/lib/auth/brokerage-authority';

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

// ⚠️ **Το `href` περνά ΑΥΤΟΥΣΙΟ** *(χωρίς το πρόθεμα χώρου, που το προσθέτει το
//    πραγματικό σύνορο)*: αλλιώς η άγκυρα Κ13η δεν μπορεί να ρωτήσει **πού δείχνει**
//    ο σύνδεσμος — και ένα σταθερό `href="#"` θα την άφηνε πράσινη σε κάθε διαδρομή.
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
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

      expect(screen.getByText(BROKERAGE_DENY_REASON_KEYS[status])).toBeInTheDocument();
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
   * 🔴 **Κ13η — Η ΥΠΟΣΧΕΣΗ ΤΗΣ ΑΡΝΗΣΗΣ ΟΔΗΓΕΙ ΚΑΠΟΥ** (ADR-824 §12.14).
   *
   * **Μετρημένο ζωντανά 2026-08-30**: αυτή ακριβώς η οθόνη έγραφε *«Η μεσιτική
   * δυνατότητα του γραφείου σου έχει ανακληθεί. **Δες τον λόγο στις ρυθμίσεις του
   * οργανισμού**»* — και **δεν πρόσφερε κανέναν δρόμο** προς εκεί. Η ίδια κλάση με
   * τα τέσσερα ζωντανά 404 του έργου, σε οθόνη που κανείς δεν είχε κοιτάξει.
   *
   * ⚠️ **Και το κλειδί χτιζόταν με ΠΑΡΕΜΒΟΛΗ** — αόρατο στη CHECK 3.8. Ο έλεγχος
   * περνά πλέον από τον **πίνακα**, ώστε μετονομασία στα locales να κοκκινίζει εδώ.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε τον `<Link>` ⇒ κόκκινο.
   * ⛔ ΜΕΤΑΛΛΑΞΗ: άλλαξε τη διαδρομή του `BROKERAGE_SETTINGS` ⇒ κόκκινο.
   */
  it.each([['unrequested'], ['pending'], ['revoked']] as const)(
    'Κ13η — «%s»: το κείμενο έρχεται από τον ΠΙΝΑΚΑ και προσφέρει τον δρόμο',
    (status) => {
      renderWith(status);

      // ✅ ΘΕΤΙΚΟΣ ΣΥΝΟΔΟΣ: η οθόνη απέδωσε το μήνυμα **του πίνακα**…
      expect(screen.getByText(BROKERAGE_DENY_REASON_KEYS[status])).toBeInTheDocument();
      // …και δίπλα του τον δρόμο προς τη θεραπεία.
      const link = screen.getByRole('link');
      // 🔴 **ΚΥΡΙΟΛΕΞΙΑ, ΟΧΙ Η ΣΤΑΘΕΡΑ — και το βρήκε η μετάλλαξη.**
      //    Η πρώτη γραφή ήταν `toBe(BROKERAGE_SETTINGS.route)`: δύο πλευρές που
      //    διαβάζουν **την ίδια** σταθερά, δηλαδή ταυτολογία — μια αλλαγή
      //    της διαδρομής στο SSoT **επέζησε** της επαλήθευσης. Η διεύθυνση
      //    είναι **υπόσχεση προς τον άνθρωπο**, άρα γράφεται εδώ με το χέρι.
      expect(link.textContent).toBe('auth:brokerage.openSettings');
      expect(link.getAttribute('href')).toBe('/settings/brokerage');
    },
  );

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
