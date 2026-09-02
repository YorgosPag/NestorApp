/**
 * 🔴 **Η ΑΓΚΥΡΑ ΠΟΥ ΖΩΓΡΑΦΙΖΕΙ ΤΗΝ ΟΘΟΝΗ ΜΕ ΤΟΝ ΠΡΑΓΜΑΤΙΚΟ i18n** (ADR-842 Φ3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΔΕΝ ΑΡΚΟΥΝ ΟΙ ΑΛΛΕΣ ΔΥΟ — ΚΑΙ ΤΟ ΕΧΟΥΜΕ ΠΛΗΡΩΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η οθόνη 3 φυλάγεται ήδη από ένα **ζεύγος**: το `ListingDetailContent.test.tsx`
 * λέει *«η οθόνη ζητά **αυτά** τα κλειδιά»* (με `t` που επιστρέφει το κλειδί), και η
 * **Κ7/Κ7γ** λέει *«αυτά τα κλειδιά **υπάρχουν** σε el και en»*.
 *
 * ⚠️ **Και τα δύο μαζί εξακολουθούν να μη ρωτούν το τρίτο**: *«τα **βρίσκει** ο
 * runtime;»* Ανάμεσα στο κλειδί και στο locale στέκονται τρία πράγματα που κανένα
 * από τα δύο δεν εκτελεί — το `Namespace` του `lazy-config`, το `case` του
 * `namespace-loaders`, και το πρόθεμα `ns:` της κλήσης. **Καθένα τους μπορεί να
 * λείπει με όλα τα tests πράσινα**, και το αποτέλεσμα είναι ωμό κλειδί στην οθόνη
 * του ανώνυμου επισκέπτη — η οικογένεια που το repo έχει πληρώσει τέσσερις φορές
 * (CHECK 3.34 · 3.36 · 3.51).
 *
 * 🔴 **Και η Φ3 έκανε ακριβώς την κίνηση που το γεννά**: μετακίνησε ολόκληρο το
 * `detail.attributes.*` **έξω** από εγγυημένο namespace του κελύφους (`search-results`)
 * **μέσα** σε ολοκαίνουριο, **lazy-loaded** namespace (`listing-detail`) — στη
 * **δημόσια πρώτη επαφή**. Το ADR-744 §11 έχει καταγράψει το ίδιο σχήμα ζωντανά:
 * *«το slice είχε γράψει `projects` (1/49 κλειδιά), άρα «όλα φορτωμένα», άρα ο loader
 * δεν καλούνταν ποτέ»*.
 *
 * ⇒ Εδώ **δεν υπάρχει mock του `useTranslation`**. Ο πόρος έρχεται από τον
 * **πραγματικό loader** (`getNamespaceLoader`), και η άγκυρα ρωτά αν στην οθόνη
 * φαίνονται **ελληνικά**, όχι κλειδιά.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next, I18nextProvider } from 'react-i18next';

import { getNamespaceLoader } from '@/i18n/namespace-loaders';
import { LISTING_ATTRIBUTE_GROUPS } from '@/lib/listings/listing-attribute-groups';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

import { ListingAttributeList } from '../ListingAttributeList';

const AT = '2026-09-02T10:00:00.000Z';

/**
 * ⚠️ **Ο hook του έργου δεν χρησιμοποιείται όπως είναι** — φορτώνει asynchronously και
 * κουβαλά ολόκληρη τη μηχανή bundle-registry. Εδώ αντικαθίσταται με τον **γνήσιο**
 * `useTranslation` του `react-i18next` πάνω σε instance που σπέρνεται από τους
 * **πραγματικούς loaders**: ό,τι κρίνεται είναι η **επίλυση των κλειδιών**, όχι ο
 * χρονισμός της φόρτωσης (εκείνον τον κρίνει το `use-translation-partial-bundle`).
 */
jest.mock('@/i18n/hooks/useTranslation', () => {
  const reactI18next = jest.requireActual('react-i18next');
  return {
    useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]),
  };
});

const instance = i18next.createInstance();

/** Ακίνητο με **μερικώς** δηλωμένα στοιχεία — ώστε να ζωγραφιστούν και οι τρεις όψεις. */
function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_48a7caf6',
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
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    // 🔴 **ΙΣΟΓΕΙΟ** — `0` είναι ΤΙΜΗ, και η οθόνη οφείλει να το πει «Ισόγειο».
    floor: 0,
    bedrooms: 3,
    ...UNASKED_LISTING_ATTRIBUTES,
    // Δηλωμένα: ένα enum, ένα σύνολο με τιμές, ένα σύνολο δηλωμένο **άδειο**.
    condition: 'good',
    heatingType: 'autonomous',
    interiorFeatures: ['fireplace'],
    amenities: [],
    title: 'Διαμέρισμα 95 τ.μ.',
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

beforeAll(async () => {
  // 🔑 **ΟΙ ΠΡΑΓΜΑΤΙΚΟΙ LOADERS, ΟΧΙ ΧΕΙΡΟΓΡΑΦΟΙ ΠΟΡΟΙ.** Ένα `resources: { … }`
  //    γραμμένο εδώ θα ήταν **τρίτο** αντίγραφο του locale, και η άγκυρα θα
  //    επιβεβαίωνε τον εαυτό της αντί για το wiring.
  const namespaces = ['listing-detail', 'search-results', 'properties-enums'] as const;
  const resources: Record<string, unknown> = {};

  for (const ns of namespaces) {
    const loader = getNamespaceLoader('el', ns as never);
    // ⛔ `null` εδώ σημαίνει «λείπει `case` στο `namespace-loaders`» — ακριβώς το
    //    κενό που καμία άλλη άγκυρα δεν εκτελεί.
    expect(loader).not.toBeNull();
    const mod = await loader!();
    resources[ns] = (mod as { default?: unknown }).default ?? mod;
  }

  // 🔴 **ΤΟ ICU ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΑΓΚΥΡΑΣ, ΟΧΙ ΛΕΠΤΟΜΕΡΕΙΑ ΣΤΗΣΙΜΑΤΟΣ.** Τα locale
  //    του έργου γράφονται σε **μονό άγκιστρο** ICU (`{value}` · `{count, plural, …}`)
  //    και το CHECK 3.9 το **επιβάλλει**. Ο προεπιλεγμένος interpolator του i18next
  //    θέλει `{{ }}` ⇒ χωρίς το plugin, η λογιστική και οι πληθυντικοί θα
  //    ζωγραφίζονταν **ωμοί** και η άγκυρα θα έλεγε ψέματα προς τη μία κατεύθυνση:
  //    πράσινη για κείμενο που ο χρήστης δεν βλέπει ποτέ έτσι.
  await instance
    .use(new ICU({ bindI18n: 'languageChanged', bindI18nStore: 'added removed' }))
    .use(initReactI18next)
    .init({
      lng: 'el',
      fallbackLng: 'el',
      resources: { el: resources as Record<string, Record<string, unknown>> },
      ns: [...namespaces],
      defaultNS: 'listing-detail',
      react: { useSuspense: false },
      interpolation: { escapeValue: false },
    });
});

function renderCard(over: Partial<PublicListing> = {}) {
  return render(
    <I18nextProvider i18n={instance}>
      <ListingAttributeList listing={listing(over)} />
    </I18nextProvider>
  );
}

// ============================================================================
// Ρ1 — 🔴 ΚΑΝΕΝΑ ΩΜΟ ΚΛΕΙΔΙ ΣΤΗΝ ΟΘΟΝΗ
// ============================================================================

describe('Ρ1 — η κάρτα ζωγραφίζει ελληνικά, όχι κλειδιά', () => {
  it('καμία συμβολοσειρά της οθόνης δεν μοιάζει με κλειδί i18n', () => {
    const { container } = renderCard();
    const text = container.textContent ?? '';

    expect(text.length).toBeGreaterThan(0);
    // Ένα ωμό κλειδί έχει πάντα αυτό το σχήμα: `ns:a.b` ή `a.b.c`.
    expect(text).not.toMatch(/listing-detail:|properties-enums:|search-results:/);
    expect(text).not.toMatch(/attributes\.(label|group|heading|ledger|undeclared)/);
  });

  it('η επικεφαλίδα και η λογιστική είναι μεταφρασμένες', () => {
    renderCard();
    expect(screen.getByText('Στοιχεία ακινήτου')).toBeInTheDocument();
    // 27 στοιχεία, 6 δηλωμένα: type · areaSqm · floor(0) · bedrooms · condition ·
    // heatingType, συν 2 σύνολα (`interiorFeatures` με τιμή, `amenities` **άδειο**).
    expect(screen.getByText('8 από 27 στοιχεία δηλωμένα')).toBeInTheDocument();
  });

  it('κάθε ομάδα έχει ελληνική κεφαλίδα — καμία δεν έμεινε ωμή', () => {
    renderCard();
    for (const label of [
      'Βασικά στοιχεία',
      'Ενέργεια & κατάσταση',
      'Δωμάτια & εμβαδά',
      'Συστήματα & υλικά',
      'Παροχές & χαρακτηριστικά',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Ο αριθμός των ομάδων ΕΙΝΑΙ ο κατάλογος — όχι σταθερά γραμμένη δίπλα.
    expect(LISTING_ATTRIBUTE_GROUPS).toHaveLength(5);
  });
});

// ============================================================================
// Ρ2 — ΟΙ ΤΙΜΕΣ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΟ `properties-enums`, ΟΧΙ ΑΠΟ ΔΕΥΤΕΡΟ ΜΗΤΡΩΟ
// ============================================================================

describe('Ρ2 — οι τιμές ονομάζονται από το υπάρχον λεξιλόγιο', () => {
  it('`condition: good` → «Καλή», `heatingType: autonomous` → «Αυτόνομη»', () => {
    renderCard();
    expect(screen.getByText('Καλή')).toBeInTheDocument();
    expect(screen.getByText('Αυτόνομη')).toBeInTheDocument();
  });

  it('οι τιμές συνόλου γίνονται ετικέτες — `fireplace` → «Τζάκι»', () => {
    renderCard();
    expect(screen.getByText('Τζάκι')).toBeInTheDocument();
  });

  it('🔴 `floor: 0` ζωγραφίζεται «Ισόγειο», ποτέ «Όροφος 0»', () => {
    renderCard();
    expect(screen.getByText('Ισόγειο')).toBeInTheDocument();
    expect(screen.queryByText('Όροφος 0')).not.toBeInTheDocument();
  });
});

// ============================================================================
// Ρ3 — 🏆 Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ ΩΣ ΤΡΙΤΟ ΚΕΙΜΕΝΟ
// ============================================================================

describe('Ρ3 — «δηλώθηκε ότι δεν υπάρχουν» ≠ «δεν έχει δηλωθεί»', () => {
  it('σύνολο δηλωμένο ΑΔΕΙΟ λέει ότι δηλώθηκε — δεν σιωπά', () => {
    renderCard();
    expect(screen.getByText('Δηλώθηκε ότι δεν υπάρχουν')).toBeInTheDocument();
  });

  it('η ενέργεια αποκάλυψης ΜΕΤΡΑ τα κενά, δεν λέει «Περισσότερα»', () => {
    renderCard();
    // Δωμάτια & εμβαδά: 9 στοιχεία, κανένα δηλωμένο.
    expect(screen.getByText('9 δεν έχουν δηλωθεί')).toBeInTheDocument();
    // Ενέργεια & κατάσταση: 3 στοιχεία, 1 δηλωμένο (`condition`).
    expect(screen.getByText('2 δεν έχουν δηλωθεί')).toBeInTheDocument();
  });

  it('ο ενικός του ICU δουλεύει — μία μόνο έλλειψη λέει «δεν έχει δηλωθεί»', () => {
    renderCard({ energyClass: 'B', renovationYear: 2015 });
    expect(screen.getByText('1 δεν έχει δηλωθεί')).toBeInTheDocument();
  });
});
