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
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import { getNamespaceLoader } from '@/i18n/namespace-loaders';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

import { OwnerListingCompletion } from '../OwnerListingCompletion';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return {
    useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]),
  };
});

const AT = '2026-09-02T00:00:00.000Z';
const instance = i18next.createInstance();

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'ownp_φ5',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 170000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    authorship: 'owner-declared',
    agencyName: null,
    agencyId: null,
    floor: 0,
    bedrooms: 3,
    ...UNASKED_LISTING_ATTRIBUTES,
    title: 'Διαμέρισμα 95 τ.μ.',
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

beforeAll(async () => {
  // 🔑 **Ο ΠΡΑΓΜΑΤΙΚΟΣ loader**: `null` εδώ σημαίνει «λείπει `case` στο
  //    `namespace-loaders`» — το κενό που το CHECK 3.36 ελέγχει μόνο **στατικά**.
  const loader = getNamespaceLoader('el', 'properties' as never);
  expect(loader).not.toBeNull();
  const mod = await loader!();
  const properties = (mod as { default?: unknown }).default ?? mod;

  await instance
    .use(new ICU({ bindI18n: 'languageChanged', bindI18nStore: 'added removed' }))
    .use(initReactI18next)
    .init({
      lng: 'el',
      fallbackLng: 'el',
      resources: { el: { properties } as Record<string, Record<string, unknown>> },
      ns: ['properties'],
      defaultNS: 'properties',
      react: { useSuspense: false },
      interpolation: { escapeValue: false },
    });
});

function renderMeter(over: Partial<PublicListing> = {}) {
  return render(
    <I18nextProvider i18n={instance}>
      <OwnerListingCompletion listing={listing(over)} />
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
   * 🔴 **Ο ΚΑΝΟΝΑΣ ΠΟΥ ΤΟ ΞΕΧΩΡΙΖΕΙ ΑΠΟ ΤΟ `PropertyCompletionBreakdown`.** Ο ιδιώτης
   * με άδεια αγγελία έχει **δεκατέσσερα** κενά· δεκατέσσερις γραμμές «λείπει»
   * διαβάζονται ως κατηγορητήριο, και το μετρήσιμο αποτέλεσμα είναι ότι δεν
   * συμπληρώνει **κανένα**.
   */
  it('🔴 δείχνει ΤΟ ΠΟΛΥ τρεις προτάσεις, όσα κι αν λείπουν', () => {
    renderMeter();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('🔑 και είναι τα ΒΑΡΥΤΕΡΑ — αυτά που μετακινούν περισσότερο τον δείκτη', () => {
    renderMeter();
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    // Η μηχανή ταξινομεί κατά βάρος· τα κρίσιμα βάρους 2 έρχονται πρώτα.
    expect(items).toContain('Κατάσταση διατήρησης');
    expect(items).toContain('Ενεργειακή κλάση');
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
        { url: 'c', width: 1, height: 1, altKey: 'k', sources: [] },
      ],
    });
    // ⚠️ Η κάτοψη λείπει **πάντα** (§8 #2) ⇒ η αποθήκη δεν φτάνει ποτέ στο μηδέν
    //    ελλείψεων. Άρα η γραμμή «όλα πλήρη» **δεν** εμφανίζεται, και η λίστα δείχνει
    //    ακριβώς **μία** πρόταση: την κάτοψη. Αυτό είναι η αλήθεια, όχι αστοχία.
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Κάτοψη']);
  });
});

// ============================================================================
// Δ3 — Η ΒΑΘΜΙΔΑ ΜΕΤΡΑΕΙ ΤΟ ΣΩΣΤΟ ΠΡΑΓΜΑ
// ============================================================================

describe('Δ3 — κάθε χρώμα λέει το δικό του νούμερο', () => {
  it('κόκκινο ⇒ μετρά τα ΚΡΙΣΙΜΑ (εκεί είναι ο πόνος)', () => {
    renderMeter();
    // Άδεια αγγελία διαμερίσματος: κρίσιμα που λείπουν = condition · energyClass ·
    // floorplan · photos. Το κείμενο πρέπει να λέει **αριθμό**, όχι «{count}».
    expect(screen.getByText(/κρίσιμα πεδία λείπουν/)).toBeInTheDocument();
    expect(screen.getByText(/^4 κρίσιμα/)).toBeInTheDocument();
  });

  it('🔴 το ποσοστό ζωγραφίζεται, και είναι αυτό της μηχανής', () => {
    renderMeter();
    // areaSqm 95 (2) + bedrooms 3 (2) + type (2) = 6 από 23 ⇒ 26%.
    expect(screen.getByText('26%')).toBeInTheDocument();
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
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Εξαιρετική πληρότητα')).toBeInTheDocument();
  });
});
