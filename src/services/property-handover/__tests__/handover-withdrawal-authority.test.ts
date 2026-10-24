/**
 * @jest-environment node
 *
 * =============================================================================
 * ⚖️ ΑΓΚΥΡΑ Ζ53 — Ο ΕΝΑΣ ΓΡΑΦΕΑΣ της ανάκλησης παράδοσης (ADR-916 §5.19 Φ-Δ.5)
 * =============================================================================
 *
 * Ο κανόνας κλείνει **ολόκληρη** τη συλλογή στον πελάτη (`property_handovers`: `write: if false`). Δεν βλέπει το **Admin
 * SDK**: ένας δεύτερος γραφέας θα ανακαλούσε χωρίς αιτιολογία, χωρίς ίχνος, χωρίς την κρίση Ο4 — ή θα «αναστούσε» μια
 * ανακλημένη (το `withdrawn` είναι τερματικό μόνο επειδή **ένα** σχέδιο το σέβεται).
 *
 * | #  | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Η4 | γράφει κανείς `withdrawal` / `withdrawal.notice` σε έγγραφο παράδοσης εκτός των δύο γραφέων; | δεύτερος γραφέας |
 * | Η5 | ο σαρωτής ΒΛΕΠΕΙ γραφή (αυτοέλεγχος — αλλιώς το Η4 είναι πράσινο από τύφλωση) | σαρωτής που δεν πιάνει τίποτα |
 * | Η6 | γράφει κανείς `lifecycle: 'withdrawn'` εκτός της ΜΙΑΣ καθαρής κρίσης; | ανάκληση που παρακάμπτει το Ο4 |
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { codeSourcesMentioning, REPO_ROOT, writesKeyIn } from '@/test-utils/one-writer-anchor';

/** Ο γραφέας της συμφιλίωσης (μετάβαση + ανάκληση) και οι γραφές προόδου (έκβαση ειδοποίησης, CAS). */
const WRITERS = [
  'src/services/property-handover/property-handover-write.service.ts',
  'src/services/property-handover/property-handover-progress-write.ts',
];
const PLAN = 'src/lib/property-handover/handover-withdrawal-plan.ts';
const KEY = /(?:\bwithdrawal\s*:|['"]withdrawal\.notice['"]\s*:)/;
const HANDOVER_DOCUMENT = /PROPERTY_HANDOVERS|handoverDocRef|property_handovers/;

describe('Η — ο ΕΝΑΣ γραφέας της ανάκλησης', () => {
  it('Η4 — κανένας τρίτος γραφέας σε έγγραφο παράδοσης', () => {
    const candidates = codeSourcesMentioning(['withdrawal'])
      .filter((file) => HANDOVER_DOCUMENT.test(readFileSync(join(REPO_ROOT, file), 'utf8')));
    expect(candidates).toEqual(expect.arrayContaining(WRITERS));
    const offenders = candidates
      .filter((file) => !WRITERS.includes(file))
      .filter((file) => writesKeyIn(readFileSync(join(REPO_ROOT, file), 'utf8'), KEY));
    expect(offenders).toEqual([]);
  });

  it('Η5 — ο σαρωτής ΒΛΕΠΕΙ γραφή: οι γραφές προόδου πιάνονται, όπως και τα συνήθη σχήματα', () => {
    expect(writesKeyIn(readFileSync(join(REPO_ROOT, WRITERS[1]), 'utf8'), KEY)).toBe(true);
    expect(writesKeyIn("tx.update(ref, { lifecycle: 'withdrawn', withdrawal: { reason } });", KEY)).toBe(true);
    expect(writesKeyIn("await ref.set({ ...rest, 'withdrawal.notice': null }, { merge: true });", KEY)).toBe(true);
    expect(writesKeyIn('const notice = handover.withdrawal?.notice ?? null;', KEY)).toBe(false);
  });

  it("Η6 — η μετάβαση `withdrawn` γεννιέται ΜΟΝΟ στην καθαρή κρίση (Ο4 · ιδεμπότητα · αιτιολογία)", () => {
    const transition = /lifecycle\s*:\s*'withdrawn'/;
    const producers = codeSourcesMentioning(["'withdrawn'"])
      // Μόνο ο τομέας της παράδοσης: το `withdrawn` είναι λέξη και άλλων λεξιλογίων (αγγελία · προσφορά · κράτηση).
      .filter((file) => /property-handover|handover-/.test(file) || HANDOVER_DOCUMENT.test(readFileSync(join(REPO_ROOT, file), 'utf8')))
      .filter((file) => transition.test(readFileSync(join(REPO_ROOT, file), 'utf8')));
    expect(producers.filter((file) => file !== PLAN && !file.includes('/testing/'))).toEqual([]);
    expect(producers).toContain(PLAN);
  });
});
