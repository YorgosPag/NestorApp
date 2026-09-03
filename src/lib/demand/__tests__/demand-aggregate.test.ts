/**
 * Άγκυρες — **ΕΠΙΠΕΔΟ Γ**, το ανώνυμο άθροισμα (ADR-777 Α12 · SPEC-777B §12.6 · §12.7).
 *
 * Τέσσερις ομάδες:
 *
 * **Λ** — η **λογιστική** κλείνει, με κάθε κάδο ονομασμένο και τυπωμένο **ακόμη και
 * στο μηδέν** (μάθημα CHECK 3.48 `Κ6`).
 * **Φ** — η **φρεσκάδα**: η απόφαση των **90 ημερών** (Giorgio 2026-08-11) και το ότι
 * η ζήτηση **δεν σβήνεται** ποτέ.
 * **Α** — τα δύο **ακροατήρια** και τα δύο κατώφλια, με τη Ζ3 να **ζει**.
 * **Δ** — 🔴 η **διαρροή**: ότι η αποκάλυψη **δεν κουβαλά** τον ωμό αριθμό όταν τον
 * κρύβει. Είναι το σοβαρότερο test του αρχείου, γιατί ένα αντικείμενο λογιστικής που
 * ταξιδεύει δίπλα σε κρυμμένη τιμή **ακυρώνει** την απόκρυψη ενώ φαίνεται σωστό.
 */

import {
  DEMAND_AUDIENCES,
  DEMAND_DISCLOSURE,
  DEMAND_EXCLUSIONS,
  censusBalances,
  censusDemands,
  demandExclusionReason,
  discloseCompetition,
  discloseDemand,
  type DemandExclusion,
} from '../demand-aggregate';
import {
  DEMAND_AFFIRMATION_TTL_DAYS,
  NO_DEMAND_FEATURES,
  type PropertyDemand,
} from '@/types/property-demand';

const NOW = '2026-08-11T00:00:00.000Z';

/** Ημερομηνία Χ ημέρες πριν το {@link NOW}. */
function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
}

function demand(overrides: Partial<PropertyDemand> = {}): PropertyDemand {
  return {
    id: `dmnd_${Math.random().toString(36).slice(2, 8)}`,
    authorUserId: 'usr_1',
    authorCompanyId: null,
    mandate: { kind: 'self' },
    seeks: ['sell'],
    place: { kind: 'anywhere' },
    timing: { kind: 'now' },
    features: NO_DEMAND_FEATURES,
    proximity: [],
    lifeContext: null,
    lifecycle: 'active',
    affirmedAt: daysAgo(1),
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

/** Ν φρέσκες, ζωντανές, αποδιδόμενες ζητήσεις. */
function healthy(count: number): PropertyDemand[] {
  return Array.from({ length: count }, (_, index) => demand({ id: `dmnd_ok_${index}` }));
}

// =============================================================================
// Λ — Η ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('🔴 Λ — κλειστή λογιστική, fail-closed', () => {
  const CASES: ReadonlyArray<readonly [DemandExclusion, Partial<PropertyDemand>]> = [
    ['not-live', { lifecycle: 'withdrawn' }],
    [
      'unattributed',
      {
        mandate: {
          kind: 'brokered',
          clientContactId: 'cont_1',
          confirmation: 'pending',
          confirmedByUserId: null,
        },
      },
    ],
    ['stale', { affirmedAt: daysAgo(DEMAND_AFFIRMATION_TTL_DAYS + 1) }],
  ];

  for (const [exclusion, overrides] of CASES) {
    it(`«${exclusion}» πυροδοτεί σε πραγματική είσοδο`, () => {
      expect(demandExclusionReason(demand(overrides), NOW)).toBe(exclusion);
    });
  }

  it('🔑 ΚΑΘΕ λόγος αποκλεισμού καλύπτεται — κανένας αδρανής κάδος', () => {
    const covered = new Set(CASES.map(([reason]) => reason));
    expect([...DEMAND_EXCLUSIONS].sort()).toEqual([...covered].sort());
  });

  it('υγιής ζήτηση δεν αποκλείεται', () => {
    expect(demandExclusionReason(demand(), NOW)).toBeNull();
  });

  it('το άθροισμα κλείνει, και οι κάδοι τυπώνονται ΑΚΟΜΗ ΚΑΙ ΣΤΟ ΜΗΔΕΝ', () => {
    const census = censusDemands(healthy(3), NOW);

    expect(census.counted).toBe(3);
    expect(census.considered).toBe(3);
    expect(censusBalances(census)).toBe(true);
    // ⚠️ Ένα «0» που δεν τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος».
    for (const exclusion of DEMAND_EXCLUSIONS) {
      expect(census.excluded[exclusion]).toBe(0);
    }
  });

  it('🔑 μεικτό σύνολο: κάθε αποκλεισμός λογίζεται στον ΣΩΣΤΟ κάδο', () => {
    const census = censusDemands(
      [
        ...healthy(2),
        demand({ lifecycle: 'fulfilled' }),
        demand({ affirmedAt: daysAgo(200) }),
        demand({
          mandate: {
            kind: 'brokered',
            clientContactId: 'c',
            confirmation: 'declined',
            confirmedByUserId: null,
          },
        }),
      ],
      NOW,
    );

    expect(census.counted).toBe(2);
    expect(census.excluded['not-live']).toBe(1);
    expect(census.excluded.stale).toBe(1);
    expect(census.excluded.unattributed).toBe(1);
    expect(census.considered).toBe(5);
    expect(censusBalances(census)).toBe(true);
  });

  it('🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: αποσυρμένη ΚΑΙ μπαγιάτικη → «not-live»', () => {
    // Αλλιώς η αναφορά θα έλεγε ότι ο κόσμος «ξεχνά να επιβεβαιώσει» ενώ στην
    // πραγματικότητα **βρήκε σπίτι** — και θα κυνηγούσαμε λάθος πρόβλημα.
    const both = demand({ lifecycle: 'withdrawn', affirmedAt: daysAgo(400) });
    expect(demandExclusionReason(both, NOW)).toBe('not-live');
  });
});

// =============================================================================
// Φ — Η ΦΡΕΣΚΑΔΑ (απόφαση Giorgio: 3 μήνες)
// =============================================================================

describe('🔴 Φ — 90 ημέρες σιωπής, και η ζήτηση ΔΕΝ σβήνεται', () => {
  it(`το κατώφλι είναι ${DEMAND_AFFIRMATION_TTL_DAYS} ημέρες`, () => {
    expect(DEMAND_AFFIRMATION_TTL_DAYS).toBe(90);
  });

  it('στις 89 ημέρες μετράει ακόμη· στις 91 όχι', () => {
    expect(demandExclusionReason(demand({ affirmedAt: daysAgo(89) }), NOW)).toBeNull();
    expect(demandExclusionReason(demand({ affirmedAt: daysAgo(91) }), NOW)).toBe('stale');
  });

  it('🔑 ΕΝΑ ΚΛΙΚ την ξαναφέρνει — «ψάχνω ακόμη»', () => {
    const forgotten = demand({ affirmedAt: daysAgo(400) });
    expect(demandExclusionReason(forgotten, NOW)).toBe('stale');

    const reaffirmed: PropertyDemand = { ...forgotten, affirmedAt: NOW };
    expect(demandExclusionReason(reaffirmed, NOW)).toBeNull();
  });

  it('🔴 μπαγιάτικη ζήτηση παραμένει ΕΝΕΡΓΗ — η φρεσκάδα δεν είναι κύκλος ζωής', () => {
    const stale = demand({ affirmedAt: daysAgo(400) });
    // Η Ζ3 λέει «όποτε κι αν βγει». Ό,τι παλιώνει είναι ο **δημόσιος ισχυρισμός**,
    // ποτέ η ίδια η εντολή του ανθρώπου.
    expect(stale.lifecycle).toBe('active');
  });

  it('αλλοιωμένη ημερομηνία λογίζεται ως μπαγιάτικη, ποτέ ως φρέσκια', () => {
    expect(demandExclusionReason(demand({ affirmedAt: 'όχι-ημερομηνία' }), NOW)).toBe('stale');
  });
});

// =============================================================================
// Α — ΤΑ ΤΡΙΑ ΑΚΡΟΑΤΗΡΙΑ  (ήταν δύο ως τις 2026-09-03, ADR-843 §10.8)
// =============================================================================

describe('🔴 Α — τρία ακροατήρια, τρία κατώφλια, και η Ζ3 ΖΕΙ', () => {
  it('κάθε ακροατήριο έχει κατώφλι ΚΑΙ γραπτό λόγο', () => {
    for (const audience of DEMAND_AUDIENCES) {
      const policy = DEMAND_DISCLOSURE[audience];
      expect(policy.minCount).toBeGreaterThan(0);
      expect(policy.why.length).toBeGreaterThan(40);
    }
  });

  it('🔑 ο ΠΛΗΣΙΑΣΜΕΝΟΣ μαθαίνει από τον 1ο — το υποκείμενο ΕΙΝΑΙ ο αποκαλύπτων', () => {
    // 🔴 ADR-843 ΠΕ1/§10.8. Το k-κατώφλι προστατεύει όποιον αποκαλύπτεται **χωρίς να
    //    το ζητήσει**· εδώ ο ζητών **πάτησε ο ίδιος** το κουμπί. Κατώφλι >1 δεν θα
    //    προστάτευε κανέναν — θα **ακύρωνε την πράξη**, απαιτώντας να πλησιάσουν
    //    πέντε πριν μιλήσει ο ένας.
    const alone = discloseDemand(healthy(1), 'approached-offerer', NOW);
    expect(alone.count).toBe(1);
    expect(alone.minCount).toBe(1);
  });

  it('🔴 ο ΙΔΙΟΚΤΗΤΗΣ μαθαίνει από τον 1ο (απόφαση Giorgio 2026-08-11)', () => {
    const one = discloseDemand(healthy(1), 'place-owner', NOW);
    expect(one.count).toBe(1);
    expect(one.minCount).toBe(1);
  });

  it('🔴 και αυτό είναι ΑΚΡΙΒΩΣ ό,τι κρατά ζωντανή τη Ζ3', () => {
    // Με κατώφλι 5, μια ζήτηση για ΕΝΑ κατάστημα δεν έφτανε ποτέ στον ιδιοκτήτη,
    // και το δόλωμα του §12.6 («12 άνθρωποι ζητούν το κατάστημά σας») δεν υπήρχε.
    const asMarket = discloseDemand(healthy(1), 'area-market', NOW);
    expect(asMarket.count).toBeNull();
    expect(DEMAND_DISCLOSURE['place-owner'].minCount).toBeLessThan(
      DEMAND_DISCLOSURE['area-market'].minCount,
    );
  });

  it('η ΑΓΟΡΑ μαθαίνει από τους 5 και πάνω — πρότυπο στατιστικής απόκρυψης', () => {
    expect(discloseDemand(healthy(4), 'area-market', NOW).count).toBeNull();
    expect(discloseDemand(healthy(5), 'area-market', NOW).count).toBe(5);
  });

  it('🔑 το κατώφλι μετρά τις ΜΕΤΡΗΣΙΜΕΣ, όχι τις υποψήφιες', () => {
    // Πέντε έγγραφα, αλλά δύο μπαγιάτικα ⇒ τρεις μετρήσιμες ⇒ κάτω από το κατώφλι.
    const mixed = [...healthy(3), demand({ affirmedAt: daysAgo(200) }), demand({ affirmedAt: daysAgo(300) })];
    expect(discloseDemand(mixed, 'area-market', NOW).count).toBeNull();
  });

  it('κενό σύνολο δεν αποκαλύπτει «0» στην αγορά', () => {
    // ⚠️ «0» και «δεν το λέμε» είναι διαφορετικά, αλλά προς τα έξω και τα δύο είναι
    // `null`: ένα ρητό «κανείς δεν ψάχνει εδώ» είναι κι αυτό πληροφορία αγοράς.
    expect(discloseDemand([], 'area-market', NOW).count).toBeNull();
  });
});

// =============================================================================
// Δ — Η ΔΙΑΡΡΟΗ ΠΟΥ ΘΑ ΦΑΙΝΟΤΑΝ ΣΩΣΤΗ
// =============================================================================

describe('🔴 Δ — η αποκάλυψη ΔΕΝ κουβαλά τον ωμό αριθμό όταν τον κρύβει', () => {
  it('κάτω από το κατώφλι, ΚΑΝΕΝΑ πεδίο δεν περιέχει το πραγματικό πλήθος', () => {
    const three = healthy(3);
    const disclosure = discloseDemand(three, 'area-market', NOW);

    expect(disclosure.count).toBeNull();

    // 🔴 Η ΟΥΣΙΑ: σειριοποιούμε ΟΛΟΚΛΗΡΟ το αντικείμενο και ψάχνουμε τον αριθμό.
    // Ένα «αντικείμενο λογιστικής» δίπλα σε κρυμμένη τιμή θα περνούσε κάθε έλεγχο
    // πεδίου και θα ακύρωνε την απόκρυψη — ίδιο ιδίωμα με την άγκυρα διαρροής του
    // `public-listings.rules.test.ts`, που ψάχνει ονομαστικά στη σειριοποίηση.
    const serialized = JSON.stringify(disclosure);
    expect(serialized).not.toContain('"counted"');
    expect(serialized).not.toContain('"excluded"');
    expect(serialized).not.toContain('"considered"');
    expect(serialized).not.toContain(':3');
  });

  it('η αποκάλυψη έχει ΑΚΡΙΒΩΣ τρία πεδία — κλειστό σχήμα', () => {
    const disclosure = discloseDemand(healthy(7), 'area-market', NOW);
    expect(Object.keys(disclosure).sort()).toEqual(['audience', 'count', 'minCount']);
  });

  it('🔑 πάνω από το κατώφλι λέει τον αριθμό — αλλιώς η πύλη θα ήταν διακοσμητική', () => {
    expect(discloseDemand(healthy(12), 'area-market', NOW).count).toBe(12);
  });
});

// =============================================================================
// Σ — «ΠΟΣΟΙ ΑΛΛΟΙ ΖΗΤΟΥΝ ΤΟ ΙΔΙΟ» (§12.6, δεύτερο σκέλος)
// =============================================================================

describe('Σ — ο ανταγωνισμός, χωρίς τον εαυτό σου', () => {
  it('🔴 ο ίδιος ο συγγραφέας ΔΕΝ μετράει τον εαυτό του', () => {
    const mine = demand({ id: 'dmnd_mine' });
    const pool = [mine, ...healthy(5)];

    // 6 συνολικά, αλλά «άλλοι» = 5 ⇒ ακριβώς στο κατώφλι.
    expect(discloseCompetition(mine, pool, NOW).count).toBe(5);
  });

  it('μόνος του στην περιοχή → δεν αποκαλύπτεται «0 άλλοι»', () => {
    const mine = demand({ id: 'dmnd_mine' });
    expect(discloseCompetition(mine, [mine], NOW).count).toBeNull();
  });

  it('🔑 χρησιμοποιεί το κατώφλι της ΑΓΟΡΑΣ — ο ζητών είναι κι αυτός τρίτος', () => {
    const mine = demand({ id: 'dmnd_mine' });
    const result = discloseCompetition(mine, [mine, ...healthy(3)], NOW);
    expect(result.audience).toBe('area-market');
    expect(result.count).toBeNull();
  });
});
