/**
 * @jest-environment jsdom
 *
 * @fileoverview **Ο ΔΕΣΜΟΣ `tab` ↔ `tabpanel` ΤΗΣ ΡΙΖΑΣ** — το **μηχανικό** μισό της Α4.3.
 * @related ADR-841 §7 Α4.3.6 *(η παγίδα της διάταξης)* · Α4.3.10 *(η μέτρηση)* ·
 *          Α4.3.12 *(η απόφαση)* · components/search/SearchLandingContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΣΟΥΙΤΑ ΥΠΑΡΧΕΙ, ΚΑΙ ΓΙΑΤΙ ΑΠΟΔΙΔΕΙ **ΟΛΟΚΛΗΡΗ ΤΗΝ ΟΘΟΝΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ελάττωμα της **Α4.3.10** ζούσε **ΑΝΑΜΕΣΑ** σε δύο components: ο διακόπτης έγραφε
 * `aria-controls` *(μέσω Radix)* και η βιτρίνα **δεν ήταν** πάνελ. **Καμία** από τις δύο
 * σουίτες μονάδας δεν μπορούσε να το δει — και **δεν το είδαν**, με 33/33 πράσινες:
 *
 * | Σουίτα | Τι ρωτά | Γιατί ήταν τυφλή |
 * |---|---|---|
 * | `LandingModeSwitch.test` | *«τι κουμπιά;»* | δεν υπάρχει πάνελ στο δικό της DOM |
 * | `LandingShowcase.test` | *«τι κάρτες;»* | δεν υπάρχει διακόπτης στο δικό της DOM |
 *
 * ⇒ **Ο δεσμός είναι ιδιότητα της ΣΥΝΘΕΣΗΣ**, άρα δοκιμάζεται μόνο στη σύνθεση. Είναι
 * το ίδιο μάθημα με το §4α του handoff *(«ψάξε ΚΑΙ τον γονέα»)*, από την ανάποδη:
 * εδώ **ο γονέας ήταν αυτός που δεν είχε άγκυρα**.
 *
 * ⚠️ **ΚΑΝΕΝΑ ΨΕΥΤΙΚΟ ΓΙΑ ΤΑ ΔΙΚΑ ΜΑΣ**: ψεύτικα είναι μόνο οι **πηγές δεδομένων**
 * *(Firestore, i18n, δρομολόγηση, γεωκωδικοποίηση)*. Ο διακόπτης, η βιτρίνα, το κέλυφος
 * και η σύνθεσή τους είναι **οι πραγματικοί** — αλλιώς θα επιβεβαιώναμε το ψεύτικο
 * *(§4γ του handoff)*.
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { SearchLandingContent } from '../SearchLandingContent';
import type { PublicListing } from '@/types/public-listing';
import type { PublicShowcase } from '@/types/agency-profile';

// =============================================================================
// ΤΑ ΨΕΥΤΙΚΑ — μόνο οι ΠΗΓΕΣ
// =============================================================================

const mockListingsState: {
  listings: readonly PublicListing[];
  loading: boolean;
  error: string | null;
} = { listings: [], loading: false, error: null };

const mockAgenciesState: { agencies: readonly PublicShowcase[] } = { agencies: [] };

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddressDetailed: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

/**
 * ⚠️ **`requireActual` ΚΑΙ ΟΧΙ ΣΚΕΤΟ ΨΕΥΤΙΚΟ, ΕΠΙΤΗΔΕΣ.** Το ίδιο module εξάγει και τη
 * **λογιστική** *(`computeListingLedger`)*, πάνω στην οποία κρίνεται αν η οθόνη
 * επιτρέπεται να ρωτήσει «πού;» — δηλαδή αν θα υπάρξει καθόλου διακόπτης. Ένα ολικό
 * ψεύτικο θα την έσβηνε και η σουίτα θα δοκίμαζε **δική της** αριθμητική.
 */
jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  ...jest.requireActual('@/services/realtime/hooks/usePublicListings'),
  usePublicListings: () => mockListingsState,
}));

jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  usePublicAgencies: () => mockAgenciesState,
}));

// =============================================================================
// Ο ΠΛΗΘΥΣΜΟΣ
// =============================================================================

type OfferKind = PublicListing['offerKinds'][number];

/**
 * ⚠️ **Τουλάχιστον μία με ΓΝΩΣΤΗ θέση, αλλιώς η οθόνη δεν αποδίδει διακόπτη καθόλου**:
 * η κάλυψη θα ήταν `no-location` ⇒ `coverageAnswersWhere` ψευδές ⇒ `panelMode = null`.
 * *(Πιάστηκε γράφοντας τη σουίτα: με όλες τις θέσεις άγνωστες, μηδέν `role="tab"`.)*
 */
function listing(id: string, offerKinds: readonly OfferKind[], mapped: boolean): PublicListing {
  return {
    id,
    title: `Τ-${id}`,
    gallery: [],
    floorplans: [],
    coverImage: null,
    authorship: 'owner-declared',
    commercial: { askingPrice: 100000, finalPrice: null, rentPrice: null, nightlyRate: null },
    commercialStatus: 'for-sale',
    offerKinds,
    position: mapped
      ? { kind: 'known', provenance: 'manual', point: { lat: 38, lng: 23 }, outline: null }
      : { kind: 'unknown', reason: 'owner-declined' },
    areaSqm: 90,
    floor: null,
    bedrooms: null,
    legality: [],
    agencyName: null,
    agencyId: null,
  } as unknown as PublicListing;
}

function profile(companyId: string, displayName: string): PublicShowcase {
  return { companyId, displayName, alias: companyId, credentials: [] } as unknown as PublicShowcase;
}

/** Τρεις λειτουργίες, όπως η παραγωγή σήμερα: `sell` · `leaseOut` · επαγγελματίες. */
const THREE_MODES: readonly PublicListing[] = [
  listing('a', ['sell'], true),
  listing('b', ['sell'], false),
  listing('c', ['leaseOut'], false),
];

/** Μία μόνο λειτουργία ⇒ ο διακόπτης **σιωπά** (`landingSwitchIsVisible`). */
const ONE_MODE: readonly PublicListing[] = [
  listing('a', ['sell'], true),
  listing('b', ['sell'], false),
];

const PROS = [profile('c1', 'Υδραυλικά Ρήγας'), profile('c2', 'Μελέτες Άλφα')];

function renderScreen(
  listings: readonly PublicListing[],
  agencies: readonly PublicShowcase[],
): HTMLElement {
  mockListingsState.listings = listings;
  mockListingsState.loading = false;
  mockListingsState.error = null;
  mockAgenciesState.agencies = agencies;
  return render(<SearchLandingContent />).container;
}

/** Το `id` που δηλώνει ένα κουμπί — ή `null` όταν **δεν** δηλώνει, που είναι έγκυρο. */
function controls(tab: HTMLElement): string | null {
  return tab.getAttribute('aria-controls');
}

// =============================================================================

describe('Π1 — 🔴 ΚΑΝΕΝΑΣ ΔΕΙΚΤΗΣ ΔΕΝ ΚΡΕΜΕΤΑΙ', () => {
  it('🔴 κάθε `aria-controls` που δηλώνεται ΛΥΝΕΤΑΙ σε `role="tabpanel"`', () => {
    // 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΤΗΣ Α4.3.10, ΑΥΤΟΛΕΞΕΙ**: μετρημένο ζωντανά, **3 στα 3**
    //    `resolves: false` — τρεις δείκτες προς `id` που δεν υπήρχε.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `SUPPRESS_ARIA_CONTROLS` από τον διακόπτη ⇒ τα δύο
    //    ανενεργά κουμπιά ξαναδηλώνουν δείκτη προς το πουθενά ⇒ κοκκινίζει.
    renderScreen(THREE_MODES, PROS);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    for (const tab of tabs) {
      const id = controls(tab);
      if (id === null) continue;
      expect(document.getElementById(id)).toHaveAttribute('role', 'tabpanel');
    }
  });

  it('🔴 το ΕΝΕΡΓΟ κουμπί — και ΜΟΝΟ αυτό — δηλώνει δείκτη', () => {
    // 🔴 **ΤΟ ΣΚΕΛΟΣ ΠΟΥ ΦΥΛΑΕΙ ΤΗΝ ΑΠΟΚΛΙΣΗ ΤΩΝ ΔΥΟ ΠΗΓΩΝ.** Η σελίδα δίνει την ίδια
    //    μεταβλητή στη ρίζα *(που κρίνει το `aria-selected`)* και στον διακόπτη *(που
    //    κρίνει το `aria-controls`)*. Αν κάποτε δοθούν **διαφορετικές**, ο δείκτης θα
    //    κολλούσε σε **λάθος** κουμπί — σιωπηλά, και με το πρώτο σκέλος ακόμη πράσινο.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: δώσε στον διακόπτη `value={modes[1]}` ⇒ κοκκινίζει.
    renderScreen(THREE_MODES, PROS);

    const withControls = screen.getAllByRole('tab').filter((tab) => controls(tab) !== null);

    expect(withControls).toHaveLength(1);
    expect(withControls[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('🔴 ο δεσμός είναι ΑΜΦΙΔΡΟΜΟΣ — το πάνελ ονομάζεται από ΤΟ ΙΔΙΟ κουμπί', () => {
    // ⚠️ Χωρίς αυτό, ένα πάνελ θα μπορούσε να λύνεται από το ένα tab και να
    //    **ονομάζεται** από άλλο· ο αναγνώστης οθόνης θα ανακοίνωνε λάθος λειτουργία.
    renderScreen(THREE_MODES, PROS);

    const active = screen.getAllByRole('tab').find((tab) => controls(tab) !== null) as HTMLElement;
    const panel = screen.getByRole('tabpanel');

    expect(panel.id).toBe(controls(active));
    expect(panel.getAttribute('aria-labelledby')).toBe(active.id);
  });
});

describe('Π2 — 🔴 ΤΟ ΠΑΝΕΛ ΕΙΝΑΙ Η ΒΙΤΡΙΝΑ, ΚΑΙ ΚΑΤΕΧΕΙ ΤΟ ΚΕΝΟ', () => {
  it('🔴 ΕΝΑ στοιχείο: το `tabpanel` ΕΙΝΑΙ η ενότητα που σπάει σε πλήρες πλάτος', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `asChild` από το `TabsContent` ⇒ γεννιέται δοχείο
    //    γύρω από τη βιτρίνα, το `tabpanel` παύει να είναι η ενότητα ⇒ κοκκινίζει.
    renderScreen(THREE_MODES, PROS);

    const panel = screen.getByRole('tabpanel');
    expect(panel.tagName).toBe('SECTION');
    expect(panel).toHaveAttribute('data-shell-span', 'full');
  });

  it('🔴 ΑΜΕΣΟ ΤΕΚΝΟ του μέτρου — αλλιώς το πλήρες πλάτος χάνεται ΣΙΩΠΗΛΑ', () => {
    // 🔴 **Η ΠΑΓΙΔΑ ΤΗΣ Α4.3.6, ΜΕΤΡΗΜΕΝΗ ΠΡΙΝ ΓΡΑΦΤΕΙ ΚΩΔΙΚΑΣ**: ο κανόνας του
    //    κελύφους είναι `[data-shell-measure] > [data-shell-span='full']`. Ένα δοχείο
    //    ανάμεσα δεν παράγει **κανένα** σφάλμα και **καμία** πύλη δεν το ρωτά — η
    //    βιτρίνα απλώς ξαναπέφτει στη στήλη ανάγνωσης.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: φώλιασε το `TabsContent` μέσα στην ενότητα του διακόπτη
    //    *(η «προφανής» υλοποίηση)* ⇒ κοκκινίζει.
    //
    // ⚠️ **ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ ΣΚΕΛΟΣ ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΕΡΩΤΗΜΑ**, μετρημένα: χωρίς
    //    `asChild` στη **ρίζα** το πάνελ παραμένει άμεσο τέκνο του μέτρου — αλλά το
    //    `main` αποκτά **δοχείο από πάνω**, και τότε σπάει το `flex-1` του
    //    `(light)/layout.tsx` *(ύψος, όχι πλάτος)*. Δύο διαφορετικές ζημιές, δύο
    //    ισχυρισμοί. **Η ΜΕΤΑΛΛΑΞΗ**: βγάλε το `asChild` από τα `Tabs` ⇒ κοκκινίζει
    //    **μόνο** αυτή η γραμμή.
    const container = renderScreen(THREE_MODES, PROS);

    const measure = container.querySelector('[data-shell-measure]');
    expect(screen.getByRole('tabpanel').parentElement).toBe(measure);
    expect(container.firstElementChild).toBe(measure);
  });

  it('🔴 ΜΙΑ μόνο δήλωση κατοχής του κενού σε ΟΛΗ την οθόνη', () => {
    // ⛔ **ΤΟ ΡΗΤΟ «ΜΗΝ» ΤΗΣ Α4.3.12.δ**: `data-shell-span` και στο δοχείο και στη
    //    βιτρίνα θα ήταν **δύο** δηλώσεις για το ίδιο κενό — και η εσωτερική θα ήταν
    //    σιωπηλά ανενεργή, γιατί ο επιλογέας είναι `>`. Ακριβώς ό,τι κυνηγά η CHECK 3.63.
    const container = renderScreen(THREE_MODES, PROS);

    expect(container.querySelectorAll('[data-shell-span]')).toHaveLength(1);
  });
});

describe('Π3 — 🔴 Ο ΔΕΣΜΟΣ ΑΚΟΛΟΥΘΕΙ ΤΟΝ ΑΝΘΡΩΠΟ', () => {
  it('🔴 μετά την αλλαγή λειτουργίας, ο δείκτης μετακομίζει ΜΑΖΙ με την επιλογή', () => {
    // 🔴 **ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Η ΑΡΧΙΚΗ ΑΠΟΔΟΣΗ**: η Α4.3 πέρασε **ολόκληρη** με σωστή
    //    πρώτη οθόνη και σπασμένο τον δεσμό. Ένας δεσμός που ισχύει μόνο στο πρώτο
    //    frame δεν είναι δεσμός.
    // ⚠️ `mouseDown`, ΟΧΙ `click`: το Radix ενεργοποιεί στο `onMouseDown` — ένα `click`
    //    στο jsdom **δεν** το πυροδοτεί, και η δοκιμή θα ήταν πράσινη χωρίς να έχει
    //    αλλάξει τίποτα *(η ίδια παγίδα που κόστισε στο περπάτημα με φυλλομετρητή)*.
    renderScreen(THREE_MODES, PROS);

    const before = screen.getAllByRole('tab').find((tab) => controls(tab) !== null) as HTMLElement;
    const target = screen.getAllByRole('tab').find((tab) => tab !== before) as HTMLElement;

    fireEvent.mouseDown(target, { button: 0 });

    expect(target).toHaveAttribute('aria-selected', 'true');
    expect(controls(before)).toBeNull();

    const id = controls(target);
    expect(id).not.toBeNull();
    expect(document.getElementById(id as string)).toBe(screen.getByRole('tabpanel'));
  });

  it('🔴 στους ΕΠΑΓΓΕΛΜΑΤΙΕΣ το πάνελ αλλάζει ΠΕΡΙΕΧΟΜΕΝΟ, όχι μόνο ταυτότητα', () => {
    // 🔑 **Ο δεσμός χωρίς περιεχόμενο θα ήταν πράσινο που δεν σημαίνει τίποτα** — η
    //    απορριφθείσα εκδοχή «άδεια πάνελ με `forceMount`» *(Α4.3.12.δ #2)* θα περνούσε
    //    κάθε άλλη δοκιμή αυτού του αρχείου.
    renderScreen(THREE_MODES, PROS);

    const pros = screen.getAllByRole('tab').at(-1) as HTMLElement;
    fireEvent.mouseDown(pros, { button: 0 });

    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByText('Υδραυλικά Ρήγας')).toBeInTheDocument();
    expect(within(panel).queryByText('Τ-a')).not.toBeInTheDocument();
  });
});

describe('Π4 — 🔴 ΧΩΡΙΣ ΔΙΑΚΟΠΤΗ ΔΕΝ ΥΠΑΡΧΕΙ ΠΑΝΕΛ — ΚΑΙ ΤΟ ΠΛΑΤΟΣ ΜΕΝΕΙ', () => {
  it('🔴 μία λειτουργία: μηδέν `tab`, μηδέν `tabpanel`, βιτρίνα ΠΑΝΤΑ πλήρους πλάτους', () => {
    // 🔴 **ΤΟ ΤΡΙΤΟ ΕΜΠΟΔΙΟ ΤΗΣ Α4.3.10, ΚΛΕΙΔΩΜΕΝΟ**: ένα `tabpanel` χωρίς κουμπί θα
    //    δήλωνε `aria-labelledby` προς **ανύπαρκτο** tab — το **αντίστροφο** ελάττωμα.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: τύλιξε τη βιτρίνα σε `TabsContent` **χωρίς** τη συνθήκη
    //    `panelMode === null` ⇒ κοκκινίζει.
    const container = renderScreen(ONE_MODE, []);

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();

    const measure = container.querySelector('[data-shell-measure]');
    const showcase = container.querySelector('[data-shell-span="full"]');
    expect(showcase).not.toBeNull();
    expect(showcase?.parentElement).toBe(measure);
  });
});
