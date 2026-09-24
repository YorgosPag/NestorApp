/**
 * @fileoverview **ADR-846 Φ5γ — Η ΒΙΤΡΙΝΑ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ, ΚΑΙ ΣΙΩΠΑ ΟΤΑΝ ΔΕΝ ΤΗΝ ΞΕΡΕΙ.**
 * @related ADR-846 §8.8.1 (ευρήματα Β/Γ) · §8.8.3 (οι τέσσερις καταστάσεις) · §8.8.5 α
 * @module components/mandate/__tests__/agency-showcase-coverage-truth
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΑΛΛΗ ΑΓΚΥΡΑ ΔΕΝ ΤΟ ΒΛΕΠΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η δημόσια σελίδα έγραφε *«Δηλώνει: Χ»* και **από κάτω** παρέθετε ακίνητα στο **Ψ** —
 * δύο ανεξάρτητες αναγνώσεις, **καμία κοινή κρίση**, και η αντίφαση **ορατή και
 * ασχολίαστη**. Το `coverage-agreement.test.ts` κρίνει τη **συνάρτηση**· εδώ κρίνεται
 * **η οθόνη**, δηλαδή το μόνο πράγμα που βλέπει ο επισκέπτης.
 *
 * 🔑 **ΤΟ ΒΑΡΟΣ ΤΩΝ ΑΓΚΥΡΩΝ ΕΙΝΑΙ ΣΤΗ ΣΙΩΠΗ, ΟΧΙ ΣΤΗ ΦΩΝΗ.** Μία μόνο από τις τέσσερις
 * καταστάσεις μιλά *(`understated`)*· οι άλλες τρεις **οφείλουν** να σιωπούν, και η πιο
 * συχνή σήμερα είναι το `unknown` *(μετρημένο **6 ακίνητα · 0 στον χάρτη**, §8.8.5 α)*.
 * Μια υλοποίηση που «λέει πάντα κάτι» θα περνούσε την Θ1 και θα ήταν **λάθος στο 100 %
 * της σημερινής πραγματικότητας**.
 *
 * ⚠️ **Τα fixtures είναι τα ΥΠΑΡΧΟΝΤΑ** *(`showcaseFixture` · `demand-fixtures.listing`)* —
 * N.18: δεύτερο εργοστάσιο εδώ θα ήταν το δίδυμο που κυνηγά το CHECK 3.28.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';

import { AgencyProfileContent } from '../AgencyProfileContent';
import { PROFILE_KEYS } from '../agency-directory-labels';
import { SHOWCASE_KEYS } from '../agency-showcase-labels';
import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { DeclaredCoverage } from '@/types/agency-coverage';
import type { PublicShowcase } from '@/types/agency-profile';
import type { PublicListing } from '@/types/public-listing';

const ALFA = 'comp_alfa';
const AT = '2026-09-09T00:00:00.000Z';

/** Θεσσαλονίκη — το κέντρο της δήλωσης. Ίδιες συντεταγμένες με την άγκυρα της Φ5α. */
const HOME = { lat: 40.64, lng: 22.94 };
/** ~9 χλμ ανατολικά — **μέσα** στα 20 χλμ. */
const NEAR = { lat: 40.64, lng: 23.046 };
/** Κασσάνδρα Χαλκιδικής, ~75 χλμ — **αποδεδειγμένα έξω**. */
const FAR = { lat: 40.06, lng: 23.36 };

const RADIUS_20KM: DeclaredCoverage = { circle: { center: HOME, radiusKm: 20 } };

// ═════════════════════════════════════════════════════════════════════════════
// ΟΙ ΨΕΥΤΙΚΟΙ ΓΕΙΤΟΝΕΣ
// ═════════════════════════════════════════════════════════════════════════════

// 🔑 Ο επιλυτής επιστρέφει το **κλειδί αυτούσιο**: η ερώτηση εδώ είναι *«ποιο μήνυμα
//    διάλεξε η οθόνη;»*, όχι *«πώς μεταφράστηκε»* — εκείνο το φυλά η CHECK 3.8.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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

/**
 * ⚠️ **Η ιεραρχία μοκάρεται ώστε να μη ζητηθεί `fetch` μέσα σε jsdom** — ίδιο ιδίωμα με
 * το `agency-directory-area-pending`. Η γενεαλογία μένει **κενή** επίτηδες: οι δηλώσεις
 * αυτού του αρχείου είναι **κύκλοι**, όπου η απάντηση είναι εξαντλητική χωρίς αυτήν.
 */
jest.mock('@/hooks/useAdministrativeHierarchy', () => ({
  lineageIdsOf: (): readonly string[] => [],
  useAdministrativeHierarchy: () => ({
    isLoading: false,
    findById: () => undefined,
    levelOptions: () => [],
    resolvePath: () => ({}),
    getByLevel: () => [],
    searchOptions: () => [],
    getChildren: () => [],
  }),
}));

/**
 * 🔴 **Ο ΜΕΤΡΗΤΗΣ ΕΙΝΑΙ ΑΓΚΥΡΑ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ** *(Θ5)*.
 *
 * Τα αποτυπώματα είναι **713 KB** και το `useAdminFootprints` **πυροδοτεί τη λήψη με το
 * που προσαρτηθεί** *(`useLazySnapshot` → `useEffect` → `source.load()`)*. Χωρίς τον όρο
 * *«υπάρχει τι να κριθεί»*, **κάθε** δημόσια βιτρίνα — και οι περισσότερες σήμερα δεν
 * έχουν καμία αγγελία — θα τα κατέβαζε για ερώτηση **χωρίς υποκείμενο**.
 */
const footprintMounts = { count: 0 };

jest.mock('@/hooks/useAdminFootprints', () => ({
  useAdminFootprints: () => {
    footprintMounts.count += 1;
    return {
      isLoading: false,
      footprintOf: () => null,
      // ⚠️ **Πλήρες σχήμα, ακόμη κι όταν αυτή η σουίτα δεν σαρώνει** *(§9 #12)*: mock που
      //    υπο-δηλώνει τη διεπαφή είναι **παγίδα με ημερομηνία** — δουλεύει μέχρι ο πρώτος
      //    καταναλωτής να ζητήσει το πεδίο που λείπει, και τότε σπάει **αλλού**.
      entries: new Map(),
    };
  },
}));

const PROFILE_REF: { current: PublicShowcase } = { current: showcaseFixture() };

jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  usePublicAgency: () => ({ state: 'found', showcase: PROFILE_REF.current }),
  agencyDoorFor: (companyId: string | null) =>
    companyId === null || companyId.trim() === ''
      ? { kind: 'absent' }
      : { kind: 'ask', companyId: companyId.trim() },
}));

const LISTINGS_REF: {
  current: { listings: readonly PublicListing[]; loading: boolean; error: string | null };
} = { current: { listings: [], loading: false, error: null } };

jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  usePublicAgencyListings: () => LISTINGS_REF.current,
}));

// ═════════════════════════════════════════════════════════════════════════════
// Η ΣΚΗΝΗ
// ═════════════════════════════════════════════════════════════════════════════

function at(point: { lat: number; lng: number }, id: string): PublicListing {
  return listing({
    id,
    position: { kind: 'known', provenance: 'manual', point, locatedAt: AT },
    agencyId: ALFA,
  });
}

function unlocated(id: string): PublicListing {
  return listing({
    id,
    position: { kind: 'unknown', reason: 'never-asked' },
    agencyId: ALFA,
  });
}

function paint(coverage: DeclaredCoverage | null, listings: readonly PublicListing[]): void {
  PROFILE_REF.current = showcaseFixture({ companyId: ALFA, alias: 'alfa', coverage });
  LISTINGS_REF.current = { listings, loading: false, error: null };
  render(<AgencyProfileContent companyId={ALFA} alias="alfa" />);
}

/** Η πρόταση της Φ5γ, όπως τη ζητά η οθόνη. */
const NOTE = PROFILE_KEYS.coverageAlsoOutside;

beforeEach(() => {
  footprintMounts.count = 0;
});

// =============================================================================
// Θ — Η ΒΙΤΡΙΝΑ ΕΝΑΝΤΙΟΝ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΛΙΣΤΑΣ ΤΗΣ
// =============================================================================

describe('Θ — η βιτρίνα λέει την αλήθεια για τη δήλωση (ADR-846 Φ5γ)', () => {
  it('🔴 Θ1 — ΤΟ ΕΥΡΗΜΑ: δήλωση 20 χλμ + ακίνητο 75 χλμ μακριά ⇒ η σελίδα ΤΟ ΛΕΕΙ', () => {
    paint(RADIUS_20KM, [at(NEAR, 'prop_in'), at(FAR, 'prop_out')]);

    expect(screen.getByText(NOTE)).toBeInTheDocument();
    // Ο παρονομαστής της ίδιας οθόνης: η **δήλωση** εξακολουθεί να λέγεται.
    expect(screen.getByText(PROFILE_KEYS.coverageLabel)).toBeInTheDocument();
  });

  it('Θ2 — ΟΛΑ μέσα ⇒ σιωπή (ο έπαινος για το αναμενόμενο είναι θόρυβος)', () => {
    paint(RADIUS_20KM, [at(NEAR, 'prop_in')]);

    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('🔴 Θ3 — ΑΓΝΩΣΤΕΣ ΘΕΣΕΙΣ ⇒ σιωπή, ΚΑΙ ΕΙΝΑΙ Η ΣΗΜΕΡΙΝΗ ΠΡΑΓΜΑΤΙΚΟΤΗΤΑ', () => {
    // Μετρημένο ζωντανά: **6 ακίνητα · 0 στον χάρτη** (§8.8.5 α). Μια δημόσια πρόταση
    // χτισμένη σε **δικό μας** κενό θα κατηγορούσε τον επαγγελματία μπροστά στους
    // πελάτες του — για δικό μας λάθος.
    paint(RADIUS_20KM, [unlocated('prop_a'), unlocated('prop_b')]);

    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('🔴 Θ4 — ΚΑΜΙΑ ΔΗΛΩΣΗ ⇒ σιωπή, παρότι ο κριτής λέει «understated»', () => {
    // 🔑 Η διαφορά **ακροατηρίου**, όχι κρίσης: ο `coverageRelation` απαντά `disjoint`
    //    για κενή δήλωση, οπότε η ετυμηγορία είναι σωστά `understated` (§8.8.11 #1).
    //    Αλλά *«έχει ακίνητα εκτός αυτής της περιοχής»* δίπλα σε *«Δεν δηλώθηκε»* είναι
    //    **ασυνάρτητη πρόταση**: δεν υπάρχει «αυτή η περιοχή».
    paint(null, [at(FAR, 'prop_out')]);

    expect(screen.getByText(PROFILE_KEYS.coverageUnknown)).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('Θ5 🔑 — ΚΑΜΙΑ ΑΓΓΕΛΙΑ ⇒ σιωπή, και τα 713 KB των αποτυπωμάτων ΔΕΝ ζητούνται', () => {
    paint(RADIUS_20KM, []);

    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(footprintMounts.count).toBe(0);
  });

  it('Θ5β — ΚΑΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: με αγγελίες, τα αποτυπώματα ΟΝΤΩΣ ζητούνται', () => {
    // 🔴 Χωρίς αυτό, ένα «μην τα ζητάς ποτέ» θα άφηνε την Θ5 πράσινη και θα έσπαγε
    //    σιωπηλά **κάθε διοικητική δήλωση** — που είναι ο κύριος μηχανισμός της Φάσης 1.
    paint(RADIUS_20KM, [at(FAR, 'prop_out')]);

    expect(footprintMounts.count).toBeGreaterThan(0);
  });

  it('⛔ Θ6 — ΠΟΤΕ ΤΟ ΙΔΙΩΤΙΚΟ ΚΕΙΜΕΝΟ: ο αριθμός «N από τα M» ΔΕΝ βγαίνει δημόσια', () => {
    // Ο αριθμός ανήκει στον **ίδιο** τον επαγγελματία, στον επιλογέα (Φ5β), όπου είναι
    // πράξη ελέγχου. Δημόσια διαβάζεται ως **κατηγορία** — για κάτι που είναι συχνά
    // απολύτως νόμιμο (αποσύρεται από περιοχή ξεπουλώντας απόθεμα, §8.8.7).
    paint(RADIUS_20KM, [at(NEAR, 'prop_in'), at(FAR, 'prop_out')]);

    expect(screen.queryByText(SHOWCASE_KEYS.coverageAgreementOutside)).not.toBeInTheDocument();
    expect(screen.queryByText(SHOWCASE_KEYS.coverageAgreementConsequence)).not.toBeInTheDocument();
    expect(screen.queryByText(SHOWCASE_KEYS.coverageAgreementUnknown)).not.toBeInTheDocument();
  });

  it('Θ7 — «όλη η Ελλάδα» καλύπτει τα πάντα ⇒ σιωπή, χωρίς καμία γεωμετρία', () => {
    paint({ nationwide: true }, [at(FAR, 'prop_out'), at(NEAR, 'prop_in')]);

    expect(screen.getByText(PROFILE_KEYS.coverageNationwide)).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });

  it('🔴 Θ8 — Η ΜΙΑ ΑΝΑΓΝΩΣΗ ΤΡΕΦΕΙ ΚΑΙ ΤΑ ΔΥΟ: η γραμμή και η λίστα λένε το ΙΔΙΟ', () => {
    // 🔑 Δεύτερο `usePublicAgencyListings` στην ίδια σελίδα θα ήταν δεύτερο `onSnapshot`
    //    για ίδιο ερώτημα — δύο συνδρομές που μπορούν να **αποκλίνουν** μεταξύ καρέ.
    //    Εδώ η ίδια αγγελία **φαίνεται** στη λίστα και **κρίνεται** στη γραμμή.
    const outside = at(FAR, 'prop_out');
    paint(RADIUS_20KM, [outside]);

    expect(screen.getByText(outside.title)).toBeInTheDocument();
    expect(screen.getByText(NOTE)).toBeInTheDocument();
  });
});
