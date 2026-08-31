/**
 * @fileoverview Άγκυρες του **πίνακα διάθεσης × αξίωσης** — δεκαέξι κελιά, κανένα σιωπηλό.
 * @related ADR-838 §4.5 · SPEC-777 §22 («αν δεν βρεις κάτι, γράψε δεν βρέθηκε»)
 *
 * 🔴 **ΤΙ ΣΚΟΤΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ:**
 *
 * | # | Μετάλλαξη | Άγκυρα |
 * |---|---|---|
 * | Μ1 | `unresolved` → `not-raised` σε οποιοδήποτε κελί | Δ4 |
 * | Μ2 | `raisedClaimKinds`: `!== 'not-raised'` → `=== 'raised'` (τα `unresolved` πέφτουν) | Δ3 |
 * | Μ3 | ο ΑΜΑ γίνεται `raised` στην πώληση | Δ2 |
 * | Μ4 | `raisedClaimKinds`: `some` → `every` | Δ3 |
 */

import { OFFER_KINDS } from '@/types/property-offers';
import { LEGALITY_CLAIM_KINDS } from '../legality-claim';
import {
  legalityRelevanceFor,
  raisedClaimKinds,
  unresolvedLegalityCells,
  LEGALITY_OFFER_MATRIX,
} from '../legality-offer-matrix';

describe('Δ1 — 🔴 ΚΑΘΕ κελί απαντά, και η απάντηση κουβαλά ΠΗΓΗ ή ΕΡΩΤΗΣΗ', () => {
  it('δεκαέξι κελιά, κανένα απόν', () => {
    let cells = 0;
    for (const offerKind of OFFER_KINDS) {
      for (const claimKind of LEGALITY_CLAIM_KINDS) {
        expect(LEGALITY_OFFER_MATRIX[offerKind][claimKind]).toBeDefined();
        cells += 1;
      }
    }
    expect(cells).toBe(OFFER_KINDS.length * LEGALITY_CLAIM_KINDS.length);
    expect(cells).toBe(16);
  });

  it('🔴 καμία βέβαιη απάντηση χωρίς διάταξη, καμία αβέβαιη χωρίς ερώτηση', () => {
    for (const offerKind of OFFER_KINDS) {
      for (const claimKind of LEGALITY_CLAIM_KINDS) {
        const cell = legalityRelevanceFor(offerKind, claimKind);
        if (cell.relevance === 'unresolved') {
          expect(cell.question.trim().length).toBeGreaterThan(0);
        } else {
          expect(cell.statute.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Δ2 — οι απαντήσεις που ξέρουμε', () => {
  it('ο ΑΜΑ σηκώνεται ΜΟΝΟ στη βραχυχρόνια', () => {
    expect(legalityRelevanceFor('leaseShort', 'short-stay-registry').relevance).toBe('raised');
    for (const offerKind of ['sell', 'leaseOut', 'exchange'] as const) {
      expect(legalityRelevanceFor(offerKind, 'short-stay-registry').relevance).toBe('not-raised');
    }
  });

  it('η βεβαίωση μηχανικού σηκώνεται στη ΜΕΤΑΒΙΒΑΣΗ — και στην αντιπαροχή', () => {
    expect(legalityRelevanceFor('sell', 'building-identity').relevance).toBe('raised');
    // 🔑 «ή **οικοπέδου χωρίς κτίσμα**» — το άρθρο 83 το λέει ρητά.
    expect(legalityRelevanceFor('exchange', 'building-identity').relevance).toBe('raised');
  });

  it('η μίσθωση ΔΕΝ είναι μεταβίβαση', () => {
    expect(legalityRelevanceFor('leaseOut', 'building-identity').relevance).toBe('not-raised');
    expect(legalityRelevanceFor('leaseShort', 'building-identity').relevance).toBe('not-raised');
  });

  it('το ΠΕΑ σηκώνεται σε πώληση ΚΑΙ σε μίσθωση («πώληση ή μίσθωση»)', () => {
    expect(legalityRelevanceFor('sell', 'energy-performance').relevance).toBe('raised');
    expect(legalityRelevanceFor('leaseOut', 'energy-performance').relevance).toBe('raised');
  });
});

describe('Δ3 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ της προβολής', () => {
  it('η πώληση σηκώνει τρία ερωτήματα, όχι τον ΑΜΑ', () => {
    expect([...raisedClaimKinds(['sell'])]).toEqual([
      'building-identity',
      'arbitrary-settlement',
      'energy-performance',
    ]);
  });

  it('🔴 η βραχυχρόνια σηκώνει τον ΑΜΑ ΚΑΙ το ΑΝΑΠΑΝΤΗΤΟ ΠΕΑ', () => {
    // Με `=== 'raised'` το ΠΕΑ θα έπεφτε — δηλαδή η οθόνη θα σιωπούσε, και η σιωπή
    // θα διαβαζόταν ως «δεν χρειάζεται», ισχυρισμός που ΔΕΝ επαληθεύτηκε.
    expect([...raisedClaimKinds(['leaseShort'])]).toEqual([
      'short-stay-registry',
      'energy-performance',
    ]);
  });

  it('δύο διαθέσεις μαζί ⇒ η ΕΝΩΣΗ, χωρίς διπλότυπα', () => {
    const kinds = raisedClaimKinds(['sell', 'leaseShort']);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(kinds).toContain('short-stay-registry');
    expect(kinds).toContain('building-identity');
  });

  it('καμία διάθεση ⇒ κανένα ερώτημα', () => {
    expect(raisedClaimKinds([])).toEqual([]);
  });
});

describe('Δ4 — 🔴 Η ΑΠΟΓΡΑΦΗ ΤΗΣ ΑΓΝΟΙΑΣ — μόνο μικραίνει', () => {
  it('τα ανοιχτά κελιά είναι ΑΚΡΙΒΩΣ αυτά, ονομαστικά', () => {
    // Αν κάποιος «λύσει» ένα κελί μαντεύοντας, αυτή η άγκυρα κοκκινίζει και τον
    // αναγκάζει να δηλώσει ΤΙ βρήκε. Αν βρεθεί νέο άγνωστο, κοκκινίζει επίσης.
    expect(unresolvedLegalityCells().map((c) => `${c.offerKind}/${c.claimKind}`)).toEqual([
      'exchange/energy-performance',
      'leaseShort/energy-performance',
    ]);
  });

  it('κάθε ανοιχτό κελί λέει ΤΙ δεν βρέθηκε', () => {
    for (const cell of unresolvedLegalityCells()) {
      expect(cell.question).toMatch(/Ν\.\d+\/\d{4}/);
    }
  });
});
