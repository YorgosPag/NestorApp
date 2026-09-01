/**
 * @fileoverview **ADR-841 §7 (Α6) — Η ΒΙΤΡΙΝΑ ΔΕΙΧΝΕΙ ΤΙ ΠΟΥΛΑΕΙ, ΟΧΙ ΜΟΝΟ ΠΟΙΟΣ ΕΙΝΑΙ.**
 * @related ADR-841 §7 (Α1 · Α6) · ADR-827 §9.6 #2 · components/mandate/AgencyProfileContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΥΠΑΡΧΟΥΣΑ ΑΓΚΥΡΑ ΔΕΝ ΤΟ ΕΒΛΕΠΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `/pro/<ψευδώνυμο>` έδειχνε **επωνυμία · ΓΕΜΗ · περιοχή · κουμπί** και **μηδέν
 * αγγελίες** — η βιτρίνα έλεγε *ποιος* είναι, όχι *τι* πουλά. Το εμπόδιο δεν ήταν
 * σχεδιαστικό: το `PublicListing` **δεν είχε ταυτότητα γραφείου**, μόνο επωνυμία-
 * κείμενο. Ένα φίλτρο εκεί θα ήταν **λάθος**: δύο γραφεία με ίδιο όνομα θα έδειχναν
 * το ένα τις αγγελίες του άλλου, και μια **μετονομασία** θα άδειαζε τη βιτρίνα.
 *
 * ⚠️ **Η ΚΡΙΣΙΜΗ ΑΓΚΥΡΑ ΕΙΝΑΙ Η Β5**: *με ΤΙ ρωτάει;* Ένα φίλτρο πάνω στο `agencyName`
 * θα έκανε **κάθε άλλη** άγκυρα αυτού του αρχείου πράσινη — η λίστα θα γέμιζε το ίδιο.
 * Θα έσπαγε μόνο σε παραγωγή, με ομώνυμα γραφεία ή μετά από μετονομασία.
 *
 * 🔑 **Ο ψεύτικος επιλυτής επιστρέφει το κλειδί αυτούσιο**: η ερώτηση είναι *«ποιο
 * μήνυμα διάλεξε η οθόνη;»*, όχι *«πώς μεταφράστηκε»* — εκείνο το φυλά η CHECK 3.8.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { AgencyProfileContent } from '../AgencyProfileContent';
import { PROFILE_KEYS } from '../agency-directory-labels';
import type { AgencyProfile } from '@/types/agency-profile';
import type { PublicListing } from '@/types/public-listing';

const ALFA = 'comp_alfa';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/services/realtime/hooks/usePublicPlace', () => ({
  usePublicPlace: () => ({ state: 'idle' }),
}));

const PROFILE: AgencyProfile = {
  companyId: ALFA,
  alias: 'alfa',
  displayName: 'ΑΛΦΑ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.',
  gemiNumber: '123456789000',
  place: null,
  publishedAt: '2026-08-30T10:00:00.000Z',
};

jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  usePublicAgency: () => ({ state: 'found', profile: PROFILE_REF.current }),
  agencyDoorFor: (companyId: string | null) =>
    companyId === null || companyId.trim() === ''
      ? { kind: 'absent' }
      : { kind: 'ask', companyId: companyId.trim() },
}));

/** Το `jest.mock` υψώνεται πάνω από τις σταθερές — η αναφορά γεμίζει μετά. */
const PROFILE_REF: { current: AgencyProfile } = { current: PROFILE };

/** Ό,τι ζήτησε ο κώδικας από τον αδελφό — **το ερώτημα, όχι μόνο η απάντηση**. */
const asked: { companyId: string | null } = { companyId: 'ΔΕΝ ΡΩΤΗΘΗΚΕ' as unknown as null };

let listingsState: { listings: readonly PublicListing[]; loading: boolean; error: string | null } = {
  listings: [],
  loading: false,
  error: null,
};

jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  usePublicAgencyListings: (companyId: string | null) => {
    asked.companyId = companyId;
    return LISTINGS_REF.current;
  },
}));

const LISTINGS_REF: { current: typeof listingsState } = { current: listingsState };

function listingOf(id: string, title: string): PublicListing {
  return {
    id,
    title,
    projectedAt: '2026-09-01T09:28:43.769Z',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    type: 'apartment',
    areaSqm: 90,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: null,
    bedrooms: null,
    legality: [],
    authorship: 'agency',
    agencyName: PROFILE.displayName,
    agencyId: ALFA,
  };
}

function paint(state: Partial<typeof listingsState>): void {
  listingsState = { listings: [], loading: false, error: null, ...state };
  LISTINGS_REF.current = listingsState;
  PROFILE_REF.current = PROFILE;
  render(<AgencyProfileContent companyId={ALFA} alias="alfa" />);
}

beforeEach(() => {
  asked.companyId = 'ΔΕΝ ΡΩΤΗΘΗΚΕ' as unknown as null;
});

describe('Β. Η βιτρίνα δείχνει τα ακίνητά της (ADR-841 §7 Α6)', () => {
  it('Β1 🔑 — οι αγγελίες του γραφείου φτάνουν στην οθόνη', () => {
    paint({ listings: [listingOf('prop_a', 'Μεζονέτα 95 τ.μ.'), listingOf('prop_b', 'Διαμέρισμα')] });

    expect(screen.getByText('Μεζονέτα 95 τ.μ.')).toBeInTheDocument();
    expect(screen.getByText('Διαμέρισμα')).toBeInTheDocument();
    expect(screen.getByText(PROFILE_KEYS.listingsTitle)).toBeInTheDocument();
  });

  it('🔴 Β2 — ΚΕΝΟ και ΣΦΑΛΜΑ ΔΕΝ λένε το ίδιο (N.12)', () => {
    paint({ listings: [] });
    expect(screen.getByText(PROFILE_KEYS.listingsEmpty)).toBeInTheDocument();
    // Η υπόδειξη υπάρχει επειδή το κενό **δεν κατηγορεί** το γραφείο.
    expect(screen.getByText(PROFILE_KEYS.listingsEmptyHint)).toBeInTheDocument();
    expect(screen.queryByText(PROFILE_KEYS.listingsFailed)).not.toBeInTheDocument();
  });

  it('🔴 Β3 — «δεν μπόρεσα να ρωτήσω» δεν φοράει τη στολή του «δεν έχει»', () => {
    paint({ error: 'permission-denied' });
    expect(screen.getByText(PROFILE_KEYS.listingsFailed)).toBeInTheDocument();
    expect(screen.queryByText(PROFILE_KEYS.listingsEmpty)).not.toBeInTheDocument();
  });

  it('Β4 🔑 — η ΥΠΟΓΡΑΦΗ δεν επαναλαμβάνεται: το λέει ήδη ο τίτλος της σελίδας', () => {
    paint({ listings: [listingOf('prop_a', 'Μεζονέτα 95 τ.μ.')] });

    // Ο παρονομαστής: η επωνυμία **υπάρχει** στην αγγελία…
    expect(listingOf('prop_a', 'x').agencyName).toBe(PROFILE.displayName);
    // …και εμφανίζεται **μία** φορά — στην κεφαλίδα, όχι σε κάθε κάρτα.
    expect(screen.getAllByText(PROFILE.displayName)).toHaveLength(1);
    expect(screen.queryByText('search-results:card.authorship.agency')).not.toBeInTheDocument();
  });

  it('🔴 Β5 — ΡΩΤΑΕΙ ΜΕ ΤΗΝ ΤΑΥΤΟΤΗΤΑ, όχι με την επωνυμία', () => {
    // 🔴 Η άγκυρα που δεν αντικαθίσταται από καμία άλλη: ένα φίλτρο πάνω στο
    //    `agencyName` θα γέμιζε τη λίστα το ίδιο και θα άφηνε τα Β1-Β4 πράσινα —
    //    και θα έσπαγε μόνο σε παραγωγή, με ομώνυμα γραφεία ή μετά από μετονομασία.
    paint({ listings: [listingOf('prop_a', 'Μεζονέτα')] });

    expect(asked.companyId).toBe(ALFA);
    expect(asked.companyId).not.toBe(PROFILE.displayName);
  });

  it('Β6 — η ταυτότητα έρχεται από το ΕΓΓΡΑΦΟ που διαβάστηκε, όχι από τη διεύθυνση', () => {
    // ⚠️ Το `alias` είναι **είσοδος** του επισκέπτη· το `profile.companyId` είναι η
    //    ταυτότητα του εγγράφου που μόλις επαληθεύτηκε. Η βιτρίνα ρωτά το δεύτερο.
    paint({ listings: [] });
    expect(asked.companyId).toBe(PROFILE.companyId);
  });
});
