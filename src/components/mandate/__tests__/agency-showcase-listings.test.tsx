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
import { CREDIBILITY_KEYS, LEGAL_FORM_KEYS, PROFILE_KEYS } from '../agency-directory-labels';
import { SHOWCASE_REGISTRY_DOOR_KEYS } from '../agency-showcase-registry-labels';
import { formatLongDate } from '@/lib/intl-formatting';
import type { PublicShowcase } from '@/types/agency-profile';
import type { ShowcaseLocation } from '@/types/showcase-card';
import { legalIdentityFixture, showcaseFixture, TRADE_CREDENTIAL } from '@/lib/agency/__fixtures__/showcase-fixture';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

const ALFA = 'comp_alfa';

/** Α23 Φ4 — ό,τι ζητήθηκε από τον επιλυτή **με τις παραμέτρους του** (η ημερομηνία δεν φαίνεται στο κείμενο-κλειδί). */
const mockTranslateCalls: Array<readonly [string, unknown]> = [];

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => {
      mockTranslateCalls.push([key, options]);
      return key;
    },
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  // ADR-777 §8.74: το `SavedListingsProvider` ζητά δρομολογητή + διαδρομή (για την
  // επιστροφή μετά τη σύνδεση) — χωρίς αυτά η σουίτα κοκκίνιζε πριν κρίνει οτιδήποτε.
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/pro/test',
}));

jest.mock('@/services/realtime/hooks/usePublicPlace', () => ({
  usePublicPlace: () => ({ state: 'idle' }),
}));

const PROFILE = showcaseFixture({
  companyId: ALFA,
  alias: 'alfa',
  displayName: 'ΑΛΦΑ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.',
  publishedAt: '2026-08-30T10:00:00.000Z',
});

jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  // 🔴 **`showcase`, ΟΧΙ `profile`** — το πεδίο μετονομάστηκε μαζί με τον τύπο
  //    (Φ6-Β2). Το mock είχε μείνει πίσω: **πλαστό σύμβολο που δεν αντιστοιχεί
  //    σε τίποτα** ⇒ το `lookup.showcase` ήταν `undefined` και η οθόνη έσκαγε
  //    στην πρώτη γραμμή της. Ακριβώς ο λόγος που ένα mock είναι υπόσχεση, και
  //    το Jest **δεν κάνει type-check** για να την ελέγξει.
  usePublicAgency: () => ({ state: 'found', showcase: PROFILE_REF.current }),
  agencyDoorFor: (companyId: string | null) =>
    companyId === null || companyId.trim() === ''
      ? { kind: 'absent' }
      : { kind: 'ask', companyId: companyId.trim() },
}));

/** Το `jest.mock` υψώνεται πάνω από τις σταθερές — η αναφορά γεμίζει μετά. */
const PROFILE_REF: { current: PublicShowcase } = { current: PROFILE };

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
    listedAt: { kind: 'unknown', reason: 'predates-record' },
    priceReduction: null,
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    exchange: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 90,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    floor: null,
    bedrooms: null,
    // ✅ **ADR-842 Φ3** — τα 23 χαρακτηριστικά, ως **μία** ονομασμένη απουσία.
    //    Οκτώ fixtures θα κρατούσαν ο καθένας τη δική του λίστα `null` — δηλαδή οκτώ
    //    λίστες που συμφωνούν μέχρι την πρώτη προσθήκη πεδίου.
    ...UNASKED_LISTING_ATTRIBUTES,
    legality: [],
    authorship: 'agency',
    agencyName: PROFILE.displayName,
    agencyId: ALFA,
  };
}

function paint(state: Partial<typeof listingsState>, profile: PublicShowcase = PROFILE): void {
  listingsState = { listings: [], loading: false, error: null, ...state };
  LISTINGS_REF.current = listingsState;
  PROFILE_REF.current = profile;
  render(<AgencyProfileContent companyId={ALFA} alias="alfa" />);
}

/**
 * 🔴 **Η ΒΙΤΡΙΝΑ ΤΟΥ ΕΥΡΗΜΑΤΟΣ** — γραφείο **εγκαταστάσεων φυσικού αερίου**, το ίδιο
 * που στις 2026-09-06 καλούσε τον επισκέπτη να του αναθέσει **μεσιτεία**.
 */
const TRADE_PROFILE = showcaseFixture({
  companyId: ALFA,
  alias: 'alfa',
  displayName: 'ΘΕΡΜΟΔΟΜΗ — ΕΓΚΑΤΑΣΤΑΣΕΙΣ ΦΥΣΙΚΟΥ ΑΕΡΙΟΥ',
  publishedAt: '2026-08-30T10:00:00.000Z',
  credentials: [TRADE_CREDENTIAL],
});

/** ADR-841 §7 Α21.16 — ένα κατάστημα με τηλέφωνο: το **ίδιο** για μεσίτη και τεχνίτη. */
const PHONE_LOCATION: ShowcaseLocation = {
  id: 'sloc_fixture',
  role: 'headquarters',
  label: null,
  place: { landId: 'land_fixture', buildingId: null },
  position: null,
  street: null,
  hours: null,
  specialHours: [],
  channelKinds: ['phone'],
  emailConfirmedAt: null,
};

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
    expect(screen.queryByText('search-results:listing.authorship.agency')).not.toBeInTheDocument();
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

/**
 * 🔴 **ADR-841 §7 Α5 — Η ΒΙΤΡΙΝΑ ΡΩΤΑΕΙ ΠΟΙΕΣ ΠΡΑΞΕΙΣ ΔΕΧΕΤΑΙ.**
 *
 * ⚠️ Το Ε1 είναι η **μοναδική** άγκυρα που θα είχε πιάσει το ελάττωμα: όλα τα Β1-Β6
 * ήταν πράσινα ενώ η οθόνη ζητούσε από τεχνίτη να ασκήσει μεσιτεία — κανένα τους δεν
 * ρωτούσε *ποιο κουμπί* δείχνει η σελίδα.
 */
describe('Ε. Οι πράξεις της βιτρίνας (ADR-841 §7 Α5)', () => {
  it('🔴 Ε1 — ΤΟ ΕΥΡΗΜΑ: γραφείο φυσικού αερίου ΔΕΝ καλεί σε εντολή μεσιτείας', () => {
    paint({ listings: [] }, TRADE_PROFILE);

    expect(screen.queryByText(PROFILE_KEYS.requestCta)).not.toBeInTheDocument();
    expect(screen.queryByText(PROFILE_KEYS.requestHint)).not.toBeInTheDocument();
  });

  it('🔴 Ε2 — ούτε επικαλείται τη ΜΕΣΙΤΙΚΗ ΣΥΜΒΑΣΗ δίπλα στο τηλέφωνό του (Α21.16)', () => {
    // ⚠️ Το κουμπί «Εμφάνιση τηλεφώνου» **υπάρχει** — λείπει μόνο η μεσιτική υπενθύμιση.
    //    Χωρίς τη δεύτερη προσδοκία, ένα «κρύψε την κάρτα» θα περνούσε ως διόρθωση.
    paint({ listings: [] }, { ...TRADE_PROFILE, locations: [PHONE_LOCATION] });

    expect(screen.getByText(PROFILE_KEYS.cardShowPhone)).toBeInTheDocument();
    expect(screen.queryByText(PROFILE_KEYS.cardBrokerWritten)).not.toBeInTheDocument();
  });

  it('🔴 Ε3 — και η κενή λίστα δεν του ζητά να «αναλάβει το δικό σας ακίνητο»', () => {
    paint({ listings: [] }, TRADE_PROFILE);

    expect(screen.queryByText(PROFILE_KEYS.listingsEmptyHint)).not.toBeInTheDocument();
    expect(screen.getByText(PROFILE_KEYS.listingsEmptyHintPro)).toBeInTheDocument();
  });

  it('Ε4 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το μεσιτικό γραφείο τα κρατά ΟΛΑ αμετάβλητα', () => {
    // 🔑 Χωρίς αυτό, ένα «κρύψε το κουμπί πάντα» θα άφηνε τα Ε1-Ε3 πράσινα.
    paint({ listings: [] }, { ...PROFILE, locations: [PHONE_LOCATION] });

    expect(screen.getByText(PROFILE_KEYS.requestCta)).toBeInTheDocument();
    expect(screen.getByText(PROFILE_KEYS.cardBrokerWritten)).toBeInTheDocument();
    expect(screen.getByText(PROFILE_KEYS.listingsEmptyHint)).toBeInTheDocument();
    expect(screen.queryByText(PROFILE_KEYS.listingsEmptyHintPro)).not.toBeInTheDocument();
  });
});

/**
 * 🔒 **ADR-841 §7 Α23.8 — Γ4 φέτα 2: ΚΛΕΙΣΤΗ ΣΤΟ ΓΕΜΗ ⇒ ΚΑΝΕΝΑ ΚΟΥΜΠΙ ΚΑΝΑΛΙΟΥ.**
 *
 * ⚠️ **ΔΥΟ** καταστήματα με κανάλια: η έδρα ανεβαίνει στην «Επικοινωνία», το δεύτερο κρατά τα κουμπιά του
 * **στην κάρτα** — έτσι η άγκυρα βλέπει **και τα δύο** σημεία της σελίδας, όχι μόνο το ένα.
 */
describe('Κ. Κλειστή στο ΓΕΜΗ (ADR-841 §7 Α23.8)', () => {
  // 🔑 Η επιβεβαίωση email αποδίδεται ΜΟΝΟ στη σύνοψη ⇒ τη φέρει η έδρα (αυτή ανεβαίνει).
  const CONFIRMED_HQ: ShowcaseLocation = {
    ...PHONE_LOCATION,
    channelKinds: ['phone', 'email'],
    emailConfirmedAt: '2026-09-01T09:00:00.000Z',
  };
  const PHONE_BRANCH: ShowcaseLocation = { ...PHONE_LOCATION, id: 'sloc_branch', role: 'branch' };
  const legalIdentity = (checkedAt: string | null): PublicShowcase['legalIdentity'] => ({
    publicName: 'legal-name',
    legalName: 'ΑΛΦΑ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
    legalForm: 'ae',
    gemiNumber: '123456789000',
    seat: { disclosure: 'municipality', streetLine: null, postalCode: null, locality: 'Θεσσαλονίκη' },
    attestation: { state: 'declared' },
    registryClosure: checkedAt === null ? null : { issuer: 'gemi', checkedAt },
  });
  const showcaseWith = (checkedAt: string | null): PublicShowcase => ({
    ...PROFILE,
    website: 'https://www.alfa.gr/',
    locations: [CONFIRMED_HQ, PHONE_BRANCH],
    legalIdentity: legalIdentity(checkedAt),
  });
  const CHANNEL_KEYS = [
    PROFILE_KEYS.cardShowPhone,
    PROFILE_KEYS.cardShowEmail,
    PROFILE_KEYS.cardSaveContact,
    PROFILE_KEYS.cardBrokerWritten,
    PROFILE_KEYS.cardEmailConfirmedOn,
  ] as const;

  it('🔴 Κ1 — κλειστή ⇒ ούτε «Εμφάνιση», ούτε «Αποθήκευση επαφής», ούτε μεσιτική υπενθύμιση — σε ΚΑΝΕΝΑ σημείο', () => {
    paint({ listings: [] }, showcaseWith('2026-09-14T11:00:00.000Z'));

    for (const key of CHANNEL_KEYS) expect(screen.queryByText(key)).not.toBeInTheDocument();
    // 🔑 Η σελίδα ΜΕΝΕΙ (GBP): και τα δύο καταστήματα με τη διεύθυνσή τους, και η ιστοσελίδα.
    expect(screen.getAllByText(PROFILE_KEYS.cardAreaOnly)).toHaveLength(2);
    expect(screen.getByText('alfa.gr')).toBeInTheDocument();
  });

  it('🔑 Κ2 — Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: η ΙΔΙΑ βιτρίνα ενεργή ⇒ όλα εκεί, και στα δύο σημεία', () => {
    // Χωρίς αυτό, ένα «κρύψε τα κανάλια πάντα» ή ένα fixture χωρίς κανάλια θα άφηνε το Κ1 πράσινο.
    paint({ listings: [] }, showcaseWith(null));

    for (const key of CHANNEL_KEYS) expect(screen.queryAllByText(key).length).toBeGreaterThan(0);
    expect(screen.getAllByText(PROFILE_KEYS.cardShowPhone)).toHaveLength(2);
    expect(screen.getAllByText(PROFILE_KEYS.cardAreaOnly)).toHaveLength(2);
    expect(screen.getByText(PROFILE_KEYS.requestCta)).toBeInTheDocument();
  });

  it('🔴 Κ3 — Φ3.3: κλειστή ΜΕΣΙΤΙΚΗ ⇒ κανένα «Ανάθεση εντολής» (ο γραφέας θα αρνιόταν `agency-closed`)', () => {
    paint({ listings: [] }, showcaseWith('2026-09-14T11:00:00.000Z'));

    expect(screen.queryByText(PROFILE_KEYS.requestCta)).not.toBeInTheDocument();
    expect(screen.queryByText(PROFILE_KEYS.requestHint)).not.toBeInTheDocument();
    // 🔑 Το επάγγελμα ΔΕΝ άλλαξε: η λίστα αγγελιών μιλά ακόμα σε μεσίτη (όχι στον τεχνίτη).
    expect(screen.getByText(PROFILE_KEYS.listingsEmptyHint)).toBeInTheDocument();
  });

  it('⚖️ Κ4 — Α23 Φ4: κλειστή ⇒ η σελίδα ΛΕΕΙ γιατί, με την ημερομηνία του ΕΛΕΓΧΟΥ (όχι της δημοσίευσης)', () => {
    const checkedAt = '2026-09-14T11:00:00.000Z';
    mockTranslateCalls.length = 0;
    paint({ listings: [] }, showcaseWith(checkedAt));

    expect(screen.getByText(PROFILE_KEYS.registryClosed)).toBeInTheDocument();
    expect(mockTranslateCalls).toContainEqual([PROFILE_KEYS.registryClosed, { date: formatLongDate(checkedAt) }]);
    // 🔑 Η σελίδα ΜΕΝΕΙ βιτρίνα (GBP): το όνομα στον τίτλο.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(PROFILE.displayName);
  });

  it('🔑 Κ5 — Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ενεργή ⇒ καμία ένδειξη· και ΜΙΑ πρόταση για κάτοχο και επισκέπτη', () => {
    paint({ listings: [] }, showcaseWith(null));

    expect(screen.queryByText(PROFILE_KEYS.registryClosed)).not.toBeInTheDocument();
    expect(PROFILE_KEYS.registryClosed).toBe(SHOWCASE_REGISTRY_DOOR_KEYS.closed);
  });
});

/**
 * ⚖️ **ADR-841 §7 Α23 Φ4 Α2 — ΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ ΣΤΗ ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ.**
 *
 * 🔑 Το `PROFILE` είναι μεσίτης με αριθμό ΓΕΜΗ `123456789000` — ο **ίδιος** με του `legalIdentityFixture` ⇒ η άγκυρα βλέπει
 * και την αφαίρεση της επανάληψης (Ν1/Ν3/Ν4).
 */
describe('Ν. Νομικά στοιχεία (ADR-841 §7 Α23 Φ4 Α2)', () => {
  const VERIFIED_AT = '2026-09-10T08:00:00.000Z';
  const withIdentity = (legalIdentity: PublicShowcase['legalIdentity']): PublicShowcase => ({ ...PROFILE, legalIdentity });

  it('⚖️ Ν1 — επωνυμία · μορφή · ΓΕΜΗ (ΜΙΑ φορά) · έδρα · «επαληθεύτηκαν» με ημερομηνία ελέγχου', () => {
    mockTranslateCalls.length = 0;
    paint(
      { listings: [] },
      withIdentity(legalIdentityFixture({ attestation: { state: 'verified', issuer: 'gemi', checkedAt: VERIFIED_AT } })),
    );

    expect(screen.getByText(PROFILE_KEYS.legalTitle)).toBeInTheDocument();
    expect(screen.getByText('ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ')).toBeInTheDocument();
    expect(screen.getByText(LEGAL_FORM_KEYS.ae)).toBeInTheDocument();
    expect(mockTranslateCalls).toContainEqual([PROFILE_KEYS.legalSeat, { seat: 'Θεσσαλονίκη' }]);
    expect(mockTranslateCalls).toContainEqual([PROFILE_KEYS.legalVerifiedOn, { date: formatLongDate(VERIFIED_AT) }]);
    expect(screen.getAllByText(CREDIBILITY_KEYS.claimNational)).toHaveLength(1);
    expect(screen.queryByText(CREDIBILITY_KEYS.claimDeclared)).not.toBeInTheDocument();
  });

  it('🔴 Ν2 — δηλωμένη ⇒ «Δήλωση του ίδιου», ΠΟΤΕ «επαληθεύτηκαν»', () => {
    paint({ listings: [] }, withIdentity(legalIdentityFixture()));

    expect(screen.getAllByText(CREDIBILITY_KEYS.claimDeclared)).toHaveLength(1);
    expect(screen.queryByText(PROFILE_KEYS.legalVerifiedOn)).not.toBeInTheDocument();
  });

  it('🔑 Ν3 — Ο ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: βιτρίνα πριν την Α23 ⇒ κανένα μπλοκ· ο αριθμός του μεσίτη ΜΕΝΕΙ', () => {
    paint({ listings: [] }, PROFILE);

    expect(screen.queryByText(PROFILE_KEYS.legalTitle)).not.toBeInTheDocument();
    expect(screen.getAllByText(CREDIBILITY_KEYS.claimNational)).toHaveLength(1);
  });

  it('🔑 Ν4 — ΑΛΛΟΣ αριθμός στο πιστοποιητικό ⇒ δύο γεγονότα, δύο γραμμές', () => {
    paint({ listings: [] }, withIdentity(legalIdentityFixture({ gemiNumber: '999999999000' })));

    expect(screen.getAllByText(CREDIBILITY_KEYS.claimNational)).toHaveLength(2);
  });
});
