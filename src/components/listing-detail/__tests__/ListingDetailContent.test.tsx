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
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    floor: 1,
    bedrooms: 3,
    title: 'Διαμέρισμα στην Εγνατία',
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
    renderWith({ state: 'found', listing: listing() }, 'offer=sell&beds=2');
    const back = screen.getAllByText('search-results:detail.back')[0];
    expect(back.getAttribute('href')).toContain('offer=sell');
    expect(back.getAttribute('href')).toContain('beds=2');
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
  it('και τα τέσσερα στοιχεία έχουν ετικέτα, ακόμη κι όταν λείπουν', () => {
    renderWith({ state: 'found', listing: listing({ areaSqm: null, floor: null, bedrooms: null }) });
    for (const key of ['type', 'areaSqm', 'floor', 'bedrooms']) {
      expect(screen.getByText(`search-results:detail.attributes.label.${key}`)).toBeInTheDocument();
    }
    // Τρία λείπουν ⇒ τρεις ονομασμένες απουσίες. Ποτέ σιωπή.
    expect(screen.getAllByText('search-results:detail.attributes.undeclared')).toHaveLength(3);
  });

  it('η λογιστική τυπώνεται με τους πραγματικούς αριθμούς', () => {
    renderWith({ state: 'found', listing: listing({ areaSqm: null, floor: null, bedrooms: null }) });
    expect(
      screen.getByText('search-results:detail.attributes.ledger::{"declared":1,"total":4}')
    ).toBeInTheDocument();
  });

  it('πλήρης αγγελία ⇒ καμία απουσία, και η λογιστική το λέει', () => {
    renderWith({ state: 'found', listing: listing() });
    expect(screen.queryByText('search-results:detail.attributes.undeclared')).not.toBeInTheDocument();
    expect(
      screen.getByText('search-results:detail.attributes.ledger::{"declared":4,"total":4}')
    ).toBeInTheDocument();
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
      screen.getByText('search-results:card.priceMissing.salePriceMissing')
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
