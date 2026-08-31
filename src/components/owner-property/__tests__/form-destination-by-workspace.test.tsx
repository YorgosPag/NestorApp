/**
 * @fileoverview 🔴 **ΜΙΑ ΦΟΡΜΑ, ΔΥΟ ΧΩΡΟΙ — ΚΑΙ ΠΛΕΟΝ ΔΥΟ ΠΡΟΟΡΙΣΜΟΙ.**
 * @related ADR-787 §5.3 ο · components/owner-property/OwnerPropertyFormContent.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ (2026-08-31)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετά την «Καταχώρηση» αγγελίας **γραφείου**, η ανακατεύθυνση πήγε στο
 * `/offers/ownp_cef8a729…` που απάντησε *«Αυτό το ακίνητο δεν υπάρχει — ή δεν είναι
 * δικό σου»* — για ακίνητο που **μόλις** δημιούργησε ο **ίδιος** χρήστης.
 *
 * Η γραμμή 278 έκανε `router.push(offerDetailHref(…))` **χωρίς κανέναν όρο**, ενώ την
 * ίδια φόρμα τη φορούν **δύο** χώροι: ο προσωπικός (`/offers/new`) και του γραφείου
 * (`/o/<χώρος>/listings/mandates/new`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΚΑΜΙΑ ΥΠΑΡΧΟΥΣΑ ΠΥΛΗ ΔΕΝ ΤΟ ΕΒΛΕΠΕ — ΚΑΙ ΟΛΕΣ ΗΤΑΝ ΣΩΣΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πύλη | Ρωτά | Γιατί ήταν πράσινη |
 * |---|---|---|
 * | **CHECK 3.61** | *«ζητά αυτό το αρχείο την πλοήγηση από το ΣΥΝΟΡΟ;»* | **ΝΑΙ** — η γραμμή 43 εισάγει ήδη `useRouter` από `@/lib/workspace/navigation` |
 * | **CHECK 3.60** | *«ζει αυτή η **σελίδα** πίσω από το πρόθεμα χώρου;»* | κρίνει **σελίδες**, όχι προορισμούς |
 * | φρουρός #4 *(`route-catalogue-anchor`)* | *«οδηγεί αυτός ο κυριολεκτικός σύνδεσμος σε υπαρκτή σελίδα;»* | το `/offers/[offerId]` **υπάρχει**· και η κλήση δεν είναι καν κυριολεξία |
 *
 * ⇒ Το ερώτημα που **κανείς** δεν έθετε δεν είναι *«από πού έρχεται ο router;»* αλλά
 * ***«ποιος ΚΑΤΑΛΟΓΟΣ διαδρομών ανήκει σε αυτή τη φόρμα, όταν τη φοράει ο χώρος Χ;»***
 * Το σύνορο τηρήθηκε· το **λεξιλόγιο προορισμού** όχι.
 *
 * 🏆 **ΚΑΙ Ο ΣΩΣΤΟΣ ΠΡΟΟΡΙΣΜΟΣ ΗΤΑΝ ΗΔΗ ΓΡΑΜΜΕΝΟΣ — ΣΕ ΣΧΟΛΙΟ.** Το
 * `useMyOwnerProperty` ρωτά **αυτόν ακριβώς** τον κριτή (`isPersonalCustody`) και
 * απαντά `absent`, με το σχόλιο: *«μια εταιρική αγγελία ζει στον χώρο του γραφείου,
 * και η οθόνη της είναι **ο κατάλογος εντολών**»*. Ο κριτής ρωτιόταν **μόνο στον
 * προορισμό**, ποτέ στην απόφαση να πάμε εκεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ — ΚΑΙ ΓΙΑΤΙ ΜΟΝΟ ΑΥΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **ταχυδρόμος** (η υπηρεσία γραφής) και το **σύνορο πλοήγησης**. Ο κριτής
 * εγκυρότητας, ο κριτής θεματοφυλακής, η μνήμη προσχεδίου και η ίδια η φόρμα τρέχουν
 * **αληθινά** — αλλιώς η άγκυρα θα απεδείκνυε ότι ο κώδικας καλεί ό,τι νομίζουμε, όχι
 * ότι ο άνθρωπος καταλήγει εκεί που πρέπει *(μάθημα Μ-Ζ)*.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { MANDATE_CATALOG_ROUTE } from '@/lib/mandate/mandate-routes';
import {
  brokeredOwnerProperty,
  validOwnerProperty,
} from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { ownerPropertyFormFrom } from '@/lib/owner-property/owner-property-form-values';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import type { OwnerProperty } from '@/types/owner-property';

const pushed: string[] = [];

/** Το **σύνορο** αντικαθίσταται μόνο ως προς το «πού στάλθηκε». */
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({
    push: (href: string) => {
      pushed.push(href);
    },
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const createOwnerListing = jest.fn();
const createBrokeredOwnerListing = jest.fn();
const updateOwnerListing = jest.fn();

/** Ο **ταχυδρόμος**. Το `newOwnerPropertyId` μένει αληθινό — είναι ταυτότητα, όχι δίκτυο. */
jest.mock('@/services/owner-property/owner-property.service', () => ({
  ...jest.requireActual('@/services/owner-property/owner-property.service'),
  createOwnerListing: (...args: unknown[]) => createOwnerListing(...args),
  createBrokeredOwnerListing: (...args: unknown[]) => createBrokeredOwnerListing(...args),
  updateOwnerListing: (...args: unknown[]) => updateOwnerListing(...args),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user_maria', email: 'maria@example.gr' } }),
}));

// ⚠️ `requireActual` και ΟΧΙ ολικό mock: το `src/i18n/config.ts` ζητά το
//    `initReactI18next` τη στιγμή της εισαγωγής — ίδιο μάθημα με το
//    `brokered-listing-gate.test.tsx`. Αντικαθίσταται **μόνο** ο μεταφραστής.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OwnerPropertyFormContent } =
  require('@/components/owner-property/OwnerPropertyFormContent') as typeof import('@/components/owner-property/OwnerPropertyFormContent');

/** Η αγγελία του **ιδιώτη** — `authorCompanyId: null`. */
const PERSONAL: OwnerProperty = validOwnerProperty();

/** Η αγγελία του **γραφείου** — `authorCompanyId: comp_…`, ίδια πεδία κατά τα άλλα. */
const OFFICE: OwnerProperty = brokeredOwnerProperty();

/** Το αίτημα εντολής, όσο χρειάζεται η φόρμα για να θεωρήσει το γραφείο παρόν. */
const MANDATE_PROP = {
  section: <div />,
  blockers: [] as readonly never[],
  request: {
    clientContactId: 'cont_kostas',
    expiresAt: '2027-02-20T23:59:59.999Z',
    via: 'owner-consent',
    documentPath: null,
  },
  onNotify: () => undefined,
};

/**
 * Αποδίδει τη φόρμα με **έγκυρες** τιμές και πατά «Καταχώρηση».
 *
 * 🔑 Οι τιμές παράγονται από **πραγματική** αγγελία μέσω του `ownerPropertyFormFrom`
 * — όχι χειρόγραφο αντικείμενο: ο κριτής εγκυρότητας τρέχει **αληθινός**, άρα ένα
 * fixture που δεν περνά θα το έλεγε **εδώ**, όχι σιωπηλά.
 */
async function submitAs(property: OwnerProperty, asOffice: boolean): Promise<void> {
  render(
    <OwnerPropertyFormContent
      initialValues={ownerPropertyFormFrom(property)}
      {...(asOffice ? { mandate: MANDATE_PROP } : {})}
    />,
  );

  const form = document.querySelector('form');
  if (form === null) throw new Error('ο παρονομαστής έσπασε: η φόρμα δεν αποδόθηκε');
  fireEvent.submit(form);

  await waitFor(() => {
    expect(pushed.length).toBeGreaterThan(0);
  });
}

beforeEach(() => {
  pushed.length = 0;
  createOwnerListing.mockReset();
  createBrokeredOwnerListing.mockReset();
  updateOwnerListing.mockReset();
  window.localStorage.clear();
});

// ============================================================================
// Χ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// ============================================================================

describe('🔑 Χ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχουν δύο χώροι, και διαφέρουν', () => {
  it('Χ0α — τα δύο fixtures ΔΙΑΦΩΝΟΥΝ στη θεματοφυλακή', () => {
    // 🔑 Χωρίς αυτό, «ο ένας πάει αλλού από τον άλλον» θα ήταν πράσινο πάνω σε δύο
    //    ταυτόσημα fixtures — δηλαδή η άγκυρα δεν θα είχε κοιτάξει τίποτα.
    expect(PERSONAL.authorCompanyId).toBeNull();
    expect(OFFICE.authorCompanyId).toEqual(expect.any(String));
  });

  it('Χ0β — οι δύο προορισμοί είναι ΔΙΑΦΟΡΕΤΙΚΕΣ διευθύνσεις', () => {
    expect(offerDetailHref(OFFICE.id)).not.toBe(MANDATE_CATALOG_ROUTE);
  });

  it('🔑 Χ0γ — η φόρμα ΟΝΤΩΣ πλοηγεί: ο ιδιώτης φτάνει στη σελίδα του', async () => {
    // Χωρίς αυτόν, ένα `Χ1` που ρωτά «ΔΕΝ πήγε στο /offers» θα ήταν πράσινο και αν η
    // φόρμα **δεν πλοηγούσε ποτέ** — «λύση» με σπάσιμο της οθόνης για όλους.
    createOwnerListing.mockResolvedValue({
      kind: 'saved',
      property: PERSONAL,
      publish: { kind: 'published' },
    });

    await submitAs(PERSONAL, false);

    expect(pushed).toEqual([offerDetailHref(PERSONAL.id)]);
  });
});

// ============================================================================
// Χ1-Χ3 — Ο ΠΡΟΟΡΙΣΜΟΣ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟΝ ΧΩΡΟ ΤΗΣ ΑΓΓΕΛΙΑΣ
// ============================================================================

describe('🔴 Χ — μία φόρμα, δύο χώροι, ΔΥΟ προορισμοί', () => {
  it('🔴 Χ1 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: αγγελία ΓΡΑΦΕΙΟΥ ΔΕΝ στέλνεται στον ιδιωτικό χώρο', async () => {
    // 🔴 Η γραμμή που κοκκινίζει αν κάποιος επαναφέρει το άνευ όρων
    //    `router.push(offerDetailHref(…))`. Ο μεσίτης διάβαζε *«Αυτό το ακίνητο δεν
    //    υπάρχει — ή δεν είναι δικό σου»* για ακίνητο που μόλις καταχώρησε.
    createBrokeredOwnerListing.mockResolvedValue({
      kind: 'saved',
      property: OFFICE,
      publish: { kind: 'not-published' },
      notify: { kind: 'sent', to: 'kostas@example.gr' },
    });

    await submitAs(OFFICE, true);

    expect(pushed).not.toContain(offerDetailHref(OFFICE.id));
  });

  it('🔴 Χ2 — και φτάνει στον ΚΑΤΑΛΟΓΟ ΕΝΤΟΛΩΝ, την οθόνη του χώρου του', async () => {
    // ⚠️ Ξεχωριστός ισχυρισμός από το Χ1 επίτηδες: «δεν πήγε λάθος» και «πήγε σωστά»
    //    είναι δύο πράγματα, και μια πλοήγηση σε **τρίτη** διεύθυνση θα περνούσε το Χ1.
    createBrokeredOwnerListing.mockResolvedValue({
      kind: 'saved',
      property: OFFICE,
      publish: { kind: 'not-published' },
      notify: { kind: 'sent', to: 'kostas@example.gr' },
    });

    await submitAs(OFFICE, true);

    expect(pushed).toEqual([MANDATE_CATALOG_ROUTE]);
  });

  it('🔴 Χ3 — Ο ΚΡΙΤΗΣ ΕΙΝΑΙ Η ΑΓΓΕΛΙΑ, ΟΧΙ Η ΦΟΡΜΑ', async () => {
    // 🔑 **Η γραμμή που κάνει τη διόρθωση να ΣΗΜΑΙΝΕΙ κάτι.** Ένα
    //    `mandate === undefined ? … : …` θα περνούσε τα Χ1/Χ2 — και θα ήταν **δεύτερη
    //    αυθεντία**: η φόρμα θα μάντευε τον χώρο από τα δικά της props αντί να τον
    //    διαβάσει από τη θεματοφυλακή που έγραψε ο διακομιστής.
    //
    //    Εδώ ο διακομιστής επιστρέφει **προσωπική** αγγελία ενώ η φόρμα φοριέται από
    //    τον χώρο του γραφείου (σενάριο απόκλισης). Η απάντηση οφείλει να ακολουθεί
    //    το **έγγραφο**: ίδιο δόγμα με το `custodyOf` — *«δεν υπάρχει κατάσταση αρχείο
    //    σε λάθος φάκελο»*.
    createBrokeredOwnerListing.mockResolvedValue({
      kind: 'saved',
      property: PERSONAL,
      publish: { kind: 'published' },
      notify: { kind: 'sent', to: 'kostas@example.gr' },
    });

    await submitAs(PERSONAL, true);

    expect(pushed).toEqual([offerDetailHref(PERSONAL.id)]);
  });
});
