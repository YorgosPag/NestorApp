/**
 * @fileoverview **Ο ΙΔΙΟΚΤΗΤΗΣ ΒΛΕΠΕΙ ΠΡΙΝ ΠΡΟΣΠΑΘΗΣΕΙ** — οι άγκυρες του Φ5.
 * @related ADR-832 §4 · lib/mandate/mandate-occupancy-notice.ts
 *
 * 🔴 **Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ ΕΙΝΑΙ Η Ν4**: η σύγκρουση φέρνει **ημερομηνία** — δηλαδή ο
 * άνθρωπος που εμποδίζεται μαθαίνει **τι μπορεί να κάνει**, όχι μόνο ότι δεν γίνεται.
 * Χωρίς αυτήν, η οθόνη θα ήταν το *«Invalid»* των MLS με ελληνικά γράμματα.
 *
 * ⚠️ **Κανένα ρολόι, κανένα Firestore** — ο πίνακας κρίνεται στα άκρα.
 */

import {
  earliestFreeStart,
  occupancyNotice,
  visibleOccupancies,
} from '@/lib/mandate/mandate-occupancy-notice';
import {
  CANDIDATE_IS_EXCLUSIVE,
  EXISTING_IS_EXCLUSIVE,
  type MandateOccupancy,
} from '@/lib/mandate/mandate-conflict';
import { EXCLUSIVE_AGENCY, OPEN_LISTING } from '@/types/listing-agreement';
import { brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';

const NOW = '2026-08-30T12:00:00.000Z';
const UNTIL = '2027-03-12T23:59:59.999Z';

/** Οι όροι που πληκτρολογεί ο άνθρωπος — μία γραφή, κάθε δοκιμή χαλάει ΕΝΑ πράγμα. */
function candidate(over: Partial<MandateOccupancy> = {}): MandateOccupancy {
  return {
    agencyCompanyId: 'comp_ego',
    agreement: EXCLUSIVE_AGENCY,
    scope: ['sell'],
    startsAt: NOW,
    expiresAt: '2027-04-30T23:59:59.999Z',
    ...over,
  };
}

/** Μια **δεσμευτική** εντολή ξένου γραφείου, όπως ζει στο έγγραφο. */
const held = (over = {}) =>
  brokeredMandate({
    agencyCompanyId: 'comp_allo',
    agreement: EXCLUSIVE_AGENCY,
    confirmation: 'confirmed',
    scope: ['sell'],
    startsAt: '2026-08-01T00:00:00.000Z',
    expiresAt: UNTIL,
    ...over,
  });

// ============================================================================
// Ν — Η ΕΙΚΟΝΑ
// ============================================================================

describe('Ν — ο ιδιοκτήτης βλέπει ποιος κρατά, τι, και ως πότε', () => {
  it('🔑 Ν0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς εντολές είναι `free`', () => {
    expect(occupancyNotice([], candidate(), NOW)).toEqual({ kind: 'free' });
  });

  it('🔴 Ν1 — ΚΑΤΕΙΛΗΜΜΕΝΟ ΔΕΝ ΣΗΜΑΙΝΕΙ ΜΠΛΟΚΑΡΙΣΜΕΝΟ: απλή δίπλα σε απλή', () => {
    // 🔴 **Η άγκυρα που εμποδίζει το ελάττωμα του §1 να ξαναγεννηθεί στην οθόνη.**
    //    Ένα κοινό σκέλος «έχει εντολή ⇒ κόκκινο» θα ήταν το *«έχει γραφείο; τέλος»*
    //    με άλλα ρούχα — και **καμία πύλη δεν βλέπει σημασιολογία οθόνης**.
    const notice = occupancyNotice(
      [held({ agreement: OPEN_LISTING })],
      candidate({ agreement: OPEN_LISTING }),
      NOW,
    );

    expect(notice.kind).toBe('occupied');
    if (notice.kind === 'occupied') {
      expect(notice.held).toHaveLength(1);
      // 🔑 Και φέρνει **ταυτότητα**, ποτέ όνομα: η οθόνη το λύνει (ADR-832 §4 #1).
      expect(notice.held[0]?.agencyCompanyId).toBe('comp_allo');
    }
  });

  it('Ν2 — ΑΛΛΗ ΠΡΑΞΗ δεν μπλοκάρει: αποκλειστική πώλησης vs εντολή εκμίσθωσης', () => {
    const notice = occupancyNotice([held()], candidate({ scope: ['leaseOut'] }), NOW);
    expect(notice.kind).toBe('occupied');
  });

  it('🔴 Ν3 — ΔΕΥΤΕΡΗ ΑΠΟΚΛΕΙΣΤΙΚΗ: `blocked`, με ΟΛΕΣ τις συγκρούσεις', () => {
    const notice = occupancyNotice(
      [held({ agencyCompanyId: 'comp_a' }), held({ agencyCompanyId: 'comp_b' })],
      candidate(),
      NOW,
    );

    expect(notice.kind).toBe('blocked');
    if (notice.kind === 'blocked') {
      // ⚠️ **Και τα δύο**, ποτέ το πρώτο: ο άνθρωπος που εμποδίζεται από δύο γραφεία
      //    θα έλυνε το ένα, θα ξαναπροσπαθούσε, και θα συναντούσε το επόμενο.
      expect(notice.conflicts).toHaveLength(2);
      expect(notice.conflicts.every((c) => c.reason === EXISTING_IS_EXCLUSIVE)).toBe(true);
    }
  });

  it('🏆 Ν4 — Η ΑΡΝΗΣΗ ΦΕΡΝΕΙ ΗΜΕΡΟΜΗΝΙΑ: «ελεύθερο από 12/03»', () => {
    // 🏆 **ΑΥΤΟ ΕΙΝΑΙ ΤΟ «ΞΕΠΕΡΝΑΜΕ».** Το Revit λέει «το κρατά ο Χ» χωρίς ορίζοντα·
    //    τα MLS λένε «Invalid». Εδώ η άρνηση είναι **ενέργεια**.
    const notice = occupancyNotice([held()], candidate(), NOW);

    expect(notice.kind).toBe('blocked');
    if (notice.kind === 'blocked') expect(notice.availableFrom).toBe(UNTIL);
  });

  it('🏆 Ν5 — ΔΥΟ εμπόδια ⇒ η ΤΕΛΕΥΤΑΙΑ λήξη, όχι η πρώτη', () => {
    // ⚠️ Η πρώτη λήξη θα ήταν **ψεύτικη υπόσχεση**: ο άνθρωπος θα προγραμμάτιζε
    //    εντολή που θα συναντούσε το δεύτερο γραφείο.
    const later = '2027-06-30T23:59:59.999Z';
    const notice = occupancyNotice(
      [held({ agencyCompanyId: 'comp_a' }), held({ agencyCompanyId: 'comp_b', expiresAt: later })],
      candidate(),
      NOW,
    );

    if (notice.kind === 'blocked') expect(notice.availableFrom).toBe(later);
    else throw new Error('περίμενα `blocked`');
  });

  it('🔴 Ν6 — Η ΑΝΑΜΟΝΗ ΔΕΝ ΒΟΗΘΑ ΠΑΝΤΑ: `candidate-is-exclusive` ⇒ ΚΑΜΙΑ ημερομηνία', () => {
    // 🔴 Ζητά **αποκλειστική** ενώ υπάρχουν **απλές**. Το εμπόδιο δεν είναι ο χρόνος
    //    αλλά η **αξίωση** — και μια ημερομηνία εδώ θα του έλεγε να περιμένει άδικα
    //    για κάτι που μπορεί να λύσει **τώρα**, ζητώντας απλή.
    const notice = occupancyNotice(
      [held({ agreement: OPEN_LISTING })],
      candidate({ agreement: EXCLUSIVE_AGENCY }),
      NOW,
    );

    expect(notice.kind).toBe('blocked');
    if (notice.kind === 'blocked') {
      expect(notice.conflicts[0]?.reason).toBe(CANDIDATE_IS_EXCLUSIVE);
      expect(notice.availableFrom).toBeNull();
    }
  });

  it('🔴 Ν7 — ΒΛΑΒΗ ≠ ΕΛΕΥΘΕΡΟ: χαλασμένο διάστημα δίνει `undetermined`', () => {
    const notice = occupancyNotice([held({ expiresAt: 'ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ' })], candidate(), NOW);
    expect(notice.kind).toBe('undetermined');
  });

  it('Ν8 — ΧΩΡΙΣ όρους (καμία πράξη ακόμη) λέει μόνο ΠΟΙΟΣ κρατά', () => {
    // 🔑 Χωρίς `scope` δεν υπάρχει ερώτημα σύγκρουσης — και η οθόνη δεν επιτρέπεται
    //    να απαντήσει σε ερώτημα που δεν τέθηκε.
    const notice = occupancyNotice([held()], null, NOW);
    expect(notice.kind).toBe('occupied');
  });

  it('Ν9 — ΛΗΓΜΕΝΗ εντολή δεν εμφανίζεται καν: το παρελθόν δεν είναι κατάληψη', () => {
    const notice = occupancyNotice(
      [held({ startsAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-06-01T00:00:00.000Z' })],
      candidate(),
      NOW,
    );
    expect(notice).toEqual({ kind: 'free' });
  });

  it('🔴 Ν10 — Η ΜΕΛΛΟΝΤΙΚΗ ΕΝΤΟΛΗ ΦΑΙΝΕΤΑΙ, ΚΑΙ ΕΙΝΑΙ Η ΔΙΑΦΟΡΑ ΑΠΟ ΤΟ `activeMandates`', () => {
    // 🔴 Το `activeMandates` κόβει ό,τι **δεν έχει αρχίσει** — σωστό για «τι ισχύει
    //    τώρα», **λάθος** εδώ: εντολή που αρχίζει σε δύο μήνες είναι ακριβώς αυτό που
    //    ο ιδιοκτήτης πρέπει να ξέρει **πριν** προτείνει όρους.
    const future = held({
      startsAt: '2026-11-01T00:00:00.000Z',
      expiresAt: '2027-05-01T00:00:00.000Z',
    });

    expect(visibleOccupancies([future], NOW)).toHaveLength(1);
    expect(occupancyNotice([future], candidate({ expiresAt: null }), NOW).kind).toBe('blocked');
  });

  it('Ν11 — ΑΝΑΚΛΗΘΕΙΣΑ άδεια δεν κρατά τίποτα (ο κριτής είναι το `bindingMandates`)', () => {
    expect(
      occupancyNotice([held({ agencyRevokedAt: '2026-08-15T00:00:00.000Z' })], candidate(), NOW),
    ).toEqual({ kind: 'free' });
  });

  it('Ν12 — ΜΗ ΕΓΚΕΚΡΙΜΕΝΗ εντολή δεν κρατά τίποτα', () => {
    expect(occupancyNotice([held({ confirmation: 'pending' })], candidate(), NOW)).toEqual({
      kind: 'free',
    });
  });
});

// ============================================================================
// Ξ — Η ΝΩΡΙΤΕΡΗ ΕΛΕΥΘΕΡΗ ΣΤΙΓΜΗ, ΧΩΡΙΣΤΑ
// ============================================================================

describe('Ξ — `earliestFreeStart`: η διέξοδος, ή η ειλικρινής απουσία της', () => {
  const conflictWith = (expiresAt: string | null, reason = EXISTING_IS_EXCLUSIVE) =>
    ({
      with: { ...candidate({ agencyCompanyId: 'comp_allo' }), expiresAt },
      resource: 'sell' as const,
      reason,
    }) as const;

  it('Ξ1 — κενή λίστα ⇒ `null` (δεν υπάρχει τι να περιμένεις)', () => {
    expect(earliestFreeStart([])).toBeNull();
  });

  it('🔴 Ξ2 — ΑΝΟΙΧΤΗ ΔΙΑΡΚΕΙΑ ΚΑΤΑΠΙΝΕΙ ΤΟ ΜΕΓΙΣΤΟ: `null`, ποτέ η άλλη ημερομηνία', () => {
    // 🔴 Ένα `?? 0` ή ένα «αγνόησε τα `null`» εδώ θα υποσχόταν διαθεσιμότητα που
    //    **δεν υπάρχει** — ο άνθρωπος θα προγραμμάτιζε εντολή που δεν ξεκινά ποτέ.
    expect(earliestFreeStart([conflictWith(UNTIL), conflictWith(null)])).toBeNull();
  });

  it('🔴 Ξ3 — ΧΑΛΑΣΜΕΝΗ ημερομηνία ⇒ `null`, ποτέ «τώρα»', () => {
    expect(earliestFreeStart([conflictWith('ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ')])).toBeNull();
  });

  it('🔴 Ξ3α — Η ΧΑΛΑΣΜΕΝΗ ΜΟΛΥΝΕΙ ΚΑΙ ΤΙΣ ΥΓΙΕΙΣ: ποτέ «ελεύθερο από» ΜΙΣΗ γνώση', () => {
    // 🔴 **ΤΗΝ ΠΡΟΣΘΕΣΕ ΔΟΚΙΜΗ ΜΕΤΑΛΛΑΞΗΣ.** Η Ξ3 μόνη της είχε **ΕΝΑ** σκέλος, οπότε
    //    ένα `continue` στη θέση του `return null` την άφηνε **πράσινη**: το `latest`
    //    έμενε `null` έτσι κι αλλιώς. Δηλαδή η άγκυρα δεν χαρακτήριζε τον κανόνα —
    //    χαρακτήριζε το **μέγεθος της λίστας**.
    //
    // ⚠️ Με **δύο** σκέλη το λάθος γίνεται ορατό, και είναι σοβαρό: θα λέγαμε
    //    *«ελεύθερο από 12/03»* ενώ **δεν ξέρουμε** αν το δεύτερο γραφείο κρατά ως
    //    αργότερα. Ψεύτικη υπόσχεση χτισμένη σε άγνωστο (N.12) — και ο άνθρωπος θα
    //    προγραμμάτιζε εντολή που θα απορριπτόταν.
    expect(
      earliestFreeStart([conflictWith(UNTIL), conflictWith('ΟΧΙ-ΗΜΕΡΟΜΗΝΙΑ')]),
    ).toBeNull();
  });

  it('Ξ4 — μόνο τα `existing-is-exclusive` μετράνε στη μέγιστη λήξη', () => {
    expect(
      earliestFreeStart([
        conflictWith('2099-01-01T00:00:00.000Z', CANDIDATE_IS_EXCLUSIVE),
        conflictWith(UNTIL),
      ]),
    ).toBe(UNTIL);
  });
});
