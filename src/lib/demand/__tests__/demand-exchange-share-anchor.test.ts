/**
 * @fileoverview **ΑΓΚΥΡΑ — ΑΝΤΙΠΑΡΟΧΗ ΜΕ ΟΡΟΦΗ ΠΟΣΟΣΤΟΥ ΟΙΚΟΠΕΔΟΥΧΟΥ** (ADR-777 §8.60.17).
 *
 * 🔴 **Τι φυλάει**: ως τις 2026-09-18 η ζήτηση «Ψάχνω γη για αντιπαροχή» δεν είχε **κανέναν** όρο, και
 * το ποσοστό του ιδιοκτήτη ήταν **δηλωμένη απώλεια** της προβολής — άρα καμία οροφή δεν μπορούσε να
 * κριθεί. Εδώ ασκείται ολόκληρη η αλυσίδα: μηχανή → υποχωρήσεις → σύνδεσμος → αναλλοίωτο → ανάγνωση → φόρμα.
 *
 * 🔑 **Δεύτερη φωνή**: οι προσδοκίες είναι χειρόγραφοι αριθμοί.
 */

import { exchangeSeek, demandInvariantViolations, type ExchangeDemandSeek } from '@/types/property-demand';
import type { PublicListing } from '@/types/public-listing';

import { matchDemandAgainstListing } from '../demand-matching';
import { buildConcessionReport, MAX_SHARE_CONCESSION_POINTS } from '../demand-concessions';
import { axesLostProjectingDemand } from '../demand-listing-filters';
import { readStoredSeeks } from '../demand-seeks-read';
import { demandDraftFrom, demandFormSchema, EMPTY_DEMAND_FORM } from '../demand-form-values';
import { TODAY, demand, facts, listing } from './demand-fixtures';

/** Οικόπεδο προς αντιπαροχή, με το ποσοστό του οικοπεδούχου. */
function land(landownerShare: number | null): PublicListing {
  return listing({ type: 'land', offerKinds: ['exchange'], exchange: { landownerShare } });
}

/** Εργολάβος: «ψάχνω γη για αντιπαροχή, έως `max`% στον οικοπεδούχο». */
function builder(max: number | null) {
  return demand({ seeks: [exchangeSeek(max)] });
}

describe('Φ — η οροφή ποσοστού οικοπεδούχου ΚΡΙΝΕΤΑΙ', () => {
  it('35% απέναντι σε οροφή 40% ⇒ ταιριάζει, ως αντιπαροχή, 5 μονάδες περιθώριο', () => {
    const match = matchDemandAgainstListing(builder(40), facts({ listing: land(35) }), TODAY);
    expect(match.verdict).toBe('match');
    expect(match.metOn).toEqual([{ kind: 'exchange', landownerShare: 35, headroomBy: 5 }]);
  });

  it('ακριβώς στην οροφή ⇒ ταιριάζει (η οροφή είναι συμπεριληπτική)', () => {
    const match = matchDemandAgainstListing(builder(40), facts({ listing: land(40) }), TODAY);
    expect(match.verdict).toBe('match');
    expect(match.metOn).toEqual([{ kind: 'exchange', landownerShare: 40, headroomBy: 0 }]);
  });

  it('🔴 50% απέναντι σε 40% ⇒ κοντινό, `share-above`, 10 ΜΟΝΑΔΕΣ στο `shareOverBy` — ΠΟΤΕ στο `priceOverBy`', () => {
    const match = matchDemandAgainstListing(builder(40), facts({ listing: land(50) }), TODAY);
    expect(match.verdict).toBe('near-miss');
    expect(match.blockers).toEqual(['share-above']);
    expect(match.gaps.shareOverBy).toBe(10);
    expect(match.gaps.priceOverBy).toBeNull();
    expect(match.pricedAs).toBeNull();
    expect(match.metOn).toEqual([]);
  });

  it('⚖️ ποσοστό ΠΡΟΣ ΣΥΖΗΤΗΣΗ απέναντι σε οροφή ⇒ κοντινό (`share-undeclared`), ΟΧΙ απόρριψη', () => {
    const match = matchDemandAgainstListing(builder(40), facts({ listing: land(null) }), TODAY);
    expect(match.verdict).toBe('near-miss');
    expect(match.blockers).toEqual(['share-undeclared']);
  });

  it('χωρίς οροφή ⇒ το ποσοστό δεν εμποδίζει ΠΟΤΕ, όσο ψηλό κι αν είναι', () => {
    const match = matchDemandAgainstListing(builder(null), facts({ listing: land(90) }), TODAY);
    expect(match.verdict).toBe('match');
    expect(match.metOn).toEqual([{ kind: 'exchange', landownerShare: 90, headroomBy: null }]);
  });
});

describe('Υπ — η υποχώρηση μιλά σε ΜΟΝΑΔΕΣ ποσοστού, με απόλυτο όριο', () => {
  it(`+5 μονάδες ξεκλειδώνουν τα οικόπεδα έως ${40 + MAX_SHARE_CONCESSION_POINTS}% — πάνω από αυτό, καμία πρόταση`, () => {
    const subject = builder(40);
    const nearMisses = [land(43), land(45), land(52)].map(
      (item) => matchDemandAgainstListing(subject, facts({ listing: item }), TODAY),
    );
    const [ladder] = buildConcessionReport(subject, nearMisses).ladders;
    expect(ladder.concession).toBe('share-ceiling');
    expect(ladder.unit).toBe('points');
    expect(ladder.headline).toEqual({ amount: 5, unlocks: 2 });
  });
});

describe('Σ — ο σύνδεσμος «δες τα αποτελέσματα» ΛΕΕΙ ότι αγνοεί την οροφή', () => {
  it('με οροφή ⇒ `landownerShare` στις απώλειες· χωρίς οροφή ⇒ όχι', () => {
    expect(axesLostProjectingDemand(builder(40))).toContain('landownerShare');
    expect(axesLostProjectingDemand(builder(null))).not.toContain('landownerShare');
  });
});

describe('Α — ο ΙΔΙΟΣ κριτής ορίων με τη διάθεση (0, 100]', () => {
  it.each([
    [0, true],
    [150, true],
    [100, false],
    [0.5, false],
  ])('οροφή %p ⇒ εκτός εύρους: %p', (max, outOfRange) => {
    const violations = demandInvariantViolations(builder(max));
    expect(violations.includes('exchange-share-out-of-range')).toBe(outOfRange);
  });
});

describe('Ν — ανάγνωση: τα παλιά έγγραφα είναι σωστά ως έχουν (καμία μετανάστευση)', () => {
  const readExchange = (stored: unknown): ExchangeDemandSeek | 'unreadable' => {
    const read = readStoredSeeks([stored], {});
    return read.kind === 'read' ? (read.seeks[0] as ExchangeDemandSeek) : 'unreadable';
  };

  it('`{ kind: "exchange" }` (πριν την ερώτηση) ⇒ καμία οροφή', () => {
    expect(readExchange({ kind: 'exchange' })).toEqual({ kind: 'exchange', landownerShareMax: null });
  });

  it('η οροφή διαβάζεται· χαλασμένη οροφή ⇒ αδιάβαστο, ποτέ σιωπηλό «καμία οροφή»', () => {
    expect(readExchange({ kind: 'exchange', landownerShareMax: 40 })).toEqual(exchangeSeek(40));
    expect(readExchange({ kind: 'exchange', landownerShareMax: 'σαράντα' })).toBe('unreadable');
  });
});

describe('Φο — η φόρμα: η οροφή ταξιδεύει ΜΟΝΟ με επιλεγμένη αντιπαροχή', () => {
  const draftOf = (seeks: string[]) =>
    demandDraftFrom(demandFormSchema.parse({ ...EMPTY_DEMAND_FORM, seeks, exchangeShareMax: 40 }));

  it('επιλεγμένη ⇒ η εναλλακτική κουβαλά την οροφή', () => {
    expect(draftOf(['exchange']).seeks).toEqual([exchangeSeek(40)]);
  });

  it('αποεπιλεγμένη ⇒ η οροφή δεν ταξιδεύει (μένει μόνο στη φόρμα)', () => {
    expect(draftOf(['sell']).seeks.some((seek) => seek.kind === 'exchange')).toBe(false);
  });
});
