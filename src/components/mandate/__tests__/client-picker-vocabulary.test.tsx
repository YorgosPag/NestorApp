/**
 * Άγκυρα — **Ο ΕΠΙΛΟΓΕΑΣ ΠΕΛΑΤΗ ΔΕΝ ΓΡΑΦΕΙ ΚΕΝΕΣ ΓΡΑΜΜΕΣ, ΚΑΙ ΞΕΡΕΙ ΤΡΕΙΣ ΚΟΣΜΟΥΣ**
 *
 * ## Γιατί υπάρχει — μετρημένο ζωντανά 2026-08-31 (ADR-834 §6.5.στ)
 *
 * Στη σελίδα «νέα αγγελία για πελάτη», με **9** επαφές στο dropdown, η **1** ήταν
 * **κενή γραμμή**: το `label` προερχόταν από σκέτο `getContactDisplayName(contact)`,
 * που για `firstName: ''` / `lastName: ''` επιστρέφει `' '`.
 *
 * ✅ Η θεραπεία **υπήρχε ήδη** από το §6.5.δ (`clientNameFrom` + κλειδί `clientUnnamed`)
 * και ζωγράφιζε σωστά **στον κατάλογο εντολών**. Ο επιλογέας απλώς **δεν τη ρωτούσε** —
 * ίδιο ελάττωμα, **δεύτερη επιφάνεια**. Αυτή η άγκυρα κάνει το «ρωτά» εκτελέσιμο.
 *
 * ## Και το δεύτερο μισό: **τρεις κόσμοι, όχι ένα κενό**
 *
 * «Φορτώνει», «απέτυχε» και «δεν έχεις επαφές» έφταναν στην οθόνη ως το **ίδιο** άδειο
 * πεδίο. Η αποτυχία γραφόταν **μόνο** στα logs (`logger.error`), όπου κανένας μεσίτης
 * δεν κοιτάζει — και ο μεσίτης συμπέραινε ότι έφταιγαν τα δεδομένα του. Οι τρεις
 * καταστάσεις θέλουν **διαφορετική ενέργεια από τον άνθρωπο**, άρα οφείλουν να
 * διαφέρουν στην οθόνη.
 *
 * ⚠️ **Το `t` επιστρέφει το κλειδί αυτούσιο**: η δοκιμή ρωτά *«ποιο μήνυμα διάλεξε η
 * οθόνη;»*, όχι *«πώς μεταφράστηκε»* — η μετάφραση είναι δουλειά των locales και την
 * κρίνουν οι δικές τους πύλες.
 *
 * @module components/mandate/__tests__/client-picker-vocabulary
 * @see ADR-834 §6.5.στ · §6.5.δ
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

import { BrokeredListingPageContent } from '../BrokeredListingPageContent';
import type { Contact } from '@/types/contacts';

const UNNAMED_KEY = 'property-market:offer.mandates.clientUnnamed';
const FAILED_KEY = 'property-market:mandate.office.clientsFailed';
const NONE_KEY = 'property-market:mandate.office.clientsNone';

jest.mock('@/services/realtime/hooks/useOrganizationCapability', () => ({
  useMyOrganizationCapabilities: () => ({
    view: { brokerage_listings: 'active' },
    settled: true,
  }),
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const getAllContacts = jest.fn();
jest.mock('@/services/contacts-query.service', () => ({
  getAllContacts: (...args: unknown[]) => getAllContacts(...args),
}));

/**
 * 🔑 **Ο σκελετός αποδίδει το `mandate.section`** — αλλιώς ο επιλογέας δεν θα
 * υπήρχε καθόλου στο δέντρο και κάθε ισχυρισμός θα ήταν κενός. (Το
 * `brokered-listing-gate.test.tsx` τον σβήνει επίτηδες: εκείνο ρωτά *αν* προσφέρεται
 * η φόρμα, αυτό ρωτά *τι λέει μέσα της*.)
 */
jest.mock('@/components/owner-property/OwnerPropertyFormContent', () => ({
  OwnerPropertyFormContent: ({ mandate }: { mandate: { section: React.ReactNode } }) => (
    <div data-testid="owner-form">{mandate.section}</div>
  ),
}));

/**
 * ⚠️ **Ωμά έγγραφα, όχι «καλά σχηματισμένες» επαφές.** Ο πραγματικός αναγνώστης
 * παραδίδει ό,τι υπάρχει στη βάση μέσω ισχυρισμού τύπου — και η **ανώνυμη** επαφή
 * (`cont_da84f8c4`, επαληθευμένη στη βάση) έχει ακριβώς αυτό το σχήμα: υπάρχει,
 * έχει email, και **κανένα** αναγνώσιμο όνομα.
 */
function contactsFixture(): Contact[] {
  return [
    {
      id: 'cont_named',
      type: 'individual',
      firstName: 'Άννα',
      lastName: 'Παπαδοπούλου',
      emails: [{ email: 'anna@example.com', isPrimary: true }],
    },
    {
      id: 'cont_unnamed',
      type: 'individual',
      firstName: '',
      lastName: '',
      emails: [{ email: 'anonymos@example.com', isPrimary: true }],
    },
  ] as unknown as Contact[];
}

/**
 * Ανοίγει το dropdown όπως ο άνθρωπος: εστιάζοντας στο πεδίο.
 *
 * ⚠️ **Η αναμονή φόρτωσης ΠΡΙΝ το focus δεν είναι διακόσμηση δοκιμής** — περιγράφει
 * τη ζωντανή συμπεριφορά: το `handleFocus` ανοίγει **μόνο** όταν υπάρχουν επιλογές
 * (`options.length > 0`), άρα focus **πριν** απαντήσει ο διακομιστής δεν ανοίγει
 * τίποτα. Γι' αυτό ακριβώς η σελίδα λέει πλέον τη φόρτωση και την αποτυχία **έξω** από
 * το popover: εκεί ο άνθρωπος τα βλέπει **χωρίς** να χρειάζεται να το ανοίξει.
 */
async function openPicker(): Promise<HTMLElement[]> {
  const input = await screen.findByRole('combobox');
  // Η στιγμή που οι επαφές έφτασαν στην οθόνη — όχι σταθερή καθυστέρηση.
  await waitFor(() => expect(getAllContacts).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
  });
  fireEvent.focus(input);
  return waitFor(() => {
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    return options;
  });
}

beforeEach(() => {
  getAllContacts.mockReset();
});

// ===========================================================================
describe('ο επιλογέας πελάτη — καμία κενή γραμμή (ADR-834 §6.5.στ)', () => {
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — η επαφή ΜΕ όνομα γράφεται με το όνομά της', async () => {
    getAllContacts.mockResolvedValue({ contacts: contactsFixture() });

    render(<BrokeredListingPageContent />);
    const options = await openPicker();

    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Άννα Παπαδοπούλου')]),
    );
  });

  it('η ΑΝΩΝΥΜΗ επαφή ΟΝΟΜΑΖΕΤΑΙ — δεν γίνεται κενή γραμμή', async () => {
    getAllContacts.mockResolvedValue({ contacts: contactsFixture() });

    render(<BrokeredListingPageContent />);
    const options = await openPicker();

    // Η ίδια ονομασμένη άγνοια που χρησιμοποιεί ΗΔΗ ο κατάλογος εντολών.
    expect(options.map((o) => o.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining(UNNAMED_KEY)]),
    );
    // 🔴 Και το κρίσιμο: **καμία** γραμμή χωρίς κείμενο.
    expect(options.filter((o) => (o.textContent ?? '').trim() === '')).toHaveLength(0);
  });

  it('κάθε γραμμή κουβαλά τη ΔΙΕΥΘΥΝΣΗ της — ο διαχωριστής των συνωνύμων', async () => {
    getAllContacts.mockResolvedValue({ contacts: contactsFixture() });

    render(<BrokeredListingPageContent />);
    const options = await openPicker();

    // Χωρίς αυτό, δύο ανώνυμες επαφές θα ήταν **ταυτόσημες** στην οθόνη — και το
    // `handleBlur` λύνει την ταυτότητα από την ετικέτα.
    const unnamedRow = options.find((o) => (o.textContent ?? '').includes(UNNAMED_KEY));
    expect(unnamedRow?.textContent).toContain('anonymos@example.com');
  });
});

// ===========================================================================
describe('ο επιλογέας πελάτη — τρεις κόσμοι, όχι ένα κενό', () => {
  it('ΑΠΕΤΥΧΕ ⇒ η οθόνη το ΛΕΕΙ στον άνθρωπο, δεν το γράφει μόνο στα logs', async () => {
    getAllContacts.mockRejectedValue(new Error('AUTHENTICATION_ERROR: User must be logged in'));

    render(<BrokeredListingPageContent />);

    expect(await screen.findByText(FAILED_KEY)).toBeInTheDocument();
    // Και ΔΕΝ ισχυρίζεται ότι ο μεσίτης δεν έχει επαφές.
    expect(screen.queryByText(NONE_KEY)).not.toBeInTheDocument();
  });

  it('ΡΩΤΗΣΑΜΕ ΚΑΙ ΔΕΝ ΥΠΑΡΧΟΥΝ ⇒ άλλο μήνυμα, άλλη ενέργεια', async () => {
    getAllContacts.mockResolvedValue({ contacts: [] });

    render(<BrokeredListingPageContent />);

    expect(await screen.findByText(NONE_KEY)).toBeInTheDocument();
    expect(screen.queryByText(FAILED_KEY)).not.toBeInTheDocument();
  });

  it('ΟΣΟ ΦΟΡΤΩΝΕΙ ⇒ κανένα από τα δύο· η οθόνη δεν συμπεραίνει πριν μάθει', async () => {
    // Υπόσχεση που δεν λύνεται ποτέ = ο κόσμος «ρώτησα, περιμένω».
    getAllContacts.mockReturnValue(new Promise(() => undefined));

    render(<BrokeredListingPageContent />);
    await screen.findByRole('combobox');

    expect(screen.queryByText(FAILED_KEY)).not.toBeInTheDocument();
    expect(screen.queryByText(NONE_KEY)).not.toBeInTheDocument();
  });
});
