/**
 * ΑΓΚΥΡΕΣ — **η γραμμή προέλευσης ως πόρτα** (ADR-777 §8.58 · Φ7)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αλλαγή στηρίζεται σε **έναν ισχυρισμό για ΞΕΝΟ κώδικα**: ότι το `/pro/<τμήμα>`
 * λύνει **και** σταθερή ταυτότητα (`comp_<uuid>`), όχι μόνο ψευδώνυμο. Αν ο
 * ισχυρισμός είναι λάθος, η γραμμή γίνεται σύνδεσμος προς **404** — και **καμία**
 * υπάρχουσα άγκυρα δεν θα το έβλεπε, γιατί καμία δεν ρωτά αυτή την ερώτηση.
 *
 * ⇒ Η **Ε3** παρακάτω **ΕΚΤΕΛΕΙ ΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΚΡΙΤΗ** του `resolveAlias`
 * (`readsAsWorkspaceIdentity`) πάνω στην **ίδια** τιμή που παράγει η οθόνη. Ένα
 * σχόλιο θα ήταν ισχυρισμός· αυτό είναι απόδειξη *(ADR-587 §6.1: «ένα anchor χωρίς
 * gate δεν είναι anchor — είναι σχόλιο»)*.
 *
 * ⚠️ **Το `t` επιστρέφει το ΚΛΕΙΔΙ, επίτηδες** — ίδιο ιδίωμα με τα αδέλφια: άγκυρα
 * που ψάχνει ελληνικό κείμενο σπάει σε κάθε διόρθωση διατύπωσης.
 *
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

/**
 * ⚠️ Ο `alias-registry` σέρνει `firebaseAdmin` σε επίπεδο module. Η **κρίση** που μας
 * ενδιαφέρει (`readsAsWorkspaceIdentity`) είναι **καθαρή και δεν αγγίζει βάση** — γι'
 * αυτό ο διακομιστής σιωπά αντί να λείπει: αν τον αφαιρούσαμε, η Ε3 θα δοκίμαζε
 * αντίγραφο του κριτή αντί για τον ίδιο.
 */
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => {
    throw new Error('Η άγκυρα δεν επιτρέπεται να αγγίξει τη βάση');
  },
  isFirebaseAdminAvailable: () => false,
}));

import { ListingAuthorshipLine } from '../ListingAuthorshipLine';
import { readsAsWorkspaceIdentity } from '@/lib/workspace/alias-registry';
import { AGENCY_DIRECTORY_ROUTE } from '@/components/mandate/agency-directory-route';
import type { PublicListing } from '@/types/public-listing';

/** Γνήσιο `comp_<uuid v4>` — η μορφή που κουβαλά κάθε δημοσιευμένη αγγελία γραφείου. */
const COMPANY_ID = 'comp_a0000001-7777-4aaa-8aaa-000000000001';

type Line = Pick<PublicListing, 'authorship' | 'agencyName' | 'agencyId'>;

const CLASS_NAME = 'text-xs';

function draw(listing: Line) {
  return render(<ListingAuthorshipLine listing={listing} className={CLASS_NAME} />);
}

describe('ADR-777 §8.58 — η γραμμή προέλευσης οδηγεί στη βιτρίνα', () => {
  it('Ε1 — γραφείο με επωνυμία ΚΑΙ ταυτότητα ⇒ σύνδεσμος προς τη βιτρίνα του', () => {
    draw({ authorship: 'agency', agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.', agencyId: COMPANY_ID });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', `${AGENCY_DIRECTORY_ROUTE}/${COMPANY_ID}`);

    // Το accessible name είναι **η πρόταση**, δηλαδή ονομάζει το γραφείο: ο σύνδεσμος
    // λέει πού πάει χωρίς δεύτερο `aria-label` (και χωρίς `title=`, CHECK 3.23).
    expect(link).toHaveTextContent('listing.authorship.agency');
    expect(link).toHaveTextContent('ΠΑΓΩΝΗΣ Α.Ε.');
  });

  it('Ε2 — γραφείο με επωνυμία ΧΩΡΙΣ ταυτότητα ⇒ κείμενο, κανένας σύνδεσμος', () => {
    draw({ authorship: 'agency', agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.', agencyId: null });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/listing\.authorship\.agency/)).toBeInTheDocument();
  });

  it('Ε2β — 🔴 ΤΟ ΚΕΝΟ ΑΛΦΑΡΙΘΜΗΤΙΚΟ ΑΠΑΝΤΑ ΤΑΥΤΟΣΗΜΑ ΜΕ ΤΟ `null` — κανόνας ιδιωτικότητας, όχι άμυνα εισόδου', () => {
    // Ο κριτής είναι ο `agencyDoorFor`, και το `agency-door.ts` γράφει γιατί: αν το ένα
    // έδινε σύνδεσμο και το άλλο όχι, η **παρουσία** του συνδέσμου θα ξεχώριζε
    // «δεν δημοσίευσε» από «δεν λύθηκε» ⇒ απαρίθμηση γραφείων (Ε-5 §4 #1).
    draw({ authorship: 'agency', agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.', agencyId: '   ' });
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('Ε3 — 🔴 Ο ΚΡΙΚΟΣ: το τμήμα που παράγει η οθόνη το ΛΥΝΕΙ ο ΠΡΑΓΜΑΤΙΚΟΣ κριτής του `/pro/[alias]`', () => {
    draw({ authorship: 'agency', agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.', agencyId: COMPANY_ID });

    const href = screen.getByRole('link').getAttribute('href') ?? '';
    const segment = decodeURIComponent(href.slice(`${AGENCY_DIRECTORY_ROUTE}/`.length));

    // Αυτή η συνάρτηση **είναι** ο πρώτος κλάδος του `resolveAlias`: `true` σημαίνει
    // `{ outcome: 'found' }` με **μηδέν** αναγνώσεις βάσης. Αν γυρίσει `false`, η
    // σελίδα πέφτει στο ευρετήριο ψευδωνύμων, δεν βρίσκει, και ο σύνδεσμος οδηγεί
    // σε «δεν υπάρχει τέτοιο γραφείο».
    expect(readsAsWorkspaceIdentity(segment)).toBe(true);
  });

  it('Ε4 — το `encodeURIComponent` αφήνει την ταυτότητα ΑΘΙΚΤΗ (`_` και `-` δεν κωδικοποιούνται)', () => {
    draw({ authorship: 'agency', agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.', agencyId: COMPANY_ID });

    // Αν το `_` κωδικοποιούνταν, το τμήμα θα έχανε τη γραμματική της ταυτότητας και
    // η Ε3 θα γινόταν ψευδώς πράσινη μέσω του `decodeURIComponent` της ίδιας άγκυρας.
    expect(screen.getByRole('link')).toHaveAttribute('href', `/pro/${COMPANY_ID}`);
  });

  it('Ε5 — ανώνυμο γραφείο ΜΕ ταυτότητα ⇒ κείμενο: σύνδεσμος που δεν ονομάζει κανέναν δεν λέει πού πάει', () => {
    draw({ authorship: 'agency', agencyName: null, agencyId: COMPANY_ID });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('search-results:listing.authorship.agencyAnonymous')).toBeInTheDocument();
  });

  it('Ε6 — δήλωση ιδιώτη ⇒ κείμενο· ο ιδιώτης ΔΕΝ έχει βιτρίνα και δεν αποκτά μία κατά λάθος', () => {
    draw({ authorship: 'owner-declared', agencyName: null, agencyId: null });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('search-results:listing.authorship.ownerDeclared')).toBeInTheDocument();
  });

  it('Ε7 — η τυπογραφία του καλούντος μένει στην ΠΑΡΑΓΡΑΦΟ, ποτέ στον σύνδεσμο', () => {
    const { container } = draw({
      authorship: 'agency',
      agencyName: 'ΠΑΓΩΝΗΣ Α.Ε.',
      agencyId: COMPANY_ID,
    });

    // Το `className` του καλούντος είναι τυπογραφία παραγράφου (`mt-2`, `text-xs`). Σε
    // inline στοιχείο το περιθώριο δεν κάνει τίποτα — γι' αυτό το `<a>` ζει ΜΕΣΑ στο `<p>`.
    const paragraph = container.querySelector('p');
    expect(paragraph).toHaveClass(CLASS_NAME);
    expect(screen.getByRole('link')).not.toHaveClass(CLASS_NAME);
  });
});
