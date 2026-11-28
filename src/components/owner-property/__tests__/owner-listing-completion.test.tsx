/**
 * @fileoverview ΑΓΚΥΡΑ — **ο δείκτης πληρότητας του ιδιώτη** (ADR-842 Φ5).
 * @related components/owner-property/OwnerListingCompletion.tsx · ADR-842 §6 #7
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΕ ΤΟΥΣ **ΠΡΑΓΜΑΤΙΚΟΥΣ** LOADERS ΚΑΙ ΤΟ **ΠΡΑΓΜΑΤΙΚΟ** ICU — ΤΟ ΜΑΘΗΜΑ ΤΗΣ Φ3
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα mock του `useTranslation` που επιστρέφει το κλειδί απαντά *«ποια ερωτήματα κάνει
 * η οθόνη;»* και είναι **τυφλό** στο *«τα βρίσκει ο runtime;»* — ανάμεσα στο κλειδί και
 * στο locale στέκονται το `Namespace` του `lazy-config`, το `case` του
 * `namespace-loaders` και το πρόθεμα `ns:` της κλήσης, και **κανένα δεν εκτελείται**.
 *
 * Η Φ5 κάνει ακριβώς την κίνηση που το γεννά: φέρνει το namespace **`properties`** σε
 * οθόνη που μέχρι σήμερα μιλούσε **μόνο** `property-market`. Άρα η άγκυρα **εκτελεί**
 * το wiring, όπως η `listing-attributes-runtime.test.tsx` της Φ3.
 *
 * 🔴 Και τα κείμενα ζητούν **ICU σε μονό άγκιστρο** (`{count}`): χωρίς το plugin, η
 * βαθμίδα θα ζωγραφιζόταν **ωμή**, και η άγκυρα θα ήταν πράσινη για κείμενο που ο
 * χρήστης δεν βλέπει ποτέ έτσι.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { i18n } from 'i18next';
import { I18nextProvider } from 'react-i18next';

import { createRealI18n } from '@/test-utils/real-i18n';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

import { OwnerListingCompletion } from '../OwnerListingCompletion';
import { UNDECLARED_LISTING_OBJECTIVE_VALUE } from '@/lib/objective-value/objective-value-declarations';
import { ownerCompletionSubject } from '@/lib/owner-property/owner-completion-subject';
import type { PublicListingLookup } from '@/services/realtime/hooks/public-listings-source';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return {
    useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]),
  };
});

const AT = '2026-09-02T00:00:00.000Z';
let instance: i18n;

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'ownp_φ5',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 170000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    exchange: null,
    coverImage: null,
    gallery: [],
    floorplans: [],
    type: 'apartment',
    areaSqm: 95,
    areaKind: 'gross',
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    adminArea: null,
    authorship: 'owner-declared',
    agencyName: null,
    agencyId: null,
    floor: 0,
    bedrooms: 3,
    ...UNASKED_LISTING_ATTRIBUTES,
    title: 'Διαμέρισμα 95 τ.μ.',
    legality: [],
    projectedAt: AT,
    listedAt: { kind: 'unknown', reason: 'predates-record' },
    priceReduction: null,
    objectiveValueDeclarations: UNDECLARED_LISTING_OBJECTIVE_VALUE,
    levelAreas: null,
    ...over,
  };
}

beforeAll(async () => {
  instance = await createRealI18n(['properties']);
});

/**
 * 🔑 **Το υποκείμενο περνά από την ΠΡΑΓΜΑΤΙΚΗ `ownerCompletionSubject`** (ADR-842 §7.7) — όχι
 * από χειρόγραφο σύνολο εξαιρέσεων: η άγκυρα κρίνει ό,τι βλέπει ο ιδιώτης στην οθόνη.
 * Προεπιλογή: η αγγελία είναι **δημοσιευμένη**, με τα μέσα του `over`.
 */
function renderMeter(
  over: Partial<PublicListing> = {},
  published: PublicListingLookup = { state: 'found', listing: listing(over) },
) {
  // Η προβολή του browser δεν ξέρει ΠΟΤΕ τα μέσα — τα γράφει κενά, όπως η `projectListingShape`.
  const projected = listing({ ...over, gallery: [], floorplans: [] });
  return render(
    <I18nextProvider i18n={instance}>
      <OwnerListingCompletion subject={ownerCompletionSubject(projected, published)} />
    </I18nextProvider>,
  );
}

// ============================================================================
// Δ1 — ΦΑΙΝΟΝΤΑΙ ΕΛΛΗΝΙΚΑ, ΟΧΙ ΩΜΑ ΚΛΕΙΔΙΑ
// ============================================================================

describe('Δ1 — η οθόνη μιλά ελληνικά (το wiring ΕΚΤΕΛΕΙΤΑΙ)', () => {
  it('τίτλος και ετικέτες πεδίων έρχονται από το locale', () => {
    renderMeter();
    expect(screen.getByText('Πληρότητα καταχώρησης')).toBeInTheDocument();
    expect(screen.getByText('Τι λείπει')).toBeInTheDocument();
  });

  it('🔴 κανένα ωμό κλειδί στην οθόνη', () => {
    const { container } = renderMeter();
    expect(container.textContent).not.toContain('completion.');
    expect(container.textContent).not.toContain('properties:');
    // Ωμό ICU σημαίνει «το plugin δεν φορτώθηκε» — και το κείμενο θα ήταν αδιάβαστο.
    expect(container.textContent).not.toContain('{count}');
  });

  it('η ενότητα έχει προσβάσιμη ονομασία', () => {
    renderMeter();
    expect(screen.getByRole('region', { name: 'Δείκτης πληρότητας ακινήτου' })).toBeInTheDocument();
  });
});

// ============================================================================
// Δ2 — 🔴 ΤΡΕΙΣ ΠΡΟΤΑΣΕΙΣ ΤΗ ΦΟΡΑ (ADR-842 §6 #7)
// ============================================================================

describe('Δ2 — 🔴 coaching, όχι κατηγορητήριο', () => {
  /**
   * 🔴 **Ο ΚΑΝΟΝΑΣ ΠΟΥ ΤΟ ΞΕΧΩΡΙΖΕΙ ΑΠΟ ΤΟ `PropertyCompletionBreakdown`.** Πολλές
   * γραμμές «λείπει» διαβάζονται ως κατηγορητήριο, και το μετρήσιμο αποτέλεσμα είναι
   * ότι ο άνθρωπος δεν συμπληρώνει **καμία**. Εδώ λείπουν **πέντε** *(μέσα · εμβαδόν ·
   * υπνοδωμάτια · ΠΕΑ)* και φαίνονται τρεις.
   */
  it('🔴 δείχνει ΤΟ ΠΟΛΥ τρεις προτάσεις, όσα κι αν λείπουν', () => {
    renderMeter({ areaSqm: null, bedrooms: null });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('🔑 και είναι τα ΒΑΡΥΤΕΡΑ — αυτά που μετακινούν περισσότερο τον δείκτη', () => {
    renderMeter();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    // Η μηχανή ταξινομεί κατά βάρος· τα κρίσιμα βάρους 2 έρχονται πρώτα. Η ισοπαλία
    // τους λύνεται από τη σειρά ΠΡΟΤΑΣΗΣ (ADR-842 §7.7): μέσα πρώτα — ως 2026-11-28
    // λυνόταν από τη σειρά της φόρμας, και οι φωτογραφίες δεν εμφανίζονταν ΠΟΤΕ εδώ.
    expect(items).toEqual(['Φωτογραφίες', 'Κάτοψη', 'Ενεργειακή κλάση']);
  });

  it('🔴 όταν όλα είναι πλήρη, λέει ΟΤΙ είναι πλήρη — και δεν δείχνει λίστα', () => {
    renderMeter({
      type: 'storage',
      netAreaSqm: 20,
      securityFeatures: ['alarm'],
      condition: 'good',
      gallery: [
        { url: 'a', width: 1, height: 1, altKey: 'k', sources: [] },
        { url: 'b', width: 1, height: 1, altKey: 'k', sources: [] },
      ],
      floorplans: [{ provenance: 'declared', value: { url: 'fp', width: 1, height: 1, altKey: 'k', sources: [] }, at: AT }],
    });
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('Όλα τα πεδία έχουν συμπληρωθεί')).toBeInTheDocument();
  });

  it('χωρίς δημοσιευμένη κάτοψη, η μόνη πρόταση που μένει είναι η κάτοψη', () => {
    renderMeter({
      type: 'storage',
      netAreaSqm: 20,
      securityFeatures: ['alarm'],
      condition: 'good',
      gallery: [
        { url: 'a', width: 1, height: 1, altKey: 'k', sources: [] },
        { url: 'b', width: 1, height: 1, altKey: 'k', sources: [] },
        { url: 'c', width: 1, height: 1, altKey: 'k', sources: [] },
      ],
    });
    // ⚠️ Ως 2026-11-28 η κάτοψη έλειπε **πάντα** (§8 #2) και αυτό ήταν το ταβάνι της
    //    αποθήκης. Πλέον λείπει μόνο όσο το `floorplans` είναι κενό — όπως εδώ.
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Κάτοψη']);
  });
});

// ============================================================================
// Δ3 — Η ΒΑΘΜΙΔΑ ΜΕΤΡΑΕΙ ΤΟ ΣΩΣΤΟ ΠΡΑΓΜΑ
// ============================================================================

describe('Δ3 — κάθε χρώμα λέει το δικό του νούμερο', () => {
  it('κόκκινο ⇒ μετρά τα ΚΡΙΣΙΜΑ (εκεί είναι ο πόνος)', () => {
    renderMeter({ areaSqm: null, bedrooms: null });
    // Μόνο το είδος δηλωμένο: 2 από 12 ⇒ 17%. Κρίσιμα που λείπουν = photos · floorplan ·
    // areaGross · bedrooms · energyClass. Η «κατάσταση διατήρησης» ΔΕΝ μετρά: ο ιδιώτης
    // δεν έχει πού να τη γράψει (§7.7). Το κείμενο λέει **αριθμό**, όχι «{count}».
    expect(screen.getByText(/κρίσιμα πεδία λείπουν/)).toBeInTheDocument();
    expect(screen.getByText(/^5 κρίσιμα/)).toBeInTheDocument();
  });

  it('🔴 το ποσοστό ζωγραφίζεται, και είναι αυτό της μηχανής', () => {
    renderMeter();
    // areaSqm 95 (2) + bedrooms 3 (2) + type (2) = 6 από **12** ⇒ 50%. Ο παρονομαστής
    // είναι ό,τι ΜΠΟΡΕΙ να απαντήσει ο ιδιώτης (§7.7) — ήταν 23, και έδινε 26%.
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('πράσινο ⇒ κείμενο ΧΩΡΙΣ αριθμό (δεν μένει τίποτα να μετρηθεί)', () => {
    renderMeter({
      netAreaSqm: 85,
      bathrooms: 2,
      orientations: ['northeast'],
      condition: 'good',
      energyClass: 'B',
      heatingType: 'autonomous',
      coolingType: 'split-units',
      windowFrames: 'aluminium',
      glazing: 'double',
      flooring: ['tiles'],
      interiorFeatures: ['fireplace'],
      securityFeatures: ['alarm'],
      gallery: Array.from({ length: 8 }, (_, i) => ({
        url: `p${i}`,
        width: 1,
        height: 1,
        altKey: 'k',
        sources: [],
      })),
    });
    // 10 από 12 (λείπει μόνο η κάτοψη) ⇒ 83%.
    expect(screen.getByText('83%')).toBeInTheDocument();
    expect(screen.getByText('Εξαιρετική πληρότητα')).toBeInTheDocument();
  });
});

// ============================================================================
// Δ4 — 🔴 Ο ΔΕΙΚΤΗΣ ΔΕΝ ΛΕΕΙ ΨΕΜΑΤΑ (ADR-842 §7.7)
// ============================================================================

const EIGHT_PHOTOS = Array.from({ length: 8 }, (_, i) => ({
  url: `p${i}`,
  width: 1,
  height: 1,
  altKey: 'k',
  sources: [],
}));

describe('Δ4 — 🔴 ούτε «λείπει» ό,τι δεν έχει είσοδο, ούτε «λείπουν» μέσα που δεν ξέρουμε', () => {
  it('🔴 ΔΕΝ προτείνει πεδίο που ο ιδιώτης δεν έχει πού να συμπληρώσει', () => {
    // Με φωτογραφίες και κάτοψη δημοσιευμένες μένει ΜΟΝΟ το ΠΕΑ — ποτέ «Κατάσταση διατήρησης».
    renderMeter({
      gallery: EIGHT_PHOTOS,
      floorplans: [{ provenance: 'declared', value: { url: 'fp', width: 1, height: 1, altKey: 'k', sources: [] }, at: AT }],
    });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ενεργειακή κλάση']);
    expect(screen.queryByText('Κατάσταση διατήρησης')).not.toBeInTheDocument();
  });

  it('🔴 τα μέσα έρχονται από τη ΔΗΜΟΣΙΕΥΜΕΝΗ αγγελία — δημοσιευμένες φωτογραφίες δεν «λείπουν»', () => {
    renderMeter({ energyClass: 'B', gallery: EIGHT_PHOTOS });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Κάτοψη']);
  });

  it('🔑 χωρίς δημοσιευμένη αγγελία τα μέσα είναι ΑΓΝΩΣΤΑ — δεν προτείνονται και δεν χρεώνονται', () => {
    renderMeter({}, { state: 'absent' });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Ενεργειακή κλάση']);
    // type (2) + areaGross (2) + bedrooms (2) = 6 από 8.
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('όσο η δημοσιευμένη αγγελία διαβάζεται, ο δείκτης ΔΕΝ ζωγραφίζεται', () => {
    const { container } = renderMeter({}, { state: 'loading' });
    expect(container).toBeEmptyDOMElement();
  });
});
