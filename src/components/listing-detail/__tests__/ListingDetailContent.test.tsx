/**
 * Άγκυρες **της ίδιας της οθόνης 3** — τι ζωγραφίζει, σε κάθε κατάσταση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΤΟ `t` ΕΠΙΣΤΡΕΦΕΙ ΤΟ ΚΛΕΙΔΙ, ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ ΙΣΧΥΡΟΤΕΡΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα test που ψάχνει **ελληνικό κείμενο** σπάει σε κάθε διόρθωση διατύπωσης, οπότε
 * σταδιακά χαλαρώνει μέχρι να μη λέει τίποτα. Εδώ το `t` επιστρέφει το **κλειδί**,
 * άρα η άγκυρα κλειδώνει *«ποια ερωτήματα κάνει η οθόνη»* — που είναι το αμετάβλητο.
 *
 * 🔴 **Η απόδειξη «κανένα ωμό κλειδί» είναι το ΖΕΥΓΟΣ**, όχι αυτό το αρχείο μόνο του:
 *
 *   αυτό εδώ  → «η οθόνη ζητά **αυτά** τα κλειδιά»
 *   **Κ7** (`lib/listings/__tests__/listing-disclosure.test.ts`) → «αυτά τα κλειδιά
 *   **υπάρχουν** σε el **και** en, μη κενά»
 *
 * Καθένα μόνο του είναι μισή απόδειξη — και η μισή είναι ακριβώς αυτή που έχει
 * αποτύχει τέσσερις φορές σε αυτό το repo (CHECK 3.34 · 3.36 · 3.51): το κλειδί
 * υπήρχε, αλλά κανείς δεν ρώτησε αν κάποιος το **ζητά**· ή το ζητούσε, αλλά κανείς
 * δεν ρώτησε αν **υπάρχει**.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ListingDetailContent } from '../ListingDetailContent';
import { LEGALITY_CLAIM_KINDS } from '@/lib/legality/legality-claim';
import { legalitySignalsFor } from '@/lib/legality/legality-signal';
import type { PublicListing } from '@/types/public-listing';
import type { PublicListingLookup } from '@/services/realtime/hooks/usePublicListings';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

const mockSearchParams = { value: '' };
// ⚠️ Το `usePathname` ΔΕΝ είναι διακοσμητικό εδώ: το component πλοηγεί μέσω του
//    ΣΥΝΟΡΟΥ (`@/lib/workspace/navigation`, ADR-787 §5.3 μ), και το σύνορο ρωτά την
//    τρέχουσα διαδρομή για να βρει τον ενεργό χώρο. Μερικό mock ⇒ `usePathname is
//    not a function` ΠΡΙΝ τρέξει η πρώτη προσδοκία.
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearchParams.value),
  usePathname: () => '/',
}));

/**
 * ⚠️ Ο χάρτης αντικαθίσταται **επίτηδες**: ο `ResultsMap` φέρνει MapLibre + WebGL, που
 * δεν υπάρχουν σε jsdom. Η άγκυρα δεν ρωτά «ζωγραφίζει σωστά ο χάρτης;» — ρωτά «τον
 * ζητά η οθόνη, και **με ποια** αγγελία;», που είναι ακριβώς το σημείο όπου μπορεί να
 * περάσει λάθος (π.χ. χάρτης χωρίς σχήμα, που δείχνει **άλλο μέρος**).
 */
jest.mock('@/components/search-results/ResultsMap', () => ({
  ResultsMap: ({ listings }: { listings: readonly { id: string }[] }) => (
    <div data-testid="results-map" data-count={listings.length} data-ids={listings.map((l) => l.id).join(',')} />
  ),
}));

const mockLookup = { value: { state: 'loading' } as PublicListingLookup };
jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  usePublicListing: () => mockLookup.value,
}));

const AT = '2026-08-10T10:00:00.000Z';

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_a0000001',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    // 🔑 **Απαιτείται από το σχήμα από την έκδοση 8** (ADR-841 §7 Α17): κάθε έγγραφο που
    //    διαβάζεται περνά από τον **κρίκο 8**, άρα ο πίνακας υπάρχει πάντα. Κενός εδώ =
    //    «καμία δηλωμένη κάτοψη», που είναι και η σιωπή αυτής της σουίτας.
    floorplans: [],
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    floor: 1,
    bedrooms: 3,
    // ✅ **ADR-842 Φ3** — τα 23 χαρακτηριστικά, **όλα δηλωμένα**. Το fixture είναι
    //    «πλήρης αγγελία» επίτηδες: η Ο3 μηδενίζει ρητά ό,τι θέλει να λείπει, ώστε
    //    «καμία απουσία» να παραμείνει **ελέγξιμος** ισχυρισμός και όχι ευχή.
    energyClass: 'B',
    condition: 'good',
    renovationYear: 2015,
    bathrooms: 1,
    wc: 1,
    totalRooms: 4,
    // ADR-842 Φ5 · §8 #7 — το μόνο πεδίο με **προέλευση** (`SourcedAttribute`).
    levels: { provenance: 'declared', value: 1, at: '2026-09-02T00:00:00.000Z' },
    balconies: 2,
    netAreaSqm: 80,
    balconyAreaSqm: 10,
    terraceAreaSqm: 5,
    gardenAreaSqm: 0,
    heatingType: 'autonomous',
    heatingFuel: 'natural-gas',
    coolingType: 'split-units',
    waterHeating: 'solar',
    windowFrames: 'aluminum',
    glazing: 'double',
    flooring: ['tiles'],
    orientations: ['north'],
    interiorFeatures: ['fireplace'],
    securityFeatures: ['alarm'],
    amenities: ['elevator'],
    title: 'Διαμέρισμα στην Εγνατία',
    // 🔴 **ΤΑ ΤΕΣΣΕΡΑ ΠΟΥ ΕΛΕΙΠΑΝ** (ADR-841 Α13, 2026-09-01). Ο τύπος τα δηλώνει
    //    **υποχρεωτικά** — το fixture τα παρέλειπε, και κανείς δεν το είδε επειδή
    //    ο πράκτορας δεν τρέχει `tsc` (N.17). Χωρίς αυτά, η **νέα** γραμμή προέλευσης
    //    θα διάβαζε `authorship: undefined`, θα έπεφτε στον τελευταίο κλάδο και η
    //    άγκυρα θα ήταν **πράσινη σε λάθος οθόνη** — το ακριβές σχήμα της Α2.10.
    place: null,
    authorship: 'agency',
    agencyName: 'ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α.Ε.',
    agencyId: 'comp_a0000001',
    // 🔑 **ΠΑΡΑΓΟΜΕΝΟ, όχι γραμμένο** (ADR-838): αν το fixture έγραφε τις γραμμές στο
    //    χέρι, θα ήταν **δεύτερη ελλιπής λίστα** δίπλα στον πίνακα — ακριβώς το
    //    σχήμα «δύο λίστες που επιβεβαιώνουν η μία την άλλη» που η Φ3 πλήρωσε (§18.7).
    legality: legalitySignalsFor([], ['sell'], [{ propertyId: 'prop_a0000001', spaceId: null }], AT, LEGALITY_CLAIM_KINDS),
    projectedAt: AT,
    ...over,
  };
}

function located(over: Partial<PublicListing> = {}): PublicListing {
  return listing({
    position: {
      kind: 'known',
      provenance: 'geocoded',
      point: { lat: 40.64, lng: 22.94 },
      locatedAt: AT,
      accuracy: 'center',
    },
    ...over,
  });
}

function renderWith(lookup: PublicListingLookup, query = '') {
  mockLookup.value = lookup;
  mockSearchParams.value = query;
  return render(<ListingDetailContent id="prop_a0000001" />);
}

beforeEach(() => {
  mockLookup.value = { state: 'loading' };
  mockSearchParams.value = '';
});

// ============================================================================
// Ο1 — ΟΙ ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΕΧΟΥΝ Η ΚΑΘΕΜΙΑ ΤΗ ΔΙΚΗ ΤΗΣ ΦΩΝΗ
// ============================================================================

describe('Ο1 — κάθε κατάσταση λέει το δικό της', () => {
  it('φόρτωση', () => {
    renderWith({ state: 'loading' });
    expect(screen.getByText('search-results:detail.loading')).toBeInTheDocument();
  });

  it('«δεν δημοσιεύεται πια» ΔΕΝ είναι σφάλμα — άλλο κείμενο, άλλη θεραπεία', () => {
    renderWith({ state: 'absent' });
    expect(screen.getByText('search-results:detail.absent.title')).toBeInTheDocument();
    expect(screen.getByText('search-results:detail.absent.body')).toBeInTheDocument();
    expect(screen.queryByText('search-results:detail.error.title')).not.toBeInTheDocument();
  });

  it('σφάλμα ανάγνωσης ΔΕΝ είναι απουσία', () => {
    renderWith({ state: 'error', message: 'permission-denied' });
    expect(screen.getByText('search-results:detail.error.title')).toBeInTheDocument();
    expect(screen.queryByText('search-results:detail.absent.title')).not.toBeInTheDocument();
  });

  it('και οι δύο αστοχίες δίνουν δρόμο επιστροφής', () => {
    renderWith({ state: 'absent' });
    expect(screen.getByText('search-results:detail.back')).toHaveAttribute('href', '/search/results');
  });
});

// ============================================================================
// Ο2 — ΤΑ ΦΙΛΤΡΑ ΤΑΞΙΔΕΥΟΥΝ ΠΙΣΩ (Α3: 75% των αποτυχιών ήταν εδώ)
// ============================================================================

describe('Ο2 — ο σύνδεσμος επιστροφής κρατά την αναζήτηση', () => {
  it('κρατά τα αναγνωρίσιμα φίλτρα', () => {
    // ⚠️ Ο σύνδεσμος εισόδου λέει `beds=2` — **παλιό όνομα**, που εξακολουθεί να
    //    διαβάζεται. Ο σύνδεσμος επιστροφής γράφει το **κανονικό** (`bedsmin`): η
    //    διεύθυνση ΚΑΝΟΝΙΚΟΠΟΙΕΙΤΑΙ, δεν αντιγράφεται — δες το επόμενο test.
    renderWith({ state: 'found', listing: listing() }, 'offer=sell&beds=2');
    const back = screen.getAllByText('search-results:detail.back')[0];
    expect(back.getAttribute('href')).toContain('offer=sell');
    expect(back.getAttribute('href')).toContain('bedsmin=2');
  });

  it('🔴 πετά τα σκουπίδια — η διεύθυνση ΚΑΝΟΝΙΚΟΠΟΙΕΙΤΑΙ, δεν αντιγράφεται', () => {
    renderWith({ state: 'found', listing: listing() }, 'offer=sell&κάτι=άσχετο&lat=40');
    const href = screen.getAllByText('search-results:detail.back')[0].getAttribute('href') ?? '';
    expect(href).toContain('offer=sell');
    expect(href).not.toContain('άσχετο');
    // `lat` χωρίς `lng` δεν είναι μισό φίλτρο — είναι σημείο στον Ατλαντικό.
    expect(href).not.toContain('lat=');
  });
});

// ============================================================================
// Ο3 — Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ ΠΕΔΙΩΝ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ
// ============================================================================

describe('Ο3 — κανένα στοιχείο δεν σιωπά', () => {
  /**
   * 🔴 **ΓΡΑΜΜΕΝΟΣ ΣΤΟ ΧΕΡΙ, ΕΠΙΤΗΔΕΣ — ΔΕΥΤΕΡΗ ΦΩΝΗ** (ADR-587 §6.1). Αν ο αριθμός
   * παραγόταν από τους ίδιους καταλόγους που διαβάζει η οθόνη, η άγκυρα θα
   * επιβεβαίωνε τον εαυτό της. Έτσι, η μέρα που η οθόνη 3 μεγαλώνει είναι μέρα που
   * **κάποιος το βλέπει** — όπως όταν πήγε από 4 σε 27 (ADR-842 Φ3).
   */
  const TOTAL_ELEMENTS = 27;

  it('κάθε στοιχείο έχει ετικέτα, ακόμη κι όταν λείπει', () => {
    renderWith({ state: 'found', listing: listing({ areaSqm: null, floor: null, bedrooms: null }) });
    for (const key of ['type', 'areaSqm', 'floor', 'bedrooms', 'energyClass', 'amenities']) {
      expect(screen.getByText(`listing-detail:attributes.label.${key}`)).toBeInTheDocument();
    }
    // Τρία λείπουν ⇒ τρεις ονομασμένες απουσίες. Ποτέ σιωπή.
    expect(screen.getAllByText('listing-detail:attributes.undeclared')).toHaveLength(3);
  });

  it('🔴 τα κενά ΥΠΑΡΧΟΥΝ στο έγγραφο, απλώς δεν είναι ανοιχτά (2 επίπεδα, NN/g)', () => {
    renderWith({ state: 'found', listing: listing({ areaSqm: null }) });
    // Η ενέργεια αποκάλυψης **μετρά** — δεν λέει «Περισσότερα» (information scent).
    expect(
      screen.getByText('listing-detail:attributes.reveal::{"count":1}')
    ).toBeInTheDocument();
    // Και η ονομασμένη απουσία είναι ήδη στο DOM, πίσω από `hidden`.
    expect(screen.getByText('listing-detail:attributes.undeclared')).toBeInTheDocument();
  });

  it('η λογιστική τυπώνεται με τους πραγματικούς αριθμούς', () => {
    renderWith({ state: 'found', listing: listing({ areaSqm: null, floor: null, bedrooms: null }) });
    expect(
      screen.getByText(
        `listing-detail:attributes.ledger::{"declared":${TOTAL_ELEMENTS - 3},"total":${TOTAL_ELEMENTS}}`
      )
    ).toBeInTheDocument();
  });

  it('πλήρης αγγελία ⇒ καμία απουσία, και η λογιστική το λέει', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(screen.queryByText('listing-detail:attributes.undeclared')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        `listing-detail:attributes.ledger::{"declared":${TOTAL_ELEMENTS},"total":${TOTAL_ELEMENTS}}`
      )
    ).toBeInTheDocument();
  });

  /**
   * 🏆 **Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ, ΣΤΗΝ ΟΘΟΝΗ** (ADR-842 Φ3): ένα σύνολο δηλωμένο **άδειο**
   * λέει «δηλώθηκε ότι δεν υπάρχουν» — **γεγονός**, όχι κενό. Σε Zillow · idealista
   * αυτό και το «δεν ρωτήθηκε» καταλήγουν στην ίδια σιωπή.
   */
  it('σύνολο δηλωμένο άδειο ζωγραφίζει ΑΛΛΟ κείμενο από το μη δηλωμένο', () => {
    renderWith({ state: 'found', listing: listing({ amenities: [] }) });
    expect(
      screen.getByText('listing-detail:attributes.declaredNone')
    ).toBeInTheDocument();
    expect(screen.queryByText('listing-detail:attributes.undeclared')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Ο4 — Η ΤΙΜΗ ΕΧΕΙ ΡΟΛΟ (Α21)
// ============================================================================

describe('Ο4 — κάθε ποσό λέει τι είναι', () => {
  it('προς πώληση ⇒ ζητούμενη τιμή', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(screen.getByText('search-results:detail.price.role.asking')).toBeInTheDocument();
  });

  it('🔴 πωλημένο ⇒ ΔΥΟ ποσά με ΔΥΟ διαφορετικούς ρόλους', () => {
    renderWith({
      state: 'found',
      listing: listing({
        commercialStatus: 'sold',
        commercial: { askingPrice: 200000, finalPrice: 185000, rentPrice: null, nightlyRate: null },
      }),
    });
    expect(screen.getByText('search-results:detail.price.role.final')).toBeInTheDocument();
    expect(screen.getByText('search-results:detail.price.role.asking')).toBeInTheDocument();
  });

  it('χωρίς τιμή ⇒ ονομασμένη αιτία, ποτέ «0 €»', () => {
    renderWith({
      state: 'found',
      listing: listing({ commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null } }),
    });
    expect(
      screen.getByText('search-results:listing.priceMissing.salePriceMissing')
    ).toBeInTheDocument();
  });
});

// ============================================================================
// Ο5 — Η ΘΕΣΗ: ΧΑΡΤΗΣ ΜΟΝΟ ΟΤΑΝ ΥΠΑΡΧΕΙ ΣΧΗΜΑ
// ============================================================================

describe('Ο5 — ο χάρτης δεν προσποιείται', () => {
  it('🔴 χωρίς θέση ⇒ ΚΑΝΕΝΑΣ χάρτης, και η αιτία γραμμένη', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(screen.queryByTestId('results-map')).not.toBeInTheDocument();
    expect(screen.getByText('search-results:detail.position.unknown')).toBeInTheDocument();
    expect(screen.getByText('search-results:unmapped.reason.neverAsked')).toBeInTheDocument();
  });

  it('με θέση ⇒ χάρτης με ΑΥΤΗ την αγγελία, ακρίβεια και προέλευση σε λέξεις', () => {
    renderWith({ state: 'found', listing: located() });
    const map = screen.getByTestId('results-map');
    expect(map).toHaveAttribute('data-count', '1');
    expect(map).toHaveAttribute('data-ids', 'prop_a0000001');
    // `accuracy: 'center'` ⇒ ΠΟΤΕ πινέζα: σκιάζεται η πόλη (Α5).
    expect(screen.getByText('search-results:map.shape.shadedCity')).toBeInTheDocument();
    expect(screen.getByText('search-results:detail.position.meaning.shadedCity')).toBeInTheDocument();
    expect(
      screen.getByText('search-results:detail.position.provenance.geocoded')
    ).toBeInTheDocument();
  });
});

// ============================================================================
// Ο6 — ΤΑ ΔΗΛΩΜΕΝΑ ΚΕΝΑ ΚΑΙ Η ΠΡΟΕΛΕΥΣΗ ΤΗΣ ΠΡΟΒΟΛΗΣ
// ============================================================================

describe('Ο6 — ό,τι δεν δημοσιεύουμε, το λέμε', () => {
  it('τα δύο θέματα που ΜΕΝΟΥΝ ανοιχτά εμφανίζονται — η νομιμότητα ΟΧΙ πια', () => {
    // 🔴 Η ΑΓΚΥΡΑ ΕΛΕΓΕ «και τα ΤΡΙΑ θέματα… με τη νομιμότητα ΠΡΩΤΗ». Το ADR-838 την
    //    έκανε δεδομένο, οπότε η γραμμή έφυγε — και το `queryByText` από κάτω κρατά τη
    //    διαφορά **ορατή**: επαναφορά της θα σήμαινε ότι η σελίδα ξαναδηλώνει κενό που
    //    έχει ήδη κλείσει, ενώ από δίπλα δείχνει το περιεχόμενό του.
    renderWith({ state: 'found', listing: listing() });
    for (const subject of ['floorplan', 'dossier']) {
      expect(screen.getByText(`search-results:detail.open.${subject}`)).toBeInTheDocument();
    }
    expect(screen.queryByText('search-results:detail.open.legality')).not.toBeInTheDocument();
  });

  it('🔴 η ΝΟΜΙΜΟΤΗΤΑ είναι πλέον ΔΕΔΟΜΕΝΟ — με βαθμίδα, πηγή, και «δεν δηλώθηκε» με όνομα', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(screen.getByText('legality:heading')).toBeInTheDocument();
    // Το fixture δεν κουβαλά αξιώσεις ⇒ ο γραφέας γράφει γραμμές `undeclared`/
    // `not-applicable`. Και τα δύο ΕΧΟΥΝ κείμενο: η σιωπή θα διαβαζόταν «δεν έχει».
    expect(screen.getAllByText('legality:state.undeclared').length).toBeGreaterThan(0);
    expect(screen.getByText('legality:disclaimer')).toBeInTheDocument();
  });

  it('⛔ καμία εικόνα ⇒ ονομασμένη απουσία, ΠΟΤΕ ξένο placeholder', () => {
    const { container } = renderWith({ state: 'found', listing: listing() });
    expect(screen.getByText('search-results:detail.media.absent')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('η στιγμή ανακατασκευής της προβολής τυπώνεται (κανόνας 18)', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(
      screen.getByText(/search-results:detail\.provenance\.projectedAt/)
    ).toBeInTheDocument();
  });

  it('ο τίτλος είναι κείμενο του κατόχου — ΟΧΙ κλειδί i18n', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(screen.getByRole('heading', { level: 1, name: 'Διαμέρισμα στην Εγνατία' })).toBeInTheDocument();
  });
});

// ============================================================================
// Ο9 — Η ΥΠΟΓΡΑΦΗ ΣΤΗΝ ΟΘΟΝΗ ΤΗΣ ΑΠΟΦΑΣΗΣ (ADR-841 Α13 · κλείνει το Ο-9)
// ============================================================================

/**
 * 🔴 **Νομική άγκυρα, όχι αισθητική.** Το **ΔΕΕ C-146/16** *(Α1.5)* ζητά την ταυτότητα
 * του εμπόρου *«απλά και γρήγορα»*. Μέχρι σήμερα η **κάρτα** το έλεγε και **αυτή** η
 * σελίδα όχι.
 *
 * ⚠️ **ΚΑΙ ΟΙ ΤΡΕΙΣ ΦΩΝΕΣ, ΟΧΙ ΔΕΙΓΜΑ**: ο παρονομαστής είναι το
 * `ListingAuthorshipVoice`. Δοκιμή **μιας** κατάστασης θα άφηνε τις άλλες δύο να
 * σβήσουν αθόρυβα — και η μία από αυτές *(«γραφείο χωρίς επωνυμία»)* είναι ακριβώς
 * εκείνη που, αν σπάσει, τυπώνει κενό «Από γραφείο: ».
 */
describe('Ο9 — η σελίδα λέει ΠΟΙΟΣ δημοσίευσε', () => {
  it('γραφείο ΜΕ επωνυμία ⇒ η επωνυμία ταξιδεύει ως παράμετρος', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(
      screen.getByText(/search-results:listing\.authorship\.agency::/)
    ).toBeInTheDocument();
    expect(screen.getByText(/ΠΑΓΩΝΗΣ Ενεργειακή Κατασκευαστική Α\.Ε\./)).toBeInTheDocument();
  });

  it('🔴 γραφείο ΧΩΡΙΣ επωνυμία ⇒ ΑΛΛΗ πρόταση, ΠΟΤΕ κενό «Από γραφείο: »', () => {
    renderWith({ state: 'found', listing: listing({ agencyName: null }) });
    expect(
      screen.getByText('search-results:listing.authorship.agencyAnonymous')
    ).toBeInTheDocument();
    // Ο παρονομαστής: η **ονομαστική** εκδοχή ΔΕΝ ζωγραφίζεται εδώ.
    expect(
      screen.queryByText(/search-results:listing\.authorship\.agency::/)
    ).not.toBeInTheDocument();
  });

  it('δήλωση ιδιοκτήτη ⇒ ούτε επωνυμία, ούτε «γραφείο»', () => {
    renderWith({
      state: 'found',
      listing: listing({ authorship: 'owner-declared', agencyName: null, agencyId: null }),
    });
    expect(
      screen.getByText('search-results:listing.authorship.ownerDeclared')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('search-results:listing.authorship.agencyAnonymous')
    ).not.toBeInTheDocument();
  });

  /**
   * 🔴 **Η ΘΕΣΗ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΑΠΟΦΑΣΗΣ, ΑΡΑ ΜΕΡΟΣ ΤΗΣ ΑΓΚΥΡΑΣ** *(Α13.3)*.
   *
   * Χωρίς αυτόν τον έλεγχο, κάποιος θα μπορούσε να μετακινήσει τη γραμμή στο `aside`
   * ή στο υποσέλιδο και **και τα τρία** παραπάνω θα έμεναν **πράσινα** — ενώ στο
   * κινητό (μία στήλη) η υπογραφή θα είχε πέσει κάτω από γκαλερί και χάρτη, δηλαδή
   * ακριβώς εκεί που το *«γρήγορα»* παύει να ισχύει.
   *
   * 🔑 Και ο δεύτερος έλεγχος είναι το **δικό μας** επιχείρημα *(Α13.4)*: η προέλευση
   * **προηγείται των κενών**. «Δεν έχει δηλωθεί» χωρίς να ξέρεις ποιος δεν δήλωσε
   * είναι κατηγορία χωρίς κατηγορούμενο.
   */
  it('🔴 ΘΕΣΗ — αμέσως μετά τον τίτλο, και ΠΡΙΝ από τα κενά', () => {
    renderWith({ state: 'found', listing: listing() });

    const heading = screen.getByRole('heading', { level: 1 });
    const signature = screen.getByText(/search-results:listing\.authorship\.agency::/);
    const gaps = screen.getByText('search-results:detail.open.heading');

    expect(heading.compareDocumentPosition(signature) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(signature.compareDocumentPosition(gaps) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
