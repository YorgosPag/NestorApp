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
import { showcaseProfile } from './showcase-profile-fixture';
import { landingListing } from './landing-listing-fixture';

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
  // ADR-777 §8.74 — το `SavedListingsProvider` της βιτρίνας ζητά και διαδρομή.
  usePathname: () => '/',
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

// 🔑 Η ψεύτικη αγγελία ζει στο `landing-listing-fixture.ts` — κοινή με την ακτίνα `/stay`
//    (ADR-777 §8.82). Εκεί και ο λόγος για τη «μία τουλάχιστον με γνωστή θέση».
const listing = landingListing;

/**
 * 🔴 **ΤΟ ΨΕΥΤΙΚΟ ΕΙΝΑΙ ΚΟΙΝΟ, ΚΑΙ Ο ΛΟΓΟΣ ΜΕΤΡΗΘΗΚΕ** *(ADR-777 §8.67.6)*: η ίδια
 * συνάρτηση ζούσε χειρόγραφη **δύο φορές**, και όταν το σχήμα απέκτησε σήμα
 * *(ADR-841 Α21.8)* διορθώθηκε **το ένα** αντίγραφο — το άλλο έμεινε κόκκινο σιωπηλά.
 * Ολόκληρη η αλυσίδα ζει στο `showcase-profile-fixture.ts`.
 */
const profile = showcaseProfile;

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

/**
 * Η **μία** κλάση που κρίνει την κάθετη στοίχιση του μέτρου — δηλαδή τη θέση του τίτλου.
 *
 * ⚠️ **ΔΗΛΩΤΙΚΗ ΑΓΚΥΡΑ, ΚΑΙ ΤΟ ΛΕΕΙ**: το jsdom **δεν κάνει διάταξη** — κάθε
 * `getBoundingClientRect` επιστρέφει μηδενικά. Άρα εδώ **δεν** μετριούνται pixel· εδώ
 * κλειδώνεται η **δήλωση** που τα παράγει. Τα 47px του περιστατικού μετρήθηκαν σε
 * φυλλομετρητή, και εκεί μόνο μπορούν να ξαναμετρηθούν.
 */
function alignment(container: HTMLElement): string {
  const measure = container.querySelector('[data-shell-measure]') as HTMLElement;
  return Array.from(measure.classList).find((c) => c.startsWith('[align-content:')) ?? '';
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

  it('🔴 ΚΑΘΕ δήλωση κατοχής του κενού είναι ΑΜΕΣΟ τέκνο του μέτρου — καμία φωλιασμένη', () => {
    // ⛔ **ΤΟ ΡΗΤΟ «ΜΗΝ» ΤΗΣ Α4.3.12.δ**: `data-shell-span` και στο δοχείο και στη
    //    βιτρίνα θα ήταν **δύο** δηλώσεις για το ίδιο κενό — και η εσωτερική θα ήταν
    //    σιωπηλά ανενεργή, γιατί ο επιλογέας είναι `>`. Ακριβώς ό,τι κυνηγά η CHECK 3.63.
    // 🔑 **ADR-777 §8.79**: ο ισχυρισμός ήταν «ΜΙΑ δήλωση» — σωστός όσο υπήρχε ένα
    //    breakout. Ο ήρωας είναι **δεύτερο, ανεξάρτητο** breakout (αδελφό, όχι γονέας).
    //    Η πρόθεση (καμία σιωπηλά ανενεργή δήλωση) κλειδώνεται πλέον **ευθέως**.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: τύλιξε ήρωα ή βιτρίνα σε δοχείο με `data-shell-span` ⇒ κοκκινίζει.
    const container = renderScreen(THREE_MODES, PROS);

    const measure = container.querySelector('[data-shell-measure]');
    // 🔑 **ADR-820 §5.4.1**: τρίτο αδελφό breakout — οι πόρτες «Ζητώ · Προσφέρω» (`<nav>`).
    //    (Η λωρίδα «Οι χώροι μου» δεν αποδίδεται εδώ: χωρίς συνδεδεμένο θεατή.)
    const spans = Array.from(container.querySelectorAll('[data-shell-span]'));
    expect(spans).toHaveLength(3);
    for (const span of spans) expect(span.parentElement).toBe(measure);
  });

  it('🔴 οι πόρτες «Ζητώ · Προσφέρω» στοιχίζονται στον άξονα του ήρωα, όχι στο μέτρο της πρόζας', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `data-shell-span="full"` από το `<nav>` του `LandingDoors`
    //    ⇒ οι πόρτες ξαναγίνονται το μόνο στοιχείο με δικό του άξονα ⇒ κοκκινίζει.
    const container = renderScreen(THREE_MODES, PROS);

    const measure = container.querySelector('[data-shell-measure]');
    const doors = container.querySelector('nav[data-shell-span="full"]');
    expect(doors).not.toBeNull();
    expect(doors?.parentElement).toBe(measure);
    expect(doors?.querySelectorAll('li')).toHaveLength(2);
  });
});

describe('Π6 — 🔴 ΕΝΑ LCP ΣΕ ΟΛΗ ΤΗΝ ΟΘΟΝΗ (ADR-777 §8.79)', () => {
  it('🔴 ακριβώς μία `fetchpriority="high"` ΑΝΑ ΘΕΜΑ — και είναι του ήρωα, όχι της βιτρίνας', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: σβήσε το `ownsLcp={false}` στη σελίδα ⇒ η πρώτη κάρτα ξαναζητά
    //    υψηλή προτεραιότητα κάτω από το δίπλωμα ⇒ δύο ⇒ κοκκινίζει.
    // ⚠️ **Με φωτογραφίες**, αλλιώς οι κάρτες δεν έχουν `<img>` και το «ένα» είναι δωρεάν.
    const withPhotos = THREE_MODES.map((l) => ({
      ...l,
      gallery: [
        {
          url: `https://shelf/${l.id}.webp`,
          width: 1200,
          height: 900,
          altKey: 'search-results:detail.media.galleryAlt',
          sources: [],
        },
      ],
    })) as unknown as readonly PublicListing[];
    const container = renderScreen(withPhotos, PROS);
    expect(container.querySelectorAll('img').length).toBeGreaterThan(1);

    const high = Array.from(container.querySelectorAll('img')).filter(
      (img) => img.getAttribute('fetchpriority') === 'high',
    );
    // 🌗 §8.81: ο κόμβος έχει ζεύγος μέρα/γαλάζια ώρα ⇒ δύο `<img>` του ήρωα, από τα οποία
    //    το CSS αφήνει ορατό (και άρα κατεβάζει, αφού είναι lazy) **ένα** ανά θέμα.
    const inLight = high.filter((img) => !img.classList.contains('hidden'));
    const inDark = high.filter((img) => !img.classList.contains('dark:hidden'));
    expect(inLight).toHaveLength(1);
    expect(inDark).toHaveLength(1);
    for (const img of high) expect(img.closest('section')?.querySelector('h1')).not.toBeNull();
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
    // ⚠️ Ο ήρωας (§8.79) είναι κι αυτός `full` — η βιτρίνα είναι αυτή **χωρίς** τον
    //    τίτλο της σελίδας (φίλτρο σε JS: το `:has()` δεν είναι εγγυημένο στο jsdom).
    //    Οι πόρτες (ADR-820 §5.4.1) είναι `<nav>` — η βιτρίνα είναι `<section>`.
    const showcase = Array.from(container.querySelectorAll('section[data-shell-span="full"]')).find(
      (el) => el.querySelector('h1') === null,
    );
    expect(showcase).not.toBeNull();
    expect(showcase?.parentElement).toBe(measure);
  });
});

describe('Π5 — 🔴 Ο ΤΙΤΛΟΣ ΔΕΝ ΧΟΡΟΠΗΔΑ ΜΕ ΤΗΝ ΚΑΡΤΕΛΑ', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (ADR-777 §8.67, μετρημένο 2026-09-07)
  // ────────────────────────────────────────────────────────────────────────────
  //
  // Ο τίτλος «Πού ψάχνεις;» στα **192px** στην «Ενοικίαση» και στα **239px** στους
  // «Επαγγελματίες» — **47px άλμα** σε κάθε πάτημα καρτέλας. Καμία πύλη δεν το είδε,
  // και οι 33 δοκιμές αυτού του αρχείου ήταν **πράσινες**: κανείς δεν ρωτούσε *«πού
  // στέκεται η κορυφή;»*.
  //
  // Η αιτία δεν ήταν σφάλμα: με `align-content: center` η θέση του τίτλου είναι
  // **συνάρτηση του ύψους όσων ακολουθούν**, και η βιτρίνα των επαγγελματιών είναι
  // ~90px κοντύτερη *(κάρτες χωρίς φωτογραφία)*. Το γεωμετρικό κέντρο έμενε
  // **ταυτόσημο** και στις δύο — η οθόνη δούλευε ακριβώς όπως γράφτηκε.

  it('🔴 ΜΕ διακόπτη η κορυφή είναι ΚΑΡΦΩΜΕΝΗ, όχι κεντραρισμένη', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `className` του `main` στο σκέτο
    //    `[align-content:safe_center]` ⇒ κοκκινίζει.
    const container = renderScreen(THREE_MODES, PROS);

    expect(alignment(container)).toBe('[align-content:start]');
  });

  it('🔴 και ΔΕΝ αλλάζει όταν ο άνθρωπος αλλάζει λειτουργία', () => {
    // 🔑 **ΤΟ ΣΚΕΛΟΣ ΠΟΥ ΕΙΝΑΙ ΟΝΤΩΣ ΤΟ ΠΑΡΑΠΟΝΟ.** Το πρώτο σκέλος κλειδώνει *ποια*
    //    στοίχιση· αυτό κλειδώνει ότι **δεν εξαρτάται από την καρτέλα**.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε τη συνθήκη `panelMode === 'pros' ? … : …` — δηλαδή την
    //    ίδια μετακίνηση γραμμένη ανάποδα ⇒ κοκκινίζει **μόνο** αυτή η γραμμή.
    const container = renderScreen(THREE_MODES, PROS);
    const before = alignment(container);

    const pros = screen.getAllByRole('tab').at(-1) as HTMLElement;
    fireEvent.mouseDown(pros, { button: 0 });

    // Η καρτέλα όντως άλλαξε — αλλιώς το «ίδιο» παρακάτω δεν σημαίνει τίποτα.
    expect(pros).toHaveAttribute('aria-selected', 'true');
    expect(alignment(container)).toBe(before);
  });

  it('🔴 ΧΩΡΙΣ διακόπτη η κενή σελίδα ΜΕΝΕΙ κεντραρισμένη', () => {
    // ⚠️ **Η ΠΡΟΘΕΣΗ ΠΟΥ ΔΕΝ ΑΝΑΙΡΕΘΗΚΕ.** Το κεντράρισμα δεν ήταν λάθος — ήταν λάθος
    //    **εκεί όπου υπάρχει διακόπτης**. Μια πρόταση κολλημένη στην κορυφή με κενή
    //    οθόνη από κάτω δεν είναι διάταξη, είναι παράλειψη.
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: κάνε τη στοίχιση σταθερά `start` ⇒ κοκκινίζει.
    const container = renderScreen(ONE_MODE, []);

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(alignment(container)).toBe('[align-content:safe_center]');
  });
});
