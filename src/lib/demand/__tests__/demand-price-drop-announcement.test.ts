/**
 * @fileoverview **ΠΟΤΕ ΛΕΓΕΤΑΙ ΜΙΑ ΜΕΙΩΣΗ** — το κλειδί, το είδος και η ετυμηγορία.
 * @related ADR-777 §8.69 · lib/demand/demand-announcement.ts
 */

import { MS_PER_DAY } from '@/lib/date-local';
import type { PriceReduction } from '@/types/price-history';
import type { DemandSeek } from '@/types/property-demand';
import { seek } from './demand-fixtures';

/** Οι εναλλακτικές **μίας** ζήτησης με όριο **πώλησης** (ο ρόλος της `REDUCTION`) — `null` = χωρίς όριο. */
function saleCaps(...caps: (number | null)[]): DemandSeek[][] {
  return caps.map((max) => (max === null ? [seek('sell')] : [seek('sell', { max })]));
}

import {
  demandListingMatchEventId,
  demandPriceDropEventId,
  priceDropKind,
  priceDropVerdict,
  recipientListingMatchEventId,
  recipientPriceDropEventId,
  strongestBudgetVerdict,
} from '../demand-announcement';

const SINCE = '2026-09-10T08:00:00.000Z';
const SINCE_MS = Date.parse(SINCE);

const REDUCTION: PriceReduction = {
  role: 'sale',
  from: 3_490_000,
  to: 3_200_000,
  dropBasisPoints: 830,
  since: SINCE,
};

describe('Κ — το κλειδί της μείωσης', () => {
  it('Κ1 — η ΙΔΙΑ μείωση δίνει το ΙΔΙΟ κλειδί (το `create()` σιωπά την επανάληψη)', () => {
    expect(demandPriceDropEventId('d1', 'l1', REDUCTION)).toBe(demandPriceDropEventId('d1', 'l1', { ...REDUCTION }));
  });

  it('🔴 Κ2 — δεύτερη μείωση της ίδιας αγγελίας ⇒ ΑΛΛΟ κλειδί', () => {
    const second = { ...REDUCTION, to: 2_990_000, since: '2026-09-20T08:00:00.000Z' };
    expect(demandPriceDropEventId('d1', 'l1', second)).not.toBe(demandPriceDropEventId('d1', 'l1', REDUCTION));
  });

  it('🔴 Κ3 — ΙΔΙΟ ποσό σε ΑΛΛΗ στιγμή είναι άλλη μείωση', () => {
    const again = { ...REDUCTION, since: '2026-10-01T08:00:00.000Z' };
    expect(demandPriceDropEventId('d1', 'l1', again)).not.toBe(demandPriceDropEventId('d1', 'l1', REDUCTION));
  });

  it('Κ4 — δεν συγκρούεται ΠΟΤΕ με το κλειδί του ταιριάσματος', () => {
    expect(demandPriceDropEventId('d1', 'l1', REDUCTION)).not.toBe(demandListingMatchEventId('d1', 'l1'));
  });
});

describe('Ε — το είδος της μείωσης για τη ζήτηση', () => {
  it('🏆 Ε1 — ξεπερνούσε το όριο και τώρα χωράει ⇒ «μπήκε στον προϋπολογισμό»', () => {
    expect(priceDropKind(3_300_000, REDUCTION)).toBe('into-budget');
  });

  it('Ε2 — χωρούσε ήδη ⇒ απλή μείωση', () => {
    expect(priceDropKind(4_000_000, REDUCTION)).toBe('within-budget');
  });

  it('Ε3 — ζήτηση χωρίς ανώτατο όριο ⇒ απλή μείωση', () => {
    expect(priceDropKind(null, REDUCTION)).toBe('within-budget');
  });

  it('Ε4 — ακριβώς στο όριο μετά τη μείωση ⇒ χωράει', () => {
    expect(priceDropKind(3_200_000, REDUCTION)).toBe('into-budget');
  });
});

describe('Θ — §8.69.12: η ταυτότητα είναι ΘΕΜΑ (παραλήπτης, αγγελία), όχι ζήτηση', () => {
  it('🔴 Θ1 — το κλειδί θέματος ΔΕΝ περιέχει ζήτηση (δύο ζητήσεις ⇒ ΕΝΑ κλειδί)', () => {
    expect(recipientListingMatchEventId('l1')).toBe('listing:l1');
    expect(recipientPriceDropEventId('l1', REDUCTION)).toBe(`listing:l1:price-drop:${REDUCTION.to}@${SINCE}`);
  });

  it('Θ2 — ποτέ σύγκρουση με τα legacy κλειδιά ανά ζήτηση', () => {
    expect(recipientListingMatchEventId('l1')).not.toBe(demandListingMatchEventId('d1', 'l1'));
    expect(recipientPriceDropEventId('l1', REDUCTION)).not.toBe(demandPriceDropEventId('d1', 'l1', REDUCTION));
  });

  it('Θ3 — ταίριασμα ≠ μείωση για το ίδιο θέμα', () => {
    expect(recipientPriceDropEventId('l1', REDUCTION)).not.toBe(recipientListingMatchEventId('l1'));
  });
});

describe('Β — ο ΕΝΑΣ κριτής προϋπολογισμού πάνω σε όλους τους λόγους', () => {
  it('🏆 Β1 — into-budget για ΜΙΑ από τις ζητήσεις ⇒ into-budget', () => {
    expect(strongestBudgetVerdict(saleCaps(4_000_000, 3_300_000), REDUCTION)).toEqual({ kind: 'into-budget', priceMax: 3_300_000, reasonIndex: 1 });
  });

  it('🔴 Β2 — πολλά into-budget ⇒ το ΑΥΣΤΗΡΟΤΕΡΟ όριο (ποτέ υπόσχεση μεγαλύτερου περιθωρίου)', () => {
    expect(strongestBudgetVerdict(saleCaps(3_400_000, 3_250_000, 3_300_000), REDUCTION)).toEqual({
      kind: 'into-budget',
      priceMax: 3_250_000,
      // ADR-887 — ο δείκτης της ζήτησης με το αυστηρότερο όριο: το όνομά ΤΗΣ λέγεται στον τίτλο.
      reasonIndex: 1,
    });
  });

  it('Β3 — όριο κάτω από τη νέα τιμή ΔΕΝ κερδίζει (δεν είναι into-budget για εκείνη)', () => {
    expect(strongestBudgetVerdict(saleCaps(3_000_000, 3_300_000), REDUCTION)).toEqual({ kind: 'into-budget', priceMax: 3_300_000, reasonIndex: 1 });
  });

  it('Β4 — καμία into-budget / κανένα όριο ⇒ within-budget', () => {
    expect(strongestBudgetVerdict(saleCaps(null, 4_000_000), REDUCTION)).toEqual({ kind: 'within-budget' });
    expect(strongestBudgetVerdict([], REDUCTION)).toEqual({ kind: 'within-budget' });
  });

  it('🔴 Β5 — ADR-777 §8.60.15: μείωση ΕΝΟΙΚΙΟΥ κρίνεται ΜΟΝΟ απέναντι σε όριο ενοικίου', () => {
    const rentDrop: PriceReduction = { ...REDUCTION, role: 'rent', from: 1_100, to: 950 };
    // Ζήτηση «αγορά έως 250.000 € ή ενοικίαση έως 1.000 €/μήνα».
    const both = [[seek('sell', { max: 250_000 }), seek('leaseOut', { max: 1_000 })]];
    expect(strongestBudgetVerdict(both, rentDrop)).toEqual({ kind: 'into-budget', priceMax: 1_000, reasonIndex: 0 });
    // Μόνο όριο **πώλησης** ⇒ η μείωση ενοικίου δεν «μπαίνει» σε κανέναν προϋπολογισμό.
    // (Πριν: το αμονάδιστο 250.000 έκανε κάθε ενοίκιο «εντός».)
    expect(strongestBudgetVerdict([[seek('sell', { max: 250_000 })]], rentDrop)).toEqual({
      kind: 'within-budget',
    });
  });
});

describe('Ψ — η ετυμηγορία', () => {
  const NOW = SINCE_MS + MS_PER_DAY;

  it('Ψ1 — ο ζητών δεν έμαθε ποτέ για την αγγελία ⇒ λέγεται', () => {
    expect(priceDropVerdict(REDUCTION, { kind: 'never-announced' }, NOW)).toBe('announce');
  });

  it('🔴 Ψ2 — ταίριασμα ανακοινωμένο ΠΡΙΝ τη μείωση ⇒ λέγεται (η τιμή που ξέρει άλλαξε)', () => {
    expect(priceDropVerdict(REDUCTION, { kind: 'announced', atMs: SINCE_MS - 1 }, NOW)).toBe('announce');
  });

  it('🔴 Ψ3 — ταίριασμα ανακοινωμένο ΜΕΤΑ τη μείωση ⇒ σιωπή (το είδε ήδη μειωμένη)', () => {
    expect(priceDropVerdict(REDUCTION, { kind: 'announced', atMs: SINCE_MS + 1 }, NOW)).toBe('predates-match');
  });

  it('Ψ4 — ανακοινωμένο με άγνωστη στιγμή ⇒ σιωπή, ποτέ διπλό email', () => {
    expect(priceDropVerdict(REDUCTION, { kind: 'announced', atMs: null }, NOW)).toBe('predates-match');
  });

  it('Ψ5 — σήμανση που έληξε ⇒ `stale`, ακόμη κι αν ο ζητών δεν έμαθε ποτέ', () => {
    const late = SINCE_MS + 31 * MS_PER_DAY;
    expect(priceDropVerdict(REDUCTION, { kind: 'never-announced' }, late)).toBe('stale');
  });
});
