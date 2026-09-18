/**
 * @fileoverview **ΤΑ ΑΙΤΗΜΑΤΑ ΠΟΥ ΕΛΗΞΑΝ** — καταγραφή ως `expired`, μέσα από τον ΕΝΑ γραφέα.
 * @related ADR-835 §23.1 · §23.7 · services/stay-calendar/stay-calendar-write.service.ts ·
 *   services/contact/first-contact-invitation-expiry.service.ts (το πρότυπο σάρωσης) ·
 *   services/mandate/mandate-expiry.service.ts («η λήξη είναι δομική»)
 * @module services/stay-calendar/stay-hold-expiry.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΥΤΟ ΤΟ ΠΕΡΑΣΜΑ ΔΕΝ ΕΛΕΥΘΕΡΩΝΕΙ ΝΥΧΤΕΣ — ΕΧΟΥΝ ΗΔΗ ΕΛΕΥΘΕΡΩΘΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η λήξη ισχύει **στην ανάγνωση** (`stayBookingOccupiesAt`): τη στιγμή που περνά η προθεσμία,
 * κάθε αναγνώστης (πλέγμα, μηχανή, iCal, γραφέας) βλέπει τις νύχτες ελεύθερες. Εδώ κερδίζονται
 * τρία πράγματα που η ανάγνωση **δεν** μπορεί να δώσει:
 *
 * 1. **Το γεγονός γράφεται** (`expired` + λόγος) — η οθόνη λέει «έληξε», όχι «σε αναμονή» για πάντα.
 * 2. **Οι ειδοποιήσεις φεύγουν** — «ρώτα ξανά» στον επισκέπτη, «δεν απάντησες» στον οικοδεσπότη.
 * 3. **Η κεφαλή του επισκέπτη καθαρίζει** — ζώνη και τιράντες πάνω στο «μετρά μόνο ζωντανά».
 *
 * ⇒ Αν αυτό το πέρασμα **πεθάνει**, δεν γεννιέται ούτε overbooking ούτε κλειδωμένες μέρες· απλώς
 * καθυστερούν οι ειδοποιήσεις. Γι' αυτό ο παλμός είναι 10′ (ακρίβεια ειδοποίησης), όχι ανάγκη ορθότητας.
 *
 * 🔑 **ΚΑΘΕ ΛΗΞΗ ΠΕΡΝΑ ΑΠΟ ΤΟΝ ΕΝΑ ΓΡΑΦΕΑ** (`expire`, δρώντας `system`) — ποτέ `batch.update`.
 * Μαζική ενημέρωση θα παρέκαμπτε την κεφαλή (`version + 1`), την κεφαλή του επισκέπτη, το ίχνος και
 * την ειδοποίηση, και θα έτρεχε **ανταγωνιστικά** με μια αποδοχή της ίδιας στιγμής: ο οικοδεσπότης
 * θα πατούσε «Αποδοχή» και η κράτηση θα γινόταν `expired` από κάτω του.
 */

import 'server-only';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type { StayCalendarWriteKind } from './stay-calendar-write-result';
import { executeStayCalendarCommand } from './stay-calendar-write.service';

const logger = createModuleLogger('stay-hold-expiry.service');

/** Ανώτατα αιτήματα ανά πέρασμα — το επόμενο πέρασμα (10′) παίρνει τα υπόλοιπα. */
export const STAY_HOLD_EXPIRY_SCAN_LIMIT = 200;

/** Πόσες λήξεις τρέχουν παράλληλα — διαφορετικά ακίνητα δεν συγκρούονται, ίδια ξαναπαίζονται. */
const PARALLEL_EXPIRIES = 5;

/**
 * **Η αναφορά** — κάθε κάδος εκπέμπεται **και όταν είναι μηδέν** (ίδιος κανόνας με το `mandate-expiry`).
 * ⚠️ `alreadyResolved` ≠ αποτυχία: ο οικοδεσπότης απάντησε ανάμεσα στο ερώτημα και στη συναλλαγή.
 */
export interface StayHoldExpiryReport {
  readonly considered: number;
  readonly expired: number;
  readonly alreadyResolved: number;
  readonly failed: number;
  readonly truncated: boolean;
}

/** Σε ποιον κάδο πέφτει κάθε έκβαση του γραφέα — `Record`, ώστε νέα έκβαση να μη χαθεί σιωπηλά. */
const BUCKET_OF: Readonly<Record<StayCalendarWriteKind, 'expired' | 'alreadyResolved' | 'failed'>> = {
  ok: 'expired',
  // Απαντήθηκε/αποσύρθηκε στο μεταξύ, ή η εγγραφή/αγγελία δεν υπάρχει πια — τίποτα να λήξει.
  'not-changeable': 'alreadyResolved',
  'entry-absent': 'alreadyResolved',
  absent: 'alreadyResolved',
  'not-a-stay': 'alreadyResolved',
  // 🔴 Όλα τα υπόλοιπα **δεν** μπορούν να συμβούν σε σωστή λήξη — μετριούνται ως αποτυχία, ποτέ σιωπή.
  'hold-alive': 'failed',
  unreadable: 'failed',
  conflict: 'failed',
  'rules-unacknowledged': 'failed',
  'contradictory-rules': 'failed',
  unavailable: 'failed',
  'too-late': 'failed',
  'risk-not-acknowledged': 'failed',
  'guest-hold-limit': 'failed',
  'hold-lapsed': 'failed',
  'own-listing': 'failed',
};

type Bucket = (typeof BUCKET_OF)[StayCalendarWriteKind];

async function expireOne(adminDb: AdminFirestore, propertyId: string, bookingId: string): Promise<Bucket> {
  try {
    const result = await executeStayCalendarCommand(adminDb, propertyId, { action: 'expire', bookingId }, { kind: 'system' });
    return BUCKET_OF[result.kind];
  } catch (error) {
    logger.error('Η λήξη αιτήματος απέτυχε', {
      data: { propertyId, bookingId },
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

/** **Ένα πέρασμα**: «κατέγραψε ό,τι έληξε ως τη στιγμή `at`». */
export async function expireLapsedHolds(adminDb: AdminFirestore, at: string = nowISO()): Promise<StayHoldExpiryReport> {
  // tenant-scope-exempt: μηχανή→μηχανή σάρωση **κάθε** μισθωτή (ADR-740). Η λήξη ενός αιτήματος
  // είναι γεγονός του ρολογιού, όχι του μισθωτή· άξονας εδώ θα σήμαινε ότι τα αιτήματα κάποιου
  // **δεν** λήγουν ποτέ ως γεγονός. Καμία απάντηση δεν φεύγει προς πελάτη — μόνο εντολές `expire`.
  const snapshot = await adminDb
    .collection(COLLECTIONS.STAY_BOOKINGS)
    .where('lifecycle', '==', 'requested')
    .where('hold.expiresAt', '<=', at)
    .orderBy('hold.expiresAt')
    .limit(STAY_HOLD_EXPIRY_SCAN_LIMIT + 1)
    .get();

  const docs = snapshot.docs.slice(0, STAY_HOLD_EXPIRY_SCAN_LIMIT);
  const counts: Record<Bucket, number> = { expired: 0, alreadyResolved: 0, failed: 0 };
  for (let start = 0; start < docs.length; start += PARALLEL_EXPIRIES) {
    const chunk = docs.slice(start, start + PARALLEL_EXPIRIES);
    const buckets = await Promise.all(chunk.map((doc) => {
      const propertyId: unknown = doc.data().propertyId;
      // Χωρίς ακίνητο δεν υπάρχει γραφέας να ρωτηθεί — ο αναγνώστης το λέει ήδη `unreadable`.
      return typeof propertyId === 'string' && propertyId.length > 0
        ? expireOne(adminDb, propertyId, doc.id)
        : Promise.resolve<Bucket>('failed');
    }));
    for (const bucket of buckets) counts[bucket] += 1;
  }
  return {
    considered: docs.length,
    ...counts,
    truncated: snapshot.docs.length > STAY_HOLD_EXPIRY_SCAN_LIMIT,
  };
}
