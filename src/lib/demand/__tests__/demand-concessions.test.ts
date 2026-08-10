/**
 * Άγκυρες — **Η ΥΠΟΧΩΡΗΣΗ** («με +20.000 € υπάρχουν 6»), ADR-777 Α9 · SPEC-777B §12.6.
 *
 * Τέσσερις ομάδες, καθεμία για διαφορετικό λόγο:
 *
 * **Β — ΒΑΘΜΟΝΟΜΗΣΗ.** Το **γραμμένο παράδειγμα** του §12.6 αναπαράγεται από τη
 * μηχανή. Αν η πολιτική διάλεγε άλλο σκαλί, το ίδιο το SPEC θα ήταν λάθος — και δεν
 * θα το μάθαινε κανείς, γιατί κάθε σκαλί είναι **αληθές**.
 *
 * **Κ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ.** Κάθε κοντινή αγγελία καταλήγει σε ονομασμένο κάδο και
 * το άθροισμα κλείνει. Μια σύνθεση που πετάει σιωπηλά **επικυρώνει τον εαυτό της**.
 *
 * **Α — Ο ΚΑΝΟΝΑΣ ΤΟΥ ΕΝΟΣ ΑΞΟΝΑ.** Δύο εμπόδια ⇒ **καμία** πρόταση. Χωρίς αυτό, το
 * «+20.000 → 6» θα ήταν **ψευδές με ακρίβεια δύο δεκαδικών**.
 *
 * **Π — ΠΟΛΙΤΙΚΗ**, με χειρόγραφες προσδοκίες — δεύτερη φωνή πάνω στο κατώφλι.
 */

import {
  DEMAND_CONCESSIONS,
  MAX_RELATIVE_CONCESSION,
  MAX_ROOMS_CONCESSION,
  buildConcessionReport,
  buildLadder,
  concessionCeiling,
  concessionCensusBalances,
  soleConcessionOf,
  tallyBlockers,
} from '../demand-concessions';
import { matchDemand } from '../demand-matching';
import type { DemandMatch } from '../demand-match-vocabulary';
import { NO_DEMAND_FEATURES } from '@/types/property-demand';
import { TODAY, demand, facts, listing } from './demand-fixtures';

/** Μια ετυμηγορία «κοντά» φτιαγμένη στο χέρι — για να δοκιμαστεί **η πολιτική** μόνη της. */
function nearMiss(overrides: Partial<DemandMatch>): DemandMatch {
  return {
    verdict: 'near-miss',
    blockers: ['price-above'],
    gaps: {
      priceOverBy: null,
      priceUnderBy: null,
      areaShortBy: null,
      areaOverBy: null,
      bedroomsShortBy: null,
      distanceOverMetres: null,
    },
    ...overrides,
  };
}

// =============================================================================
// Β — ΒΑΘΜΟΝΟΜΗΣΗ: ΤΟ ΓΡΑΜΜΕΝΟ ΠΑΡΑΔΕΙΓΜΑ ΤΟΥ §12.6
// =============================================================================

describe('🔴 Β — «με +20.000 € υπάρχουν 6» αναπαράγεται από τη μηχανή', () => {
  /**
   * Ζήτηση με οροφή **250.000** και έξι αγγελίες πάνω από αυτήν, όπου η **έκτη**
   * είναι ακριβώς +20.000. Και μία στα +80.000, που η πολιτική **οφείλει** να
   * απορρίψει: +32% προϋπολογισμό δεν είναι υποχώρηση, είναι άλλο αίτημα.
   */
  const OVER_BY = [5_000, 8_000, 12_000, 15_000, 18_000, 20_000, 80_000];

  it('διαλέγει το +20.000 (6 αγγελίες), ΟΧΙ το +5.000 (1) ούτε το +80.000 (7)', () => {
    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } });
    const candidates = OVER_BY.map((over) =>
      facts({
        listing: listing({
          id: `prop_${over}`,
          commercial: { askingPrice: 250_000 + over, finalPrice: null, rentPrice: null },
        }),
      }),
    );

    const results = matchDemand(d, candidates, TODAY);
    const report = buildConcessionReport(
      d,
      results.nearMissed.map((outcome) => outcome.match),
    );

    const ladder = report.ladders.find((entry) => entry.concession === 'price-ceiling');
    expect(ladder).toBeDefined();
    expect(ladder?.headline).toEqual({ amount: 20_000, unlocks: 6 });
  });

  it('το κατώφλι είναι ΣΧΕΤΙΚΟ — η ίδια απόσταση απορρίπτεται σε μικρότερο προϋπολογισμό', () => {
    // 🔑 Το +20.000 είναι μικρό σε ζήτηση των 250.000 και **παράλογο** στις 60.000.
    const rich = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 250_000 } });
    const modest = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 60_000 } });

    expect(concessionCeiling(rich, 'price-ceiling')).toBe(250_000 * MAX_RELATIVE_CONCESSION);
    expect(buildLadder('price-ceiling', [20_000], concessionCeiling(rich, 'price-ceiling'))?.headline)
      .not.toBeNull();
    expect(buildLadder('price-ceiling', [20_000], concessionCeiling(modest, 'price-ceiling'))?.headline)
      .toBeNull();
  });

  it('🔑 τα ΥΠΝΟΔΩΜΑΤΙΑ έχουν ΑΠΟΛΥΤΟ όριο — η αναλογία θα έσβηνε τον άξονα', () => {
    // 15% πάνω σε «3 υπνοδωμάτια» δίνει 0,45 ⇒ **κανένα** σκαλί. Ένα υπνοδωμάτιο
    // λιγότερο είναι υπαρκτή, συνηθισμένη υποχώρηση.
    const d = demand({ features: { ...NO_DEMAND_FEATURES, bedroomsMin: 3 } });
    expect(concessionCeiling(d, 'bedrooms-floor')).toBe(MAX_ROOMS_CONCESSION);
    expect(buildLadder('bedrooms-floor', [1], concessionCeiling(d, 'bedrooms-floor'))?.headline)
      .toEqual({ amount: 1, unlocks: 1 });
  });

  it('χωρίς δηλωμένο όριο ⇒ ceiling `null` ⇒ **χωρίς** όριο, ποτέ μηδέν', () => {
    // Μια ζήτηση `anywhere` **δεν έχει** ακτίνα να ξεπεραστεί. Αν το `null` γινόταν 0,
    // ο άξονας θα εξαφανιζόταν σιωπηλά — και μόνο για κάποιες ζητήσεις.
    expect(concessionCeiling(demand(), 'search-radius')).toBeNull();
    expect(buildLadder('search-radius', [5_000], null)?.headline).toEqual({
      amount: 5_000,
      unlocks: 1,
    });
  });
});

// =============================================================================
// Α — Ο ΚΑΝΟΝΑΣ ΤΟΥ ΕΝΟΣ ΑΞΟΝΑ
// =============================================================================

describe('🔴 Α — μόνο ΕΝΑΣ άξονας, μόνος του, γεννά πρόταση', () => {
  it('δύο εμπόδια ⇒ καμία πρόταση (μία αλλαγή δεν ξεκλειδώνει)', () => {
    const match = nearMiss({
      blockers: ['price-above', 'area-below'],
      gaps: { ...nearMiss({}).gaps, priceOverBy: 5_000, areaShortBy: 10 },
    });
    expect(soleConcessionOf(match)).toBeNull();
  });

  it('ένα εμπόδιο ΧΩΡΙΣ «πόσο» ⇒ καμία πρόταση, αλλά **λογίζεται**', () => {
    // `floor-outside` είναι μετρήσιμο ως προς την ετυμηγορία και **δεν έχει πεδίο
    // κενού**: το «πόσο λείπει» δεν ορίζεται μονοσήμαντα σε όροφο.
    const match = nearMiss({ blockers: ['floor-outside'] });
    expect(soleConcessionOf(match)).toBeNull();

    const report = buildConcessionReport(demand(), [match]);
    expect(report.ladders).toHaveLength(0);
    expect(report.census.unquantified).toBe(1);
  });

  it('ένα εμπόδιο ΜΕ «πόσο» ⇒ πρόταση με τον σωστό άξονα', () => {
    const match = nearMiss({
      blockers: ['price-above'],
      gaps: { ...nearMiss({}).gaps, priceOverBy: 20_000 },
    });
    expect(soleConcessionOf(match)).toEqual({ concession: 'price-ceiling', amount: 20_000 });
  });
});

// =============================================================================
// Κ — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('🔴 Κ — καμία κοντινή αγγελία δεν χάνεται σιωπηλά', () => {
  it('το άθροισμα κλείνει με ΚΑΙ ΤΟΥΣ ΤΡΕΙΣ κάδους μη μηδενικούς', () => {
    const laddered = nearMiss({
      blockers: ['price-above'],
      gaps: { ...nearMiss({}).gaps, priceOverBy: 1_000 },
    });
    const unquantified = nearMiss({ blockers: ['floor-outside'] });
    const multiAxis = nearMiss({
      blockers: ['price-above', 'bedrooms-below'],
      gaps: { ...nearMiss({}).gaps, priceOverBy: 1_000, bedroomsShortBy: 1 },
    });

    const report = buildConcessionReport(demand(), [laddered, unquantified, multiAxis]);

    expect(report.census).toEqual({
      ladderedCount: 1,
      multiAxis: 1,
      unquantified: 1,
      considered: 3,
    });
    expect(concessionCensusBalances(report.census)).toBe(true);
  });

  it('το άθροισμα κλείνει και στο ΜΗΔΕΝ', () => {
    const report = buildConcessionReport(demand(), []);
    expect(report.ladders).toHaveLength(0);
    expect(concessionCensusBalances(report.census)).toBe(true);
  });

  it('⚠️ αποτυγχάνει ΘΟΡΥΒΩΔΩΣ όταν το άθροισμα δεν κλείνει', () => {
    // Ο έλεγχος υπάρχει για να **αποτύχει**, όχι για να επιβεβαιώνει.
    expect(
      concessionCensusBalances({
        ladderedCount: 1,
        multiAxis: 0,
        unquantified: 0,
        considered: 3,
      }),
    ).toBe(false);
  });
});

// =============================================================================
// Π — ΠΟΛΙΤΙΚΗ (χειρόγραφες προσδοκίες)
// =============================================================================

describe('🔴 Π — η σκάλα και η επιλογή του σκαλιού', () => {
  it('τα ΙΣΑ ποσά συγχωνεύονται σε ΕΝΑ σκαλί', () => {
    // Δύο αγγελίες ακριβώς +5.000 είναι «με +5.000 υπάρχουν 2», ποτέ δύο σκαλιά.
    const ladder = buildLadder('price-ceiling', [5_000, 5_000, 9_000], null);
    expect(ladder?.steps).toEqual([
      { amount: 5_000, unlocks: 2 },
      { amount: 9_000, unlocks: 3 },
    ]);
  });

  it('τα πλήθη είναι ΣΩΡΕΥΤΙΚΑ, όχι ανά σκαλί', () => {
    const ladder = buildLadder('price-ceiling', [1, 2, 3], null);
    expect(ladder?.steps.map((step) => step.unlocks)).toEqual([1, 2, 3]);
  });

  it('η ισοπαλία σπάει με το ΜΙΚΡΟΤΕΡΟ ποσό — ποτέ με τη σειρά άφιξης', () => {
    // Δύο σκαλιά με το ίδιο πλήθος: το ακριβότερο είναι **αυστηρά χειρότερο**.
    const ladder = buildLadder('price-ceiling', [3_000], 10_000);
    expect(ladder?.headline).toEqual({ amount: 3_000, unlocks: 1 });
  });

  it('όταν ΚΑΘΕ σκαλί ξεπερνά το κατώφλι ⇒ `headline: null`, όχι κενή σκάλα', () => {
    // «Υπάρχουν κοντινές, αλλά καμία σε υποχώρηση που αξίζει να προταθεί» — υπαρκτή,
    // **διαφορετική** απάντηση από «δεν υπάρχει τίποτα κοντά».
    const ladder = buildLadder('price-ceiling', [50_000], 10_000);
    expect(ladder?.steps).toHaveLength(1);
    expect(ladder?.headline).toBeNull();
  });

  it('κενά ποσά ⇒ **καμία** σκάλα, ποτέ σκάλα με μηδέν σκαλιά', () => {
    expect(buildLadder('price-ceiling', [], null)).toBeNull();
  });

  it('η σειρά των σκαλών είναι ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ — όσες προτείνουν πρώτες', () => {
    const withHeadline = nearMiss({
      blockers: ['price-above'],
      gaps: { ...nearMiss({}).gaps, priceOverBy: 1_000 },
    });
    const withoutHeadline = nearMiss({
      blockers: ['bedrooms-below'],
      gaps: { ...nearMiss({}).gaps, bedroomsShortBy: 5 },
    });

    const d = demand({ features: { ...NO_DEMAND_FEATURES, priceMax: 100_000, bedroomsMin: 3 } });
    const report = buildConcessionReport(d, [withoutHeadline, withHeadline]);

    expect(report.ladders[0].concession).toBe('price-ceiling');
    expect(report.ladders[0].headline).not.toBeNull();
    expect(report.ladders[1].headline).toBeNull();
  });

  it('🔑 ΚΑΘΕ άξονας υποχώρησης έχει μονάδα — κανένας δεν ξεχάστηκε', () => {
    // Νέος άξονας χωρίς μονάδα θα κατέληγε σε πρόταση **χωρίς μονάδα** στην οθόνη.
    for (const concession of DEMAND_CONCESSIONS) {
      const ladder = buildLadder(concession, [1], null);
      expect(ladder?.unit).toBeDefined();
    }
  });
});

// =============================================================================
// ΤΑ ΕΜΠΟΔΙΑ ΤΩΝ ΑΡΝΗΣΕΩΝ
// =============================================================================

describe('🔴 tallyBlockers — «τι τις σταμάτησε»', () => {
  it('μετρά κάθε εμπόδιο κάθε άρνησης, **αραιά**', () => {
    const tally = tallyBlockers([
      nearMiss({ blockers: ['offer-kind'] }),
      nearMiss({ blockers: ['offer-kind', 'property-type'] }),
    ]);

    expect(tally.get('offer-kind')).toBe(2);
    expect(tally.get('property-type')).toBe(1);
    // ⚠️ **Αραιός** χάρτης: ένα πλήρες `Record` με 17 μηδενικά θα ανάγκαζε την οθόνη
    // να φιλτράρει — και το φιλτράρισμα είναι η στιγμή που γράφεται λάθος κατώφλι.
    expect(tally.has('price-above')).toBe(false);
  });
});
