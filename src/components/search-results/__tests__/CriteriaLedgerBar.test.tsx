/**
 * 🔴 **Η ΤΡΙΤΗ ΔΙΑΜΕΡΙΣΗ — ΚΑΙ ΤΟ ΣΥΝΟΛΟ ΠΑΝΩ ΣΤΟ ΟΠΟΙΟ ΜΕΤΡΙΕΤΑΙ** (ADR-777 §8.51).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΥΠΑΡΧΕΙ ΓΙΑ ΝΑ ΠΙΑΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η `computeListingCriteriaLedger` δέχεται **οποιοδήποτε** σύνολο. Περασμένο το
 * φιλτραρισμένο `visible`, δίνει `excluded === 0` **πάντα** — και η γραμμή θα έγραφε
 * *«8 ταιριάζουν · 0 δεν ταιριάζουν»* σε **κάθε** αναζήτηση, για πάντα, χωρίς καμία
 * πύλη να παραπονεθεί. Είναι το σχήμα *«`0` σημαίνει κανείς δεν κοίταξε»* που το repo
 * έχει πληρώσει τέσσερις φορές, σε πέμπτη μορφή.
 *
 * 🔑 Η Α ενότητα **αποδεικνύει** ότι το λάθος σύνολο δίνει ψεύτικο μηδέν· η Β ότι το
 * σωστό κλείνει· η Γ ότι **η οθόνη περνά το σωστό**.
 */

import fs from 'fs';
import path from 'path';

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';
import {
  applyListingFilters,
  computeListingCriteriaLedger,
  EMPTY_LISTING_FILTERS,
  type ListingFilters,
} from '@/lib/listings/listing-filters';
import {
  criteriaLedgerBalances,
  type ListingCriteriaLedger,
} from '@/lib/criteria/listing-criteria-judge';
import { EMPTY_LISTING_CRITERIA, withRange } from '@/lib/criteria/listing-criteria';

import { CriteriaLedgerBar } from '../CriteriaLedgerBar';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars === undefined ? key : `${key}#${JSON.stringify(vars)}`,
  }),
}));

const AT = '2026-09-04T10:00:00.000Z';

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l1',
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
    title: 'Δοκιμή',
    ...UNASKED_LISTING_ATTRIBUTES,
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

/** Ο κατάλογος της ζωντανής επαλήθευσης: κάτι ταιριάζει, κάτι σιωπά, κάτι αποκλείεται. */
const CATALOGUE: readonly PublicListing[] = [
  listing({ id: 'ok-1', areaSqm: 80 }),
  listing({ id: 'ok-2', areaSqm: 90 }),
  listing({ id: 'silent', areaSqm: null }),
  listing({ id: 'too-big', areaSqm: 400 }),
];

/** «Έως 100 τ.μ.» — μία ερώτηση, τρεις κάδοι. */
const ASKING: ListingFilters = {
  ...EMPTY_LISTING_FILTERS,
  criteria: withRange(EMPTY_LISTING_CRITERIA, 'areaSqm', { min: null, max: 100 }),
};

// =============================================================================
// Α — 🔴 ΤΟ ΛΑΘΟΣ ΣΥΝΟΛΟ ΔΙΝΕΙ ΨΕΥΤΙΚΟ ΜΗΔΕΝ
// =============================================================================

describe('Α — γιατί ΔΕΝ μετριέται το φιλτραρισμένο σύνολο', () => {
  it('🔴 πάνω στο `visible`, το `excluded` είναι ΔΟΜΙΚΑ πάντα 0 — και είναι ψέμα', () => {
    const visible = applyListingFilters(CATALOGUE, ASKING);
    const wrong = computeListingCriteriaLedger(visible, ASKING);

    // Το `too-big` **αποκλείστηκε** — και ο λάθος αριθμός το εξαφανίζει.
    expect(wrong.excluded).toBe(0);
    // Και η λογιστική **κλείνει** μια χαρά, γι' αυτό κανένας φρουρός δεν φωνάζει.
    expect(criteriaLedgerBalances(wrong)).toBe(true);
  });
});

// =============================================================================
// Β — ΤΟ ΣΩΣΤΟ ΣΥΝΟΛΟ: ΤΡΕΙΣ ΚΑΔΟΙ, ΚΑΙ ΔΥΟ ΕΛΕΓΧΟΙ ΠΟΥ ΚΛΕΙΝΟΥΝ
// =============================================================================

describe('Β — το `withinScope`: γεωγραφία απαντημένη, κριτήρια ΟΧΙ', () => {
  const withinScope = applyListingFilters(CATALOGUE, {
    ...ASKING,
    criteria: EMPTY_LISTING_CRITERIA,
  });
  const ledger = computeListingCriteriaLedger(withinScope, ASKING);

  it('🔴 ΟΙ ΤΡΕΙΣ ΚΑΔΟΙ ΕΙΝΑΙ ΓΕΜΑΤΟΙ — «2 ταιριάζουν · 1 σιωπά · 1 αποκλείστηκε»', () => {
    expect(ledger).toEqual<ListingCriteriaLedger>({
      total: 4,
      matching: 2,
      undeclared: 1,
      excluded: 1,
    });
  });

  it('η λογιστική κλείνει στο σύνολο του `withinScope`', () => {
    expect(criteriaLedgerBalances(ledger)).toBe(true);
  });

  it('🔑 Ο ΔΕΥΤΕΡΟΣ ΕΛΕΓΧΟΣ: όσα βλέπει ο άνθρωπος = ταιριάζουν + σιωπούν', () => {
    // Η σιωπή **δεν εξαφανίζει** (κανόνας του τρίτου κάδου). Αν κάποτε αλλάξει το
    // `VERDICTS_KEEPING_THE_LISTING`, αυτή η γραμμή κοκκινίζει **αμέσως**.
    const visible = applyListingFilters(CATALOGUE, ASKING);
    expect(visible.length).toBe(ledger.matching + ledger.undeclared);
    expect(visible.map((l) => l.id)).toContain('silent');
  });
});

// =============================================================================
// Γ — 🔴 Η ΟΘΟΝΗ ΠΕΡΝΑΕΙ ΤΟ ΣΩΣΤΟ ΣΥΝΟΛΟ
// =============================================================================

/**
 * ⚠️ **Ο κώδικας ρωτιέται ΧΩΡΙΣ την αφήγησή του** — το ίδιο μάθημα με το
 * `results-layout-authority.test.ts`: ένα αρχείο που **τεκμηριώνει** τη βλάβη μέσα σε
 * σχόλιο θα γινόταν το ίδιο η βλάβη.
 */
const SCREEN = fs
  .readFileSync(path.join(__dirname, '..', 'SearchResultsContent.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('Γ — η καλωδίωση της οθόνης', () => {
  it('🔴 η λογιστική κριτηρίων μετρά το `withinScope`, ΠΟΤΕ το `visible`', () => {
    expect(SCREEN).toMatch(/computeListingCriteriaLedger\(\s*withinScope\s*,/);
    expect(SCREEN).not.toMatch(/computeListingCriteriaLedger\(\s*visible\s*,/);
  });

  it('το `withinScope` παράγεται από τον ΙΔΙΟ φιλτραριστή με κενά κριτήρια', () => {
    // Δεύτερος γεωγραφικός έλεγχος εδώ θα ήταν δεύτερη αλήθεια για «είμαι στην ακτίνα;».
    expect(SCREEN).toMatch(
      /withinScope[\s\S]{0,200}applyListingFilters\(listings,\s*\{\s*\.\.\.filters,\s*criteria:\s*EMPTY_LISTING_CRITERIA\s*\}\)/
    );
  });

  it('τα πλήθη ανά επιλογή τρέφονται από το `withinScope`, όχι από τον ωμό κατάλογο', () => {
    expect(SCREEN).toMatch(/<PrimaryFilterBar[\s\S]{0,200}listings=\{withinScope\}/);
  });
});

// =============================================================================
// Δ — Η ΓΡΑΜΜΗ: ΤΙ ΤΥΠΩΝΕΙ, ΠΟΤΕ ΣΙΩΠΑ, ΠΟΤΕ ΦΩΝΑΖΕΙ
// =============================================================================

describe('Δ — η γραμμή', () => {
  const balanced: ListingCriteriaLedger = { total: 8, matching: 4, undeclared: 3, excluded: 1 };

  it('τυπώνει και τους τρεις αριθμούς με ΕΝΑ κλειδί — καμία συναρμολόγηση προτάσεων', () => {
    render(<CriteriaLedgerBar ledger={balanced} asked />);
    expect(
      screen.getByText(/criteriaLedger\.summary.*"matching":4.*"undeclared":3.*"excluded":1/)
    ).toBeInTheDocument();
  });

  it('🔴 Η ΕΞΗΓΗΣΗ ΤΗΣ ΣΙΩΠΗΣ ΕΜΦΑΝΙΖΕΤΑΙ ΟΤΑΝ ΥΠΑΡΧΕΙ ΣΙΩΠΗ', () => {
    render(<CriteriaLedgerBar ledger={balanced} asked />);
    expect(screen.getByText(/criteriaLedger\.undeclaredHint/)).toBeInTheDocument();
  });

  it('…και ΔΕΝ εμφανίζεται όταν δεν υπάρχει — μόνιμη πρόταση = θόρυβος', () => {
    render(<CriteriaLedgerBar ledger={{ total: 5, matching: 5, undeclared: 0, excluded: 0 }} asked />);
    expect(screen.queryByText(/criteriaLedger\.undeclaredHint/)).not.toBeInTheDocument();
  });

  it('χωρίς ερώτηση ⇒ ΚΑΜΙΑ γραμμή — «κανείς δεν δήλωσε ό,τι ζήτησες» χωρίς αίτημα δεν έχει νόημα', () => {
    const { container } = render(
      <CriteriaLedgerBar ledger={{ total: 8, matching: 8, undeclared: 0, excluded: 0 }} asked={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('🔴 …ΑΛΛΑ Ο ΦΡΟΥΡΟΣ ΤΡΕΧΕΙ ΚΑΙ ΧΩΡΙΣ ΕΡΩΤΗΣΗ: λογιστική που δεν κλείνει ΦΩΝΑΖΕΙ', () => {
    // Ένα άθροισμα που δεν βγαίνει είναι **σφάλμα**, όχι κατάσταση — και δεν επιτρέπεται
    // να κρύβεται πίσω από το «δεν ρώτησε κανείς».
    render(
      <CriteriaLedgerBar ledger={{ total: 9, matching: 4, undeclared: 3, excluded: 1 }} asked={false} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('criteriaLedger.imbalanced');
  });

  it('η γραμμή είναι `output` με `aria-live` — ο αναγνώστης οθόνης μαθαίνει την αλλαγή', () => {
    const { container } = render(<CriteriaLedgerBar ledger={balanced} asked />);
    expect(container.querySelector('output[aria-live="polite"]')).not.toBeNull();
  });
});

// =============================================================================
// Ε — 🔴 Η ΕΞΟΔΟΣ ΑΠΟ ΤΟ ΑΔΙΕΞΟΔΟ, ΣΤΟ ΠΡΩΤΟ ΕΠΙΠΕΔΟ
// =============================================================================

/**
 * ⚠️ **Γεννήθηκε από ΠΑΡΑΤΗΡΗΣΗ ΣΤΗΝ ΟΘΟΝΗ, όχι από θεωρία** (2026-09-04): με
 * `?bathmin=1&bathmax=1` η οθόνη έδειχνε 2 αγγελίες, **καμία στον χάρτη**, και ο
 * «Καθαρισμός» ζούσε **μόνο μέσα** στο πάνελ — δηλαδή ο άνθρωπος έπρεπε να ξανανοίξει
 * το συρτάρι για να βγει από κατάσταση που δεν ήθελε.
 *
 * 🔑 Η άγκυρα ρωτά **τη γραμμή**, γιατί εκεί ήταν το κενό. Ο «Καθαρισμός» του πάνελ
 * υπήρχε ήδη και **δεν ήταν αρκετός**.
 */
const BAR_SOURCE = fs
  .readFileSync(path.join(__dirname, '..', 'filters', 'PrimaryFilterBar.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

describe('Ε — ο άνθρωπος μπορεί να ΒΓΕΙ χωρίς να ανοίξει το συρτάρι', () => {
  it('🔴 Η ΓΡΑΜΜΗ έχει «Καθαρισμός», όχι μόνο το πάνελ', () => {
    expect(BAR_SOURCE).toMatch(/onClick=\{commit\.clearAllCriteria\}/);
    expect(BAR_SOURCE).toMatch(/search-filters:filters\.clearAll/);
  });

  it('…και εμφανίζεται ΜΟΝΟ όταν υπάρχει τι να καθαριστεί', () => {
    // Μονίμως ορατό κουμπί που δεν κάνει τίποτα διδάσκει τον επισκέπτη να το αγνοεί —
    // ακριβώς την ημέρα που θα το χρειαστεί.
    expect(BAR_SOURCE).toMatch(/askedCount > 0 && \([\s\S]{0,400}clearAllCriteria/);
  });

  it('🔑 ο καθαρισμός ΔΕΝ αγγίζει γεωγραφία/ημερομηνίες/άτομα', () => {
    // Ο άνθρωπος ζητά να φύγουν τα ΚΡΙΤΗΡΙΑ — όχι να πεταχτεί από την περιοχή που
    // διάλεξε στον χάρτη. Ο φρουρός ζει στο `clearAllCriteria`, δες `use-filter-commit`.
    const commitSource = fs.readFileSync(
      path.join(__dirname, '..', 'filters', 'use-filter-commit.ts'),
      'utf8'
    );
    expect(commitSource).toMatch(/clearAllCriteria:\s*\(\)\s*=>\s*commitCriteria\(EMPTY_LISTING_CRITERIA\)/);
  });
});
