/**
 * Άγκυρα — **ΟΣΟ Η ΙΕΡΑΡΧΙΑ ΦΟΡΤΩΝΕΙ, Ο ΚΑΤΑΛΟΓΟΣ ΔΕΙΧΝΕΙ ΟΛΟΥΣ ΚΑΙ ΤΟ ΛΕΕΙ**
 *
 * ## Γιατί υπάρχει
 *
 * Το `/pro?area=…` κρίνει τη διοικητική εμβέλεια με **γενεαλογία** που ζει στο αρχείο
 * των **4,1 MB**. Όσο εκείνο δεν έχει φτάσει, το `lineageIdsOf` επιστρέφει **κενό** —
 * και με κενή γενεαλογία **κάθε** βιτρίνα απαντά `disjoint`.
 *
 * 🔴 **Η αφελής υλοποίηση λέει «Κανείς δεν ταιριάζει με αυτά τα κριτήρια» για τα πρώτα
 * ms κάθε επίσκεψης** — δηλαδή ψέμα, στην πιο κρίσιμη στιγμή: ο επισκέπτης που μόλις
 * διάλεξε περιοχή συμπεραίνει ότι *«δεν δουλεύει κανείς εκεί»* και **φεύγει**.
 * «Άγνωστο ≠ κενό» *(N.12)*.
 *
 * ⚠️ **Ο κώδικας το κάνει σωστά — αλλά καμία πύλη δεν το ρωτούσε.** Μετρημένο
 * 2026-09-08 στο ζωντανό περπάτημα *(ADR-846, Π7)*: το `areaPending` δεν αναφερόταν σε
 * κανένα test. Και τα τρία σκέλη του *(`hierarchyLoading` · `where !== null` ·
 * `isAdministrativeWhere`)* μπορούσαν να σβηστούν χωρίς να κοκκινίσει τίποτα.
 *
 * ## Τι φυλάει
 *
 * ✅ **Κ1** — όσο φορτώνει: **όλοι** ορατοί, και η αναμονή **γράφεται** στην οθόνη.
 * ✅ **Κ2** — μόλις φορτώσει: το φίλτρο **εφαρμόζεται** *(αλλιώς το Κ1 θα περνούσε και
 *    με ένα φίλτρο που δεν φιλτράρει ποτέ)*.
 * ✅ **Κ3** — η αναμονή είναι **ειδική για τον διοικητικό άξονα**: ερώτημα **σημείου**
 *    δεν περιμένει την ιεραρχία, γιατί δεν τη χρειάζεται.
 * ✅ **Κ4** *(Φ2.5)* — η **δεύτερη** πηγή αναμονής: τα **αποτυπώματα**. Ερώτημα σημείου
 *    δεν χρωστά στην ιεραρχία, χρωστά όμως σε αυτά — και η αναμονή **δηλώνεται**.
 * ✅ **Κ5** — παρονομαστής του Κ4: **χωρίς** γεωγραφικό ερώτημα δεν περιμένει τίποτα,
 *    ώστε μια καθολική «περίμενε τα πάντα» να μην μπορεί να περάσει.
 *
 * @module components/mandate/__tests__/agency-directory-area-pending
 * @see ADR-846 · `AgencyDirectoryContent`
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';

/** Η γενεαλογία γίνεται γνωστή **μόνο** όταν σταματήσει η φόρτωση — όπως στην πραγματικότητα. */
const mockHierarchy = { isLoading: true };

const mockLineage: Record<string, readonly string[]> = {
  'region:112': ['region:112'],
  'municipality:1303': ['municipality:1303', 'regionalUnit:1210', 'region:112'],
  'regionalUnit:1210': ['regionalUnit:1210', 'region:112'],
};

jest.mock('@/hooks/useAdministrativeHierarchy', () => ({
  ADMIN_LEVELS: {
    MAJOR_GEO: 1, DECENTRALIZED_ADMIN: 2, REGION: 3, REGIONAL_UNIT: 4,
    MUNICIPALITY: 5, MUNICIPAL_UNIT: 6, COMMUNITY: 7, SETTLEMENT: 8,
  },
  // Κλειδιά i18n (ADR-846 Φ4) — το mock δίνει το ΣΧΗΜΑ, όχι λέξεις: η μετάφραση δεν
  // είναι δουλειά αυτής της άγκυρας, και ωμά ελληνικά εδώ θα ξανάφερναν το χρέος N.11.
  ADMIN_LEVEL_LABEL_KEYS: {
    3: 'addresses:hierarchy.levels.region',
    4: 'addresses:hierarchy.levels.regionalUnit',
    5: 'addresses:hierarchy.levels.municipality',
    6: 'addresses:hierarchy.levels.municipalUnit',
    7: 'addresses:hierarchy.levels.community',
  },
  lineageIdsOf: (id: string): readonly string[] =>
    mockHierarchy.isLoading ? [] : (mockLineage[id] ?? []),
  useAdministrativeHierarchy: () => ({
    isLoading: mockHierarchy.isLoading,
    findById: () => undefined,
    levelOptions: () => [],
    resolvePath: () => ({}),
    getByLevel: () => [],
    searchOptions: () => [],
    getChildren: () => [],
  }),
}));

/**
 * 🔑 **Τα αποτυπώματα μοκάρονται ΦΟΡΤΩΜΕΝΑ από προεπιλογή** *(ADR-846 Φ2.5)*. Χωρίς
 * αυτό, ο πραγματικός `useAdminFootprints` θα προσπαθούσε `fetch` μέσα σε jsdom, θα
 * έμενε για πάντα «φορτώνει», και **κάθε** κριτήριο εδώ θα κοκκίνιζε για λόγο άσχετο με
 * αυτό που φυλάει. Το Κ4 το γυρίζει επίτηδες σε `true`.
 */
const mockFootprints = { isLoading: false };

jest.mock('@/hooks/useAdminFootprints', () => ({
  useAdminFootprints: () => ({
    isLoading: mockFootprints.isLoading,
    footprintOf: () => null,
    // 🔴 **ΤΟ `entries` ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ ΑΠΟ ΤΟ §9 #12, ΚΑΙ ΤΟ ΕΜΑΘΑΜΕ ΕΔΩ.** Το
    //    `useCircleAnchorName` **σαρώνει** τον χάρτη· ένα mock χωρίς αυτό δίνει
    //    `undefined`, και το `for…of` πετά `TypeError` που ρίχνει **ολόκληρη** τη δημόσια
    //    σελίδα. Το Κ3 και το Κ4 περνούν ερώτημα-**κύκλο**, δηλαδή **εκτελούν** τη νέα
    //    διαδρομή — γι' αυτό η αλλαγή υπογραφής **κοκκίνισε** εδώ αντί να φύγει σιωπηλά.
    //    ⚠️ Ακριβώς το σχήμα της §7.1 *(η `presenceMatches` άλλαξε υπογραφή και **καμία**
    //    από τις 277 δοκιμές δεν την εκτελούσε με ενεργό ερώτημα)* — αυτή τη φορά
    //    πιάστηκε, επειδή **υπήρχε** άγκυρα που εκτελεί με `where !== null`.
    //
    // 🔑 **Κενός χάρτης, όχι γεμάτος**: η αγνωσία είναι η **προεπιλογή** αυτής της
    //    σουίτας *(`footprintOf: () => null`)*, και ο κενός χάρτης τη διατηρεί ⇒ το
    //    αγκυροβόλιο μένει `null` ⇒ η φωνή λέει το ουδέτερο κείμενο. Ό,τι κρίνεται εδώ
    //    κρίνεται **χωρίς** γεωμετρία, όπως και πριν.
    entries: new Map(),
  }),
}));

const mockSearch = { value: '' };

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch.value),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  // Ο σύνδεσμος του συνόρου χρειάζεται πραγματικό δρομολογητή· εδώ αρκεί ένα <a>.
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockAgencies = [
  showcaseFixture({
    companyId: 'comp_a',
    alias: 'alpha',
    displayName: 'Γραφείο ΑΛΦΑ',
    coverage: { adminIds: ['regionalUnit:1210'] },
  }),
  showcaseFixture({
    companyId: 'comp_b',
    alias: 'beta',
    displayName: 'Γραφείο ΒΗΤΑ',
    coverage: null,
  }),
];

jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  usePublicAgencies: () => ({ agencies: mockAgencies, loading: false, error: null }),
}));

// 🔑 **Ο επιλύτης ζει ΜΙΑ φορά** *(N.18)* — δες `lib/agency/__fixtures__/el-translate`.
//    Ήταν έτοιμος να γίνει τρίτο αντίγραφο, και το τρίτο αντίγραφο θα ήταν το μόνο που
//    ξέρει ICU plural — δηλαδή τρεις άγκυρες με **τρεις** ορισμούς του «τι βλέπει ο χρήστης».
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    i18n: { language: 'el' },
    t: jest.requireActual('@/lib/agency/__fixtures__/el-translate').elTranslate,
  }),
}));

import { AgencyDirectoryContent } from '../AgencyDirectoryContent';

import { EL_DIRECTORY as DIRECTORY } from '@/lib/agency/__fixtures__/el-translate';

function renderDirectory(
  search: string,
  hierarchyLoading: boolean,
  footprintsLoading = false,
): void {
  mockSearch.value = search;
  mockHierarchy.isLoading = hierarchyLoading;
  mockFootprints.isLoading = footprintsLoading;
  render(<AgencyDirectoryContent />);
}

/** Τα ονόματα των γραφείων που **φαίνονται** αυτή τη στιγμή. */
function visibleNames(): string[] {
  return mockAgencies
    .map((agency) => agency.displayName)
    .filter((name) => screen.queryByText(name) !== null);
}

describe('ADR-846 Π7 — αργή ιεραρχία: όλοι ορατοί, και η αναμονή δηλώνεται', () => {
  // =========================================================================
  // 🔴 Κ1 — Η ΑΓΚΥΡΑ. Χωρίς αυτήν, η οθόνη λέει «κανείς δεν ταιριάζει» — ψέμα.
  // =========================================================================
  it('Κ1 — με ερώτημα περιοχής και ιεραρχία που φορτώνει: ΚΑΙ ΟΙ ΔΥΟ ορατοί, με ειδοποίηση', () => {
    renderDirectory('area=region:112', true);

    expect(screen.getByText(DIRECTORY.areaLoading)).toBeInTheDocument();
    expect(visibleNames()).toEqual(['Γραφείο ΑΛΦΑ', 'Γραφείο ΒΗΤΑ']);
    // ⛔ Το κείμενο που ΔΕΝ επιτρέπεται να εμφανιστεί ποτέ σε αυτή τη στιγμή.
    expect(screen.queryByText(DIRECTORY.emptyAfterFilter)).not.toBeInTheDocument();
  });

  // =========================================================================
  // Κ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: όταν φορτώσει, το φίλτρο ΟΝΤΩΣ φιλτράρει. Χωρίς αυτό, ένα
  //      «δείχνε πάντα όλους» θα περνούσε το Κ1 θριαμβευτικά.
  // =========================================================================
  it('Κ2 — με φορτωμένη ιεραρχία το φίλτρο εφαρμόζεται, και η ειδοποίηση φεύγει', () => {
    renderDirectory('area=region:112', false);

    expect(screen.queryByText(DIRECTORY.areaLoading)).not.toBeInTheDocument();
    expect(visibleNames()).toEqual(['Γραφείο ΑΛΦΑ']);
  });

  // =========================================================================
  // Κ3 — Η ΑΝΑΜΟΝΗ ΕΙΝΑΙ ΣΤΟΧΕΥΜΕΝΗ. Ερώτημα σημείου δεν χρωστά τίποτα στην
  //      ιεραρχία· μια καθολική «περίμενε» θα καθυστερούσε οθόνη χωρίς λόγο.
  // =========================================================================
  it('Κ3 — ερώτημα ΣΗΜΕΙΟΥ δεν περιμένει την ιεραρχία', () => {
    renderDirectory('lat=40.5&lng=23.0&r=20', true);

    expect(screen.queryByText(DIRECTORY.areaLoading)).not.toBeInTheDocument();
  });

  // =========================================================================
  // 🔴 Κ4 (ADR-846 Φ2.5) — Η ΔΕΥΤΕΡΗ ΠΗΓΗ ΑΝΑΜΟΝΗΣ: ΤΑ ΑΠΟΤΥΠΩΜΑΤΑ.
  //
  //     Ερώτημα **σημείου** δεν χρωστά τίποτα στην ιεραρχία (Κ3) — χρωστά όμως στα
  //     αποτυπώματα, γιατί μια **διοικητική δήλωση** κρίνεται απέναντί του μόνο με
  //     γεωμετρία. ⚠️ Η απουσία τους ΔΕΝ θα έκοβε κανέναν *(δίνει `unknown`, που ο
  //     κατάλογος κρατά)*, άρα το «σωστό» δεν επιβάλλει αναμονή· την επιβάλλει το
  //     **ήθος**: μια λίστα που στενεύει μόνη της χωρίς ο επισκέπτης να αγγίξει
  //     τίποτα διαβάζεται ως σφάλμα. Την αναμονή τη **δηλώνουμε**.
  // =========================================================================
  it('Κ4 — ερώτημα ΣΗΜΕΙΟΥ περιμένει τα ΑΠΟΤΥΠΩΜΑΤΑ, και το δηλώνει', () => {
    renderDirectory('lat=40.5&lng=23.0&r=20', false, true);

    expect(screen.getByText(DIRECTORY.areaLoading)).toBeInTheDocument();
    expect(visibleNames()).toEqual(['Γραφείο ΑΛΦΑ', 'Γραφείο ΒΗΤΑ']);
    expect(screen.queryByText(DIRECTORY.emptyAfterFilter)).not.toBeInTheDocument();
  });

  // =========================================================================
  // Κ5 — ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Κ4: χωρίς ερώτημα, καμία αναμονή — ούτε για αποτυπώματα.
  //      Μια καθολική «περίμενε τα πάντα» θα καθυστερούσε **κάθε** επίσκεψη στον
  //      κατάλογο, και το Κ4 θα την είχε εγκρίνει.
  // =========================================================================
  it('Κ5 — χωρίς κανένα γεωγραφικό ερώτημα δεν περιμένει τίποτα', () => {
    renderDirectory('', true, true);

    expect(screen.queryByText(DIRECTORY.areaLoading)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 🖼️ ADR-777 §8.82 — Η ΑΚΤΙΝΑ `/pro`: ο κοινός ήρωας, με τα φίλτρα ΜΕΣΑ του.
//
//    Ζει σε αυτή τη σουίτα επίτηδες: τα mocks που αποδίδουν ολόκληρο το
//    `AgencyDirectoryContent` είναι ~100 γραμμές, και ένα δεύτερο αρχείο θα τα
//    αντέγραφε (N.18). Η σύνθεση κρίνεται εδώ· ο ίδιος ο ήρωας στο `LandingHero.test`.
// ===========================================================================
describe('ADR-777 §8.82 — η ακτίνα των επαγγελματιών', () => {
  it('Η1 — ο ήρωας είναι ΑΜΕΣΟ τέκνο του μέτρου, και ο h1 της σελίδας είναι ο δικός του', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: τύλιξε τον ήρωα σε δοχείο ⇒ το breakout σβήνει σιωπηλά.
    renderDirectory('', false);

    const measure = document.querySelector('[data-shell-measure]') as HTMLElement;
    const hero = measure.querySelector('[data-shell-span="full"]') as HTMLElement;
    expect(hero.parentElement).toBe(measure);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(hero.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  });

  it('Η2 — τα φίλτρα ειδικότητας + περιοχής ζουν ΜΕΣΑ στον ήρωα — ΕΝΑ χειριστήριο, όχι δύο', () => {
    renderDirectory('', false);

    const hero = document.querySelector('[data-shell-span="full"]') as HTMLElement;
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBeGreaterThan(0);
    for (const control of comboboxes) expect(hero.contains(control)).toBe(true);
  });
});
