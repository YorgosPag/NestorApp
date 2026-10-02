/**
 * ADR-900 — τα ΑΚΡΟΑΤΗΡΙΑ ΙΔΙΟΚΤΗΤΗ: η αντίρρηση του ζητούντος (`ownerSignal`) και το
 * `prospective-owner` (κατώφλι 5 + βήμα 5) πάνω στον ΙΔΙΟ κριτή με το πάνελ του κατόχου.
 *
 * 🔑 Κάθε άγκυρα εκτελεί τη ΖΩΝΤΑΝΗ συνάρτηση (`discloseInterest` · `classifyDemandInterest` ·
 * `discloseDemand`) — καμία δεν ξαναγράφει την πολιτική σε αριθμούς του test.
 */

import {
  classifyDemandInterest,
  discloseInterest,
  placeInterestCensusBalances,
} from '../demand-interest';
import { DEMAND_AUDIENCES, DEMAND_DISCLOSURE } from '../demand-aggregate';
import { ownerSignalOf, signalsOwners } from '../demand-owner-signal';
import type { PropertyDemand } from '@/types/property-demand';
import { NOW_ISO, TODAY, demand, facts, listing } from './demand-fixtures';

/** Ακίνητο **χωρίς** διάθεση — η στάση της σελίδας ελέγχου ενδιαφέροντος. */
const DORMANT = facts({
  listing: listing({
    commercialStatus: 'unavailable',
    commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null },
    offerKinds: [],
  }),
});

function seekers(count: number, overrides: Partial<PropertyDemand> = {}): PropertyDemand[] {
  return Array.from({ length: count }, (_, index) => demand({ id: `dmnd_${index}`, ...overrides }));
}

function countFor(pool: readonly PropertyDemand[], audience: 'place-owner' | 'prospective-owner') {
  const { interest } = discloseInterest(DORMANT, pool, NOW_ISO, TODAY, audience);
  if (interest.stance === 'settled') throw new Error('αδύνατο: ακίνητο χωρίς διάθεση δεν είναι settled');
  return interest.disclosure;
}

describe('🔴 Υ — η αντίρρηση του ζητούντος (`ownerSignal`)', () => {
  it('απουσία πεδίου ⇒ `allowed` (έγγραφα πριν το ADR-900)', () => {
    expect(ownerSignalOf(undefined)).toBe('allowed');
    expect(ownerSignalOf(null)).toBe('allowed');
  });

  it('🔴 άγνωστη τιμή ⇒ `withheld` — η αστοχία πέφτει προς την ιδιωτικότητα', () => {
    expect(ownerSignalOf('withheld')).toBe('withheld');
    expect(ownerSignalOf('ALLOWED')).toBe('withheld');
    expect(ownerSignalOf(true)).toBe('withheld');
    expect(ownerSignalOf('allowed')).toBe('allowed');
  });

  it('ζήτηση με `withheld` ⇒ `not-countable`, ΚΑΙ ΣΤΑ ΔΥΟ ακροατήρια ιδιοκτήτη', () => {
    const withheld = demand({ ownerSignal: 'withheld' });
    expect(signalsOwners(withheld)).toBe(false);
    expect(classifyDemandInterest(withheld, DORMANT, 'dormant', NOW_ISO, TODAY)).toBe('not-countable');
  });

  it('η λογιστική κλείνει με ανάμεικτη δεξαμενή — καμία ζήτηση δεν χάνεται σιωπηλά', () => {
    const pool = [...seekers(3), ...seekers(2, { ownerSignal: 'withheld' }).map((d, i) => ({ ...d, id: `w_${i}` }))];
    const { interest, census } = discloseInterest(DORMANT, pool, NOW_ISO, TODAY);
    expect(placeInterestCensusBalances(census)).toBe(true);
    expect(census.interested).toBe(3);
    expect(census.notCountable).toBe(2);
    expect(interest.stance !== 'settled' && interest.disclosure.count).toBe(3);
  });
});

describe('🔴 Π — `prospective-owner`: κατώφλι 5 + βήμα 5, χωρίς απόδειξη κατοχής', () => {
  it.each([
    [4, null],
    [5, 5],
    [7, 5],
    [12, 10],
  ])('%i ενδιαφερόμενοι ⇒ λέγεται %p', (interested, expected) => {
    const disclosure = countFor(seekers(interested), 'prospective-owner');
    expect(disclosure.count).toBe(expected);
    expect(disclosure.audience).toBe('prospective-owner');
    expect(disclosure.minCount).toBe(5);
  });

  it('🔑 ΤΟ ΙΔΙΟ ακίνητο, ΟΙ ΙΔΙΕΣ ζητήσεις, στον κάτοχο ⇒ ακριβής αριθμός από τον 1ο', () => {
    expect(countFor(seekers(1), 'place-owner').count).toBe(1);
    expect(countFor(seekers(7), 'place-owner').count).toBe(7);
  });

  it('🔴 το βήμα κρύβει τη ΔΙΑΦΟΡΑ: 6 και 5 δίνουν την ίδια απάντηση', () => {
    expect(countFor(seekers(6), 'prospective-owner').count).toBe(countFor(seekers(5), 'prospective-owner').count);
  });

  it('η προεπιλογή του `discloseInterest` μένει `place-owner` — κανένας υπάρχων καλών δεν άλλαξε', () => {
    const { interest } = discloseInterest(DORMANT, seekers(2), NOW_ISO, TODAY);
    expect(interest.stance !== 'settled' && interest.disclosure.audience).toBe('place-owner');
  });
});

describe('Β — το βήμα είναι ΔΗΛΩΜΕΝΗ πολιτική κάθε ακροατηρίου', () => {
  it('κάθε ακροατήριο έχει ακέραιο βήμα ≥ 1, και ΜΟΝΟ το `prospective-owner` στρογγυλεύει', () => {
    for (const audience of DEMAND_AUDIENCES) {
      const { granularity } = DEMAND_DISCLOSURE[audience];
      expect(Number.isInteger(granularity) && granularity >= 1).toBe(true);
      expect(granularity > 1).toBe(audience === 'prospective-owner');
    }
  });

  it('🔑 βήμα ≤ κατώφλι — αλλιώς ένας αριθμός πάνω από το κατώφλι θα στρογγυλευόταν σε 0', () => {
    for (const audience of DEMAND_AUDIENCES) {
      const { granularity, minCount } = DEMAND_DISCLOSURE[audience];
      expect(granularity).toBeLessThanOrEqual(Math.max(minCount, 1));
    }
  });
});
