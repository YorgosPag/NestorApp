/**
 * @fileoverview Άγκυρες της **απάντησης** — πέντε ονόματα, και η λήξη που δεν βλέπει ζώνη.
 * @related ADR-838 §4.6 · ADR-835 §17 · §18.8 (Μ22: «πράσινη επειδή τυφλή»)
 *
 * 🔴 **ΤΙ ΣΚΟΤΩΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ:**
 *
 * | # | Μετάλλαξη | Άγκυρα |
 * |---|---|---|
 * | Μ1 | `isExpiredOn`: `>` → `>=` (η τελευταία μέρα πετιέται έξω) | Ε5 |
 * | Μ2 | `isExpiredOn`: `utcDateOf` → σύγκριση χιλιοστών | Ε5 · Ε6 |
 * | Μ3 | `isExpiredOn`: `getUTCDate` → τοπική ημέρα *(η ΤΥΦΛΗ μετάλλαξη της Φ3)* | Ε6 |
 * | Μ4 | αδιάβαστη ημερομηνία ⇒ `declared` αντί για `expiry-unknown` | Ε7 |
 * | Μ5 | κενό σύνολο χώρων ⇒ `declared` | Ε8 |
 * | Μ6 | `strongestCovering`: διαλέγει το **νεότερο** αντί για το **ισχυρότερο** | Ε9 |
 * | Μ7 | η πύλη τιμής (`valueDisclosure`) φεύγει από το `legalitySignalFor` | Ε4 |
 * | Μ8 | `legalitySignalsFor`: παραλείπει τα `not-applicable` | Ε10 |
 */

import type { LegalityClaim } from '../legality-claim';
import { LEGALITY_CLAIM_KINDS } from '../legality-claim';
import {
  isExpiredOn,
  legalitySignalFor,
  legalitySignalsFor,
  LEGALITY_SIGNAL_STATES,
} from '../legality-signal';

const P = 'prop_a0000001';
const WHOLE = [{ propertyId: P, spaceId: null }];
const ROOM_A = [{ propertyId: P, spaceId: 'room-a' }];
const NOW = '2026-08-31T10:00:00.000Z';

function claim(over: Partial<LegalityClaim> = {}): LegalityClaim {
  return {
    kind: 'short-stay-registry',
    subject: WHOLE,
    tier: 'self-declared',
    value: 'ΑΜΑ-1',
    authority: null,
    assertedAt: '2026-08-01T00:00:00.000Z',
    validUntil: null,
    ...over,
  };
}

describe('Ε1 — το λεξιλόγιο των απαντήσεων', () => {
  it('πέντε καταστάσεις, χωρίς διπλότυπα', () => {
    expect(LEGALITY_SIGNAL_STATES).toHaveLength(5);
    expect(new Set(LEGALITY_SIGNAL_STATES).size).toBe(5);
  });

  it('🔴 καμία κατάσταση δεν λέει «νόμιμο» ή «μη νόμιμο»', () => {
    for (const state of LEGALITY_SIGNAL_STATES as readonly string[]) {
      expect(state).not.toMatch(/legal|compliant|valid$/i);
    }
  });
});

describe('Ε2 — καμία αξίωση ⇒ `undeclared`, ΠΟΤΕ σιωπή', () => {
  it('άδειος κατάλογος', () => {
    expect(legalitySignalFor([], 'short-stay-registry', WHOLE, NOW)).toEqual({
      state: 'undeclared',
      kind: 'short-stay-registry',
    });
  });

  it('αξίωση ΑΛΛΟΥ είδους δεν απαντά σε αυτό το ερώτημα', () => {
    const other = claim({ kind: 'energy-performance', tier: 'self-declared' });
    expect(legalitySignalFor([other], 'short-stay-registry', WHOLE, NOW).state).toBe('undeclared');
  });

  it('🔴 αξίωση ΔΩΜΑΤΙΟΥ δεν απαντά για ΟΛΟΚΛΗΡΟ — η κάλυψη είναι ασύμμετρη', () => {
    const roomClaim = claim({ subject: ROOM_A, value: 'ΑΜΑ-2' });
    expect(legalitySignalFor([roomClaim], 'short-stay-registry', WHOLE, NOW).state).toBe(
      'undeclared'
    );
    // …ενώ για το ίδιο το δωμάτιο απαντά κανονικά.
    expect(legalitySignalFor([roomClaim], 'short-stay-registry', ROOM_A, NOW).state).toBe(
      'declared'
    );
  });
});

describe('Ε3 — `declared`: η βαθμίδα και η στιγμή ταξιδεύουν μαζί', () => {
  it('επιστρέφει βαθμίδα, τιμή και ημερομηνία δήλωσης', () => {
    const signal = legalitySignalFor([claim()], 'short-stay-registry', WHOLE, NOW);
    expect(signal).toEqual({
      state: 'declared',
      kind: 'short-stay-registry',
      tier: 'self-declared',
      value: 'ΑΜΑ-1',
      assertedAt: '2026-08-01T00:00:00.000Z',
    });
  });
});

describe('Ε4 — 🔴 Η ΠΥΛΗ ΤΗΣ ΤΙΜΗΣ ΖΕΙ ΕΔΩ, ΜΙΑ ΦΟΡΑ', () => {
  it('ο ΑΜΑ δημοσιεύει τον αριθμό του — ο νόμος το ΑΠΑΙΤΕΙ', () => {
    const signal = legalitySignalFor([claim()], 'short-stay-registry', WHOLE, NOW);
    expect(signal.state === 'declared' && signal.value).toBe('ΑΜΑ-1');
  });

  it('🔴 η ταυτότητα κτιρίου ΜΗΔΕΝΙΖΕΙ την τιμή, όσο κι αν υπάρχει στο δεδομένο', () => {
    // Χωρίς την πύλη εδώ, κάθε καταναλωτής θα αποφάσιζε μόνος του — και θα αρκούσε
    // ΕΝΑΣ να ξεχάσει, στο σημείο όπου η αστοχία λέγεται «δημοσιεύσαμε έγγραφο».
    const identity = claim({
      kind: 'building-identity',
      tier: 'professional-attested',
      authority: 'Μηχανικός ΤΕΕ 12345',
      value: 'ΗΤΚ-987654',
      validUntil: '2026-12-31',
    });
    const signal = legalitySignalFor([identity], 'building-identity', WHOLE, NOW);
    expect(signal.state).toBe('declared');
    expect(signal.state === 'declared' && signal.value).toBeNull();
  });
});

describe('Ε5 — 🔴 Η ΛΗΞΗ, ΚΑΙ ΤΟ ΙΣΟΝ ΠΟΥ ΑΝΗΚΕΙ ΜΕΣΑ', () => {
  it('η ΤΕΛΕΥΤΑΙΑ μέρα ισχύος είναι ακόμη σε ισχύ', () => {
    // `>=` αντί για `>` θα κήρυσσε ληγμένο έγγραφο που ισχύει όλη τη μέρα.
    expect(isExpiredOn('2026-08-31', '2026-08-31T00:00:00.000Z')).toBe(false);
    expect(isExpiredOn('2026-08-31', '2026-08-31T23:59:59.000Z')).toBe(false);
  });

  it('η ΕΠΟΜΕΝΗ μέρα είναι λήξη', () => {
    expect(isExpiredOn('2026-08-31', '2026-09-01T00:00:00.000Z')).toBe(true);
  });

  it('αδιάβαστη ημερομηνία ⇒ `null`, ΠΟΤΕ `false`', () => {
    // Ένα `false` θα μετέτρεπε το ΔΥΣΑΝΑΓΝΩΣΤΟ σε ΕΓΚΥΡΟ.
    expect(isExpiredOn('όχι ημερομηνία', NOW)).toBeNull();
    expect(isExpiredOn('2026-08-31', 'όχι ημερομηνία')).toBeNull();
  });
});

describe('Ε6 — 🔴 Η ΤΥΦΛΗ ΜΕΤΑΛΛΑΞΗ ΤΗΣ Φ3: η ζώνη της ΜΗΧΑΝΗΣ δεν κρίνει τη λήξη', () => {
  it('23:00 UTC της τελευταίας μέρας: ΔΕΝ έχει λήξει (σε UTC+3 είναι ήδη αύριο)', () => {
    // Σε τοπική ανάγνωση με θετική μετατόπιση (Αθήνα, UTC+3) αυτό γίνεται 01/09
    // ⇒ η μετάλλαξη `getUTCDate()`→`getDate()` θα απαντούσε **έληξε**.
    expect(isExpiredOn('2026-08-31', '2026-08-31T23:00:00.000Z')).toBe(false);
  });

  it('01:00 UTC της επόμενης: ΕΧΕΙ λήξει (σε UTC-5 είναι ακόμη χθες)', () => {
    // Το άλλο σκέλος — ώστε η άγκυρα να μην είναι ημιτελής σε καμία μετατόπιση.
    expect(isExpiredOn('2026-08-31', '2026-09-01T01:00:00.000Z')).toBe(true);
  });
});

describe('Ε7 — η λήξη μέσα στην απάντηση', () => {
  const identity = (validUntil: string | null): LegalityClaim =>
    claim({
      kind: 'building-identity',
      tier: 'professional-attested',
      authority: 'Μηχανικός ΤΕΕ 12345',
      value: null,
      validUntil,
    });

  it('ληγμένη ⇒ `expired`, με την ημέρα ως την οποία ίσχυε', () => {
    const signal = legalitySignalFor([identity('2026-07-31')], 'building-identity', WHOLE, NOW);
    expect(signal).toEqual({
      state: 'expired',
      kind: 'building-identity',
      tier: 'professional-attested',
      expiredAfter: '2026-07-31',
    });
  });

  it('σε ισχύ ⇒ `declared`', () => {
    expect(
      legalitySignalFor([identity('2026-12-31')], 'building-identity', WHOLE, NOW).state
    ).toBe('declared');
  });

  it('🔴 είδος που ΛΗΓΕΙ χωρίς δηλωμένη ισχύ ⇒ `expiry-unknown`, ποτέ `declared`', () => {
    // Το κενό είναι ΔΙΚΟ ΜΑΣ (δεν ρωτήσαμε) και έχει δικό του όνομα — ένα `declared`
    // εδώ θα υπόσχονταν ισχύ που κανείς δεν βεβαίωσε.
    expect(legalitySignalFor([identity(null)], 'building-identity', WHOLE, NOW).state).toBe(
      'expiry-unknown'
    );
  });

  it('αδιάβαστη ισχύς ⇒ `expiry-unknown`, ποτέ `declared`', () => {
    expect(
      legalitySignalFor([identity('κάποτε')], 'building-identity', WHOLE, NOW).state
    ).toBe('expiry-unknown');
  });

  it('είδος που ΔΕΝ λήγει αγνοεί το `validUntil` — ο ΑΜΑ δεν λήγει', () => {
    expect(
      legalitySignalFor([claim({ validUntil: '2020-01-01' })], 'short-stay-registry', WHOLE, NOW)
        .state
    ).toBe('declared');
  });
});

describe('Ε8 — 🔴 κενό σύνολο χώρων: ΑΛΓΕΒΡΑ ≠ ΛΕΞΙΛΟΓΙΟ (ADR-835 §17)', () => {
  it('«ρώτησες για κανέναν χώρο» δεν είναι «όλα δηλωμένα»', () => {
    // Το `spaceSetCovers` με κενό στόχο δίνει `true` (κενή σύζευξη) — σωστή άλγεβρα.
    // Ο φρουρός ζει ΕΔΩ, αλλιώς μια αγγελία χωρίς χώρους θα φαινόταν δηλωμένη.
    expect(legalitySignalFor([claim()], 'short-stay-registry', [], NOW).state).toBe('undeclared');
  });
});

describe('Ε9 — δύο αξιώσεις: κερδίζει η ΙΣΧΥΡΟΤΕΡΗ, όχι η νεότερη', () => {
  it('η `registry-verified` υπερισχύει, ανεξάρτητα από σειρά και ημερομηνία', () => {
    const weakButNewer = claim({
      tier: 'self-declared',
      assertedAt: '2026-08-30T00:00:00.000Z',
      value: 'ΑΜΑ-ΛΑΘΟΣ',
    });
    const strongButOlder = claim({
      tier: 'registry-verified',
      authority: 'ΑΑΔΕ',
      assertedAt: '2026-01-01T00:00:00.000Z',
      value: 'ΑΜΑ-ΣΩΣΤΟ',
    });

    for (const order of [
      [weakButNewer, strongButOlder],
      [strongButOlder, weakButNewer],
    ]) {
      const signal = legalitySignalFor(order, 'short-stay-registry', WHOLE, NOW);
      expect(signal.state === 'declared' && signal.tier).toBe('registry-verified');
      expect(signal.state === 'declared' && signal.value).toBe('ΑΜΑ-ΣΩΣΤΟ');
    }
  });
});

describe('Ε10 — 🔴 Ο ΠΛΗΡΗΣ ΠΑΡΟΝΟΜΑΣΤΗΣ: γραμμή και για ό,τι ΔΕΝ αφορά', () => {
  it('τέσσερα είδη ⇒ τέσσερις γραμμές, ΠΑΝΤΑ, με σταθερή σειρά', () => {
    const signals = legalitySignalsFor([], ['leaseShort'], WHOLE, NOW, LEGALITY_CLAIM_KINDS);
    expect(signals.map((s) => s.kind)).toEqual([...LEGALITY_CLAIM_KINDS]);
  });

  it('όσα δεν σηκώνονται παίρνουν `not-applicable` — όχι σιωπή, όχι `undeclared`', () => {
    // Η διαφορά «δεν αφορά» / «δεν δηλώθηκε» είναι η διαφορά ανάμεσα σε «κανένα θέμα»
    // και «ο κάτοχος δεν απάντησε». Η παράλειψη θα ισοπέδωνε τις δύο σε σιωπή.
    const signals = legalitySignalsFor([], ['leaseShort'], WHOLE, NOW, LEGALITY_CLAIM_KINDS);
    const byKind = new Map(signals.map((s) => [s.kind, s.state]));
    expect(byKind.get('building-identity')).toBe('not-applicable');
    expect(byKind.get('arbitrary-settlement')).toBe('not-applicable');
    expect(byKind.get('short-stay-registry')).toBe('undeclared');
    // Το ΠΕΑ είναι ΑΝΑΠΑΝΤΗΤΟ κελί ⇒ σηκώνεται, και απαντά «δεν δηλώθηκε».
    expect(byKind.get('energy-performance')).toBe('undeclared');
  });

  it('η πώληση δεν ρωτά ποτέ για ΑΜΑ', () => {
    const signals = legalitySignalsFor([], ['sell'], WHOLE, NOW, LEGALITY_CLAIM_KINDS);
    const ama = signals.find((s) => s.kind === 'short-stay-registry');
    expect(ama?.state).toBe('not-applicable');
  });
});
