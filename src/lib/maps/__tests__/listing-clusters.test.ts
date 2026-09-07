/**
 * ΑΓΚΥΡΕΣ — **η ομάδα λέει πλήθος, και ομολογεί τι δεν ξέρει** (ADR-777 §8.66).
 *
 * 🔴 **ΚΑΘΕ ΑΓΚΥΡΑ ΕΔΩ ΕΚΤΕΛΕΙ ΤΗΝ ΕΚΦΡΑΣΗ.** Μια σύγκριση δομής θα επαλήθευε ότι
 * «γράψαμε αυτό που γράψαμε» — και το §8.63 πλήρωσε ακριβώς αυτό: **32/32 μεταλλάξεις
 * πράσινες** και δύο ζωντανά ελαττώματα στο σύνορο με τη βιβλιοθήκη.
 */

import {
  CLUSTER_KEY,
  CLUSTER_RADIUS,
  CLUSTER_TEXT,
  CLUSTER_UNCERTAIN_KEY,
  LISTING_CLUSTER_OPTIONS,
  NOT_A_CLUSTER,
} from '../listing-clusters';
import { evaluateValue, type ValueContext } from './style-expression-evaluator';

/** Ένα **συσσωμάτωμα** όπως το φτιάχνει το MapLibre: πλήθος + το δικό μας πεδίο. */
function cluster(total: number, uncertain: number): ValueContext {
  return {
    props: {
      [CLUSTER_KEY.isCluster]: true,
      [CLUSTER_KEY.pointCount]: total,
      [CLUSTER_UNCERTAIN_KEY]: uncertain,
    },
  };
}

/** Μια **μεμονωμένη** αγγελία: έχει `shape`, δεν έχει `point_count`. */
function single(shape: string, uncertaintyM: number): ValueContext {
  return { props: { id: 'own_1', shape, uncertaintyM, mercatorScale: 1.27 } };
}

// ============================================================================
// Κ1 — ΠΛΗΘΟΣ, ΠΟΤΕ ΤΙΜΗ  🔴 ο κανόνας που προστατεύει την Α5
// ============================================================================

describe('Κ1 — το συσσωμάτωμα δεν συναθροίζει ΤΙΜΗ', () => {
  it('η πηγή δηλώνει ΑΚΡΙΒΩΣ μία συναθροισμένη ιδιότητα', () => {
    expect(Object.keys(LISTING_CLUSTER_OPTIONS.clusterProperties)).toEqual([
      CLUSTER_UNCERTAIN_KEY,
    ]);
  });

  it('🔴 καμία συναθροισμένη ιδιότητα δεν αγγίζει πεδίο τιμής', () => {
    // Μια «μέση τιμή» σε συσσωμάτωμα είναι αριθμός που δεν αντιστοιχεί σε ΚΑΝΕΝΑ
    // ακίνητο. Η άγκυρα κοιτάζει το **σειριοποιημένο** αντικείμενο, ώστε να πιάσει
    // και ένα `['get','price']` θαμμένο σε φωλιασμένη έκφραση.
    const serialised = JSON.stringify(LISTING_CLUSTER_OPTIONS.clusterProperties);
    for (const forbidden of ['price', 'Price', 'rent', 'sqm', 'avg', 'mean']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('η συνθήκη ρωτά το ΜΕΓΕΘΟΣ (uncertaintyM), όχι την κατηγορία (shape)', () => {
    // 🔑 Ένα σκαλί αβεβαιότητας παραπάνω αύριο μπαίνει ΜΟΝΟ ΤΟΥ — καμία απαρίθμηση
    //    σχημάτων να ξεχαστεί.
    const serialised = JSON.stringify(LISTING_CLUSTER_OPTIONS.clusterProperties);
    expect(serialised).toContain('uncertaintyM');
    expect(serialised).not.toContain('shape');
  });

  it('ο συσσωρευτής μετρά 1 ανά αβέβαιη αγγελία και 0 για τις υπόλοιπες', () => {
    const [, mapExpression] = LISTING_CLUSTER_OPTIONS.clusterProperties[CLUSTER_UNCERTAIN_KEY];
    expect(evaluateValue(mapExpression, single('shaded-city', 10_000))).toBe(1);
    expect(evaluateValue(mapExpression, single('shaded-circle', 1_500))).toBe(1);
    expect(evaluateValue(mapExpression, single('pin', 0))).toBe(0);
    expect(evaluateValue(mapExpression, single('outline', 0))).toBe(0);
  });
});

// ============================================================================
// Κ2 — ΟΙ ΔΥΟ ΑΡΙΘΜΟΙ  🏆 εδώ ξεπερνάμε τους μεγάλους
// ============================================================================

describe('Κ2 — η ομάδα ομολογεί τι δεν ξέρει', () => {
  it('χωρίς αβεβαιότητα δείχνει ΕΝΑΝ αριθμό — το σύνολο', () => {
    expect(evaluateValue(CLUSTER_TEXT, cluster(17, 0))).toBe('17');
  });

  it('🏆 με αβεβαιότητα δείχνει ΔΥΟ: ακριβείς · και οι υπόλοιπες με ≈', () => {
    expect(evaluateValue(CLUSTER_TEXT, cluster(17, 5))).toBe('12 · +5≈');
  });

  it('🔴 ο πρώτος αριθμός είναι η ΔΙΑΦΟΡΑ, ποτέ το σύνολο', () => {
    // Αν έγραφε το σύνολο («17 · +5»), ο αναγνώστης δεν θα είχε τρόπο να ξέρει αν το
    // 5 είναι ΜΕΣΑ στο 17 ή ΕΠΙΠΛΕΟΝ. Δύο αριθμοί που αθροίζουν είναι η μόνη
    // ανάγνωση χωρίς οδηγίες — και η άγκυρα το ελέγχει ως **άθροισμα**.
    for (const [total, uncertain] of [[17, 5], [40, 39], [8, 1]] as const) {
      const label = String(evaluateValue(CLUSTER_TEXT, cluster(total, uncertain)));
      const [exact, rest] = label.split(' · +');
      expect(Number(exact) + Number(rest.replace('≈', ''))).toBe(total);
    }
  });

  it('όλες αβέβαιες ⇒ ο πρώτος αριθμός είναι 0, και λέγεται', () => {
    // Δεν κρύβεται: «0 · +6≈» είναι η αλήθεια — καμία από τις έξι δεν έχει διεύθυνση.
    expect(evaluateValue(CLUSTER_TEXT, cluster(6, 6))).toBe('0 · +6≈');
  });

  it('⚠️ το σύμβολο ≈ ΔΕΝ εμφανίζεται όταν δεν υπάρχει αβεβαιότητα', () => {
    // Σύμβολο που εμφανίζεται πάντα εκπαιδεύει τον αναγνώστη να το αγνοεί — ίδιο
    // σκεπτικό με την υποσημείωση του AreaLedgerBar.
    expect(String(evaluateValue(CLUSTER_TEXT, cluster(3, 0)))).not.toContain('≈');
  });

  it('η ετικέτα δεν περιέχει ΚΑΜΙΑ λέξη — μόνο αριθμούς και σύμβολα', () => {
    // 🔑 Μια ετικέτα MapLibre δεν περνά από t(). Λέξη εκεί = hardcoded string (N.11).
    const label = String(evaluateValue(CLUSTER_TEXT, cluster(17, 5)));
    expect(label).not.toMatch(/\p{Letter}/u);
  });
});

// ============================================================================
// Κ3 — ΤΟ ΣΥΣΣΩΜΑΤΩΜΑ ΔΕΝ ΕΙΝΑΙ ΑΓΓΕΛΙΑ
// ============================================================================

describe('Κ3 — τα δύο είδη σημείου δεν μπερδεύονται', () => {
  it('το NOT_A_CLUSTER δέχεται μεμονωμένη αγγελία και απορρίπτει ομάδα', () => {
    expect(evaluateValue(NOT_A_CLUSTER, single('pin', 0))).toBe(true);
    expect(evaluateValue(NOT_A_CLUSTER, cluster(9, 2))).toBe(false);
  });

  it('🔴 το φίλτρο που ΘΑ ΕΣΠΑΖΕ χωρίς αυτό: αριθμητική σύγκριση σε πεδίο που λείπει', () => {
    // Η προφανής επόμενη γραφή ενός επιπέδου αβεβαιότητας. Το `null` του
    // συσσωματώματος περνά ως 0 — άρα σκέτη δεν αρκεί, μαζί με το NOT_A_CLUSTER ναι.
    const naive = ['>', ['get', 'uncertaintyM'], -1];
    expect(evaluateValue(naive, cluster(9, 2))).toBe(true); // ⚠️ το συσσωμάτωμα ΠΕΡΝΑΕΙ
    expect(evaluateValue(['all', NOT_A_CLUSTER, naive], cluster(9, 2))).toBe(false);
  });

  it('τα ονόματα της βιβλιοθήκης είναι τα ΠΡΑΓΜΑΤΙΚΑ (snake_case)', () => {
    // Λάθος εδώ είναι σιωπηλό: το ['get','pointCount'] δίνει null και το συσσωμάτωμα
    // ζωγραφίζεται χωρίς αριθμό.
    expect(CLUSTER_KEY.pointCount).toBe('point_count');
    expect(CLUSTER_KEY.isCluster).toBe('cluster');
  });
});

// ============================================================================
// Κ4 — Η ΑΚΤΙΝΑ ΛΕΕΙ «ΛΙΓΑ / ΑΡΚΕΤΑ / ΠΟΛΛΑ»
// ============================================================================

describe('Κ4 — τρία σκαλιά, μονότονα', () => {
  it.each([
    [1, 16],
    [9, 16],
    [10, 22],
    [49, 22],
    [50, 30],
    [4000, 30],
  ])('πλήθος %i ⇒ %i px', (count, expected) => {
    expect(evaluateValue(CLUSTER_RADIUS, cluster(count, 0))).toBe(expected);
  });

  it('η ακτίνα ΠΟΤΕ δεν μικραίνει όσο μεγαλώνει το πλήθος', () => {
    let previous = 0;
    for (const count of [1, 5, 10, 25, 49, 50, 200, 5000]) {
      const radius = Number(evaluateValue(CLUSTER_RADIUS, cluster(count, 0)));
      expect(radius).toBeGreaterThanOrEqual(previous);
      previous = radius;
    }
  });

  it('⚠️ κάθε σκαλί είναι μεγαλύτερο από την πινέζα — η ομάδα δεν κρύβεται πίσω της', () => {
    const PIN_RADIUS_PX = 7; // ResultsMapLayers.RADIUS.pin
    for (const count of [1, 10, 50]) {
      expect(Number(evaluateValue(CLUSTER_RADIUS, cluster(count, 0)))).toBeGreaterThan(
        PIN_RADIUS_PX
      );
    }
  });
});

// ============================================================================
// Κ5 — ΟΙ ΡΥΘΜΙΣΕΙΣ ΤΗΣ ΠΗΓΗΣ
// ============================================================================

describe('Κ5 — η ομαδοποίηση σταματά εκεί που ο άνθρωπος ρωτά «ποιο;»', () => {
  it('ενεργή, με ρητή ακτίνα και ρητό ανώτατο ζουμ', () => {
    expect(LISTING_CLUSTER_OPTIONS.cluster).toBe(true);
    expect(LISTING_CLUSTER_OPTIONS.clusterRadius).toBeGreaterThan(0);
    expect(LISTING_CLUSTER_OPTIONS.clusterMaxZoom).toBeGreaterThan(0);
  });

  it('🔑 το ανώτατο ζουμ αφήνει χώρο ΠΑΝΩ του — αλλιώς δεν διαλύεται ποτέ', () => {
    // Το FIT_OPTIONS του ResultsMap κλείνει στο maxZoom 15· αν η ομαδοποίηση έφτανε
    // ως εκεί, ο επισκέπτης δεν θα έβλεπε ΠΟΤΕ μεμονωμένη αγγελία μετά από καδράρισμα.
    expect(LISTING_CLUSTER_OPTIONS.clusterMaxZoom).toBeLessThan(15);
  });
});
