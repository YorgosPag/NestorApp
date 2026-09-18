/**
 * @fileoverview **ΟΙ ΑΠΟΦΑΣΕΙΣ ΤΟΥ ΑΙΤΗΜΑΤΟΣ** — αίτημα · απόσυρση · αποδοχή · άρνηση · λήξη.
 * @related ADR-835 §23.4 · §4.11 · §20.3 · services/stay-calendar/stay-calendar-write.service.ts ·
 *   lib/stay/stay-request-preview.ts · lib/stay/stay-guest-head.ts · lib/stay/stay-command-authority.ts
 * @module services/stay-calendar/stay-calendar-request-write
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΘΕ ΜΕΤΑΒΑΣΗ ΕΧΕΙ ΔΙΚΟ ΤΗΣ ΟΝΟΜΑ — ΚΑΙ ΚΑΘΕ ΛΑΘΟΣ ΜΕΤΑΒΑΣΗ ΔΙΚΗ ΤΗΣ ΑΡΝΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Από | Πράξη | Σε | Όταν |
 * |---|---|---|---|
 * | — | `request` (επισκέπτης) | `requested` | η **ίδια** μηχανή λέει «μπορείς», υπάρχει τίμια προθεσμία, χωρά στο όριό του |
 * | `requested` | `accept` (οικοδεσπότης) | `confirmed` | το hold **ζει** και ο κριτής ξανατρέχει καθαρός |
 * | `requested` | `decline` (οικοδεσπότης) | `declined` | το hold **ζει** |
 * | `requested` | `withdraw` (επισκέπτης) | `withdrawn` | το hold **ζει** και είναι **δικό του** |
 * | `requested` | `expire` (σύστημα) | `expired` | το hold **έχει λήξει** |
 *
 * 🔑 **Ληγμένο hold ⇒ ΜΟΝΟ `expire`.** Αποδοχή μετά τη λήξη θα έδινε νύχτες που μπορεί ήδη να
 * ζήτησε άλλος· άρνηση ή απόσυρση μετά τη λήξη θα **ονόμαζε λάθος** ένα γεγονός που ήδη έγινε
 * (§4.11 #3: *«η σιωπή δεν είναι όχι»*). Η ίδια πράξη πάνω στην ίδια κατάσταση-στόχο ⇒ **ιδιοδύναμη**.
 *
 * **Layering**: καθαρές ως προς τα δεδομένα· γράφουν **μόνο** μέσω `apply`.
 */

import 'server-only';
import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { stayCalendarConflicts } from '@/lib/stay/stay-conflict';
import {
  guestHeadWithHold,
  guestHeadWithoutHold,
  guestHoldLimitReached,
  STAY_GUEST_MAX_ACTIVE_HOLDS,
} from '@/lib/stay/stay-guest-head';
import { isStayable } from '@/lib/stay/stay-availability-vocabulary';
import { stayRequestPreview } from '@/lib/stay/stay-request-preview';
import { ownerPropertyOfferKinds } from '@/types/owner-property';
import { stayHoldLivesAt, type StayBooking, type StayResolution } from '@/types/stay-booking';

import { alreadyDone, newStayBooking, refuse, type Decision, type WriteContext } from './stay-calendar-write-decision';
import { refusalOf } from './stay-calendar-write-result';

type RequestCommand = Extract<StayCalendarCommand, { action: 'request' }>;
type AnswerAction = 'accept' | 'decline' | 'withdraw' | 'expire';

/** `stay_guests/{uid}` — η κεφαλή του επισκέπτη (§23.4). */
export function stayGuestHeadRef(adminDb: AdminFirestore, uid: string): DocumentReference {
  return adminDb.collection(COLLECTIONS.STAY_GUESTS).doc(uid);
}

function bookingRef(ctx: WriteContext, bookingId: string): DocumentReference {
  return ctx.adminDb.collection(COLLECTIONS.STAY_BOOKINGS).doc(bookingId);
}

/** Το νέο αίτημα, **πριν** κριθεί — ό,τι θα γραφτεί αν περάσει. */
function requestedBooking(
  ctx: WriteContext,
  command: RequestCommand,
  guest: { readonly uid: string; readonly displayName: string | null },
  hold: NonNullable<StayBooking['hold']>,
  riskDisclosedAt: string | null,
): StayBooking {
  return newStayBooking(ctx, {
    checkIn: command.checkIn,
    checkOut: command.checkOut,
    holder: { kind: 'user', userId: guest.uid, displayName: guest.displayName },
    channel: 'platform',
    guests: command.guests,
    lifecycle: 'requested',
    riskDisclosedAt,
    hold,
  });
}

/**
 * **Το αίτημα.** Κρίνεται από την **ίδια** σύνθεση που έδειξε η σελίδα (`stayRequestPreview`),
 * πάνω σε **φρέσκα** δεδομένα της συναλλαγής — η υπόσχεση της οθόνης ξαναϋπολογίζεται εδώ.
 */
export function decideRequest(ctx: WriteContext, command: RequestCommand): Decision {
  const guest = ctx.actor;
  if (guest.kind !== 'guest' || ctx.listing === null) return refuse({ kind: 'absent' });
  if (!ownerPropertyOfferKinds(ctx.property).includes('leaseShort')) return refuse({ kind: 'not-a-stay' });
  // Ο οικοδεσπότης κλείνει μέρες από το ημερολόγιό του — ποτέ αίτημα στη δική του αγγελία.
  if (ctx.property.authorUserId === guest.uid) return refuse({ kind: 'own-listing' });

  const query = { checkIn: command.checkIn, checkOut: command.checkOut, guests: command.guests };
  const { answer, hold } = stayRequestPreview(ctx.listing, ctx.reading, ctx.clock, query);
  if (!isStayable(answer.kind)) return refuse({ kind: 'unavailable', answer: answer.kind });
  if (hold === null || hold.kind === 'too-late') return refuse({ kind: 'too-late' });
  // 🔑 Η αποκάλυψη είναι **γεγονός** (§4.7): γράφεται μόνο αν ειπώθηκε **και** αποδέχτηκε.
  const conditional = answer.kind === 'conditional';
  if (conditional && !command.riskAcknowledged) return refuse({ kind: 'risk-not-acknowledged' });
  if (guestHoldLimitReached(ctx.guestHead, ctx.now)) {
    return refuse({ kind: 'guest-hold-limit', limit: STAY_GUEST_MAX_ACTIVE_HOLDS });
  }

  const booking = requestedBooking(ctx, command, guest, {
    expiresAt: hold.expiresAt, tier: hold.tier, bound: hold.bound, respondentUserId: ctx.property.authorUserId,
  }, conditional ? ctx.now : null);
  // Ζώνη και τιράντες: ο **ΕΝΑΣ** κριτής, πάνω στην ίδια την εγγραφή που θα γραφτεί.
  const refusal = refusalOf(stayCalendarConflicts({ kind: 'booking', booking }, ctx.entries, ctx.now));
  if (refusal !== null) return refuse(refusal);

  const head = guestHeadWithHold(ctx.guestHead, guest.uid, {
    bookingId: booking.id, propertyId: booking.propertyId, expiresAt: hold.expiresAt,
  }, ctx.now);
  return {
    kind: 'write',
    entryId: booking.id,
    holdExpiresAt: hold.expiresAt,
    notice: { event: 'request', booking },
    apply: (tx) => {
      tx.set(bookingRef(ctx, booking.id), booking);
      tx.set(stayGuestHeadRef(ctx.adminDb, guest.uid), head);
    },
  };
}

/** Η κατάσταση-στόχος κάθε απάντησης — ιδιοδύναμο όταν η κράτηση **είναι ήδη** εκεί. */
const TARGET: Readonly<Record<AnswerAction, StayBooking['lifecycle']>> = {
  accept: 'confirmed',
  decline: 'declined',
  withdraw: 'withdrawn',
  expire: 'expired',
};

function resolutionOf(action: AnswerAction, at: string): StayResolution | null {
  switch (action) {
    case 'accept':
      return null;
    case 'decline':
      return { lifecycle: 'declined', at };
    case 'withdraw':
      return { lifecycle: 'withdrawn', at };
    case 'expire':
      return { lifecycle: 'expired', at, reason: 'no-answer' };
  }
}

/** Ζει το hold; — και αν η απάντηση **ταιριάζει** με αυτό. Μόνο η λήξη θέλει νεκρό hold. */
function holdGate(action: AnswerAction, booking: StayBooking, now: string): Decision | null {
  const lives = booking.hold !== null && stayHoldLivesAt(booking.hold, now);
  if (action === 'expire') return lives ? refuse({ kind: 'hold-alive' }) : null;
  return lives ? null : refuse({ kind: 'hold-lapsed' });
}

/**
 * **Η απάντηση σε αίτημα** — από τον οικοδεσπότη, τον επισκέπτη ή το σύστημα.
 * Ο δρώντας έχει ήδη εγκριθεί από τον πίνακα εξουσίας· εδώ κρίνεται **η κατάσταση**.
 */
export function decideAnswer(ctx: WriteContext, action: AnswerAction, bookingId: string): Decision {
  const entry = ctx.entries.find((e) => e.kind === 'booking' && e.booking.id === bookingId);
  if (entry === undefined || entry.kind !== 'booking') return refuse({ kind: 'entry-absent' });
  const { booking } = entry;
  // Ο επισκέπτης αποσύρει **μόνο** το δικό του — άλλο αίτημα ⇒ «δεν υπάρχει» (καμία διαρροή).
  if (ctx.actor.kind === 'guest' && booking.guestUserId !== ctx.actor.uid) return refuse({ kind: 'absent' });
  if (booking.lifecycle === TARGET[action]) return alreadyDone(bookingId);
  if (booking.lifecycle !== 'requested') return refuse({ kind: 'not-changeable', reason: 'lifecycle' });
  const gate = holdGate(action, booking, ctx.now);
  if (gate !== null) return gate;

  const after: StayBooking = {
    ...booking, lifecycle: TARGET[action], resolution: resolutionOf(action, ctx.now), updatedAt: ctx.now,
  };
  if (action === 'accept') {
    // 🔴 Ο κριτής **ξανατρέχει** μέσα στη συναλλαγή — το `occupancyId` εξαιρεί την ίδια την κράτηση.
    const refusal = refusalOf(stayCalendarConflicts({ kind: 'booking', booking: after }, ctx.entries, ctx.now));
    if (refusal !== null) return refuse(refusal);
  }
  const guestUid = booking.guestUserId;
  return {
    kind: 'write',
    entryId: bookingId,
    notice: { event: action, booking: after },
    apply: (tx) => {
      tx.update(bookingRef(ctx, bookingId), {
        lifecycle: after.lifecycle, resolution: after.resolution, updatedAt: after.updatedAt,
      });
      if (guestUid !== null) {
        tx.set(stayGuestHeadRef(ctx.adminDb, guestUid), guestHeadWithoutHold(ctx.guestHead, guestUid, bookingId, ctx.now));
      }
    },
  };
}
