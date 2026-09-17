/**
 * @fileoverview **ΚΑΘΕ ΕΓΓΡΑΦΗ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ ΚΑΤΑΛΥΜΑΤΟΣ** — μία συναλλαγή, ένας κριτής,
 *   μία κεφαλή που σειριοποιεί.
 * @related ADR-835 §20 (Στάδιο Α) · §12 Κ1 · lib/stay/stay-conflict.ts ·
 *   services/stay-calendar/stay-calendar-read.service.ts · CHECK 3.56 · CHECK 3.17
 * @module services/stay-calendar/stay-calendar-write.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ ΜΕΣΑ ΣΤΗ ΣΥΝΑΛΛΑΓΗ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **ακίνητο** → σύνορο → `mayAdminister(custodyOf(…))` — ο ΕΝΑΣ κριτής κατοχής (3.56)
 * 2. **ημερολόγιο** (κεφαλή + blocks + κρατήσεις) από την **ίδια** συναλλαγή
 * 3. **κριτής κατάληψης** πάνω στα φρέσκα (`stayCalendarConflicts`)
 * 4. **γραφή** της εγγραφής **και** `version + 1` στην κεφαλή
 *
 * Το βήμα 4 δεν είναι λογιστική: η Firestore δεν κλειδώνει εύρος ερωτήματος, και χωρίς
 * την κεφαλή δύο παράλληλα «κλείσε 10–14/10» θα περνούσαν και τα δύο (phantom insert).
 * Με την κεφαλή, η δεύτερη συναλλαγή **ξαναπαίζεται** και ο κριτής τη σταματά.
 *
 * ⚠️ **Το ίχνος γράφεται ΜΕΤΑ τη δέσμευση**, όπως στο `mandate-acceptance.service` —
 * ίχνος μέσα σε συναλλαγή που ξαναπαίζεται θα έγραφε πράξεις που δεν έγιναν.
 */

import 'server-only';
import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { custodyOf, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { wholePropertySpace } from '@/lib/spaces/space-ref';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { stayCalendarConflicts } from '@/lib/stay/stay-conflict';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { ownerPropertyOfferKinds, type OwnerProperty } from '@/types/owner-property';
import type { StayBooking } from '@/types/stay-booking';
import {
  STAY_CALENDAR_TIMEZONE,
  type StayBlock,
  type StayCalendarEntry,
  type StayCalendarHead,
} from '@/types/stay-calendar';
import { recordStayCalendarWrite } from './stay-calendar-audit';
import { readStayCalendar, stayCalendarHeadRef, stayPropertyRef } from './stay-calendar-read.service';
import { refusalOf, type StayCalendarWriteResult } from './stay-calendar-write-result';

/** Ό,τι ξέρει η συναλλαγή όταν φτάνει στην πράξη. */
interface WriteContext {
  readonly adminDb: AdminFirestore;
  readonly property: OwnerProperty;
  readonly entries: readonly StayCalendarEntry[];
  readonly actor: ListingActor;
  readonly now: string;
}

/** Η απόφαση της πράξης: άρνηση, ή τι γράφεται και ποια κεφαλή προκύπτει. */
type Decision =
  | { readonly kind: 'refuse'; readonly result: StayCalendarWriteResult }
  | {
      readonly kind: 'write';
      readonly entryId: string | null;
      readonly apply: (transaction: Transaction) => void;
      readonly declaredAt?: string | null;
    };

const refuse = (result: StayCalendarWriteResult): Decision => ({ kind: 'refuse', result });

function isStay(property: OwnerProperty): boolean {
  return ownerPropertyOfferKinds(property).includes('leaseShort');
}

// =============================================================================
// ΟΙ ΠΕΝΤΕ ΑΠΟΦΑΣΕΙΣ — καθαρές ως προς τα δεδομένα, γράφουν μόνο μέσω `apply`
// =============================================================================

function decideBlock(ctx: WriteContext, command: Extract<StayCalendarCommand, { action: 'block' }>): Decision {
  if (!isStay(ctx.property)) return refuse({ kind: 'not-a-stay' });
  const block: StayBlock = {
    id: enterpriseIdService.generateStayBlockId(),
    propertyId: ctx.property.id,
    authorUserId: ctx.property.authorUserId,
    covers: [wholePropertySpace(ctx.property.id)],
    from: command.from,
    to: command.to,
    source: 'owner',
    note: command.note,
    createdBy: ctx.actor.uid,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  const refusal = refusalOf(stayCalendarConflicts({ kind: 'block', block }, ctx.entries));
  if (refusal !== null) return refuse(refusal);
  const ref = ctx.adminDb.collection(COLLECTIONS.STAY_BLOCKS).doc(block.id);
  return { kind: 'write', entryId: block.id, apply: (tx) => tx.set(ref, block) };
}

function decideBook(ctx: WriteContext, command: Extract<StayCalendarCommand, { action: 'book' }>): Decision {
  if (!isStay(ctx.property)) return refuse({ kind: 'not-a-stay' });
  const booking: StayBooking = {
    id: enterpriseIdService.generateStayBookingId(),
    propertyId: ctx.property.id,
    offerKind: 'leaseShort',
    covers: [wholePropertySpace(ctx.property.id)],
    checkIn: command.checkIn,
    checkOut: command.checkOut,
    holder: { kind: 'offline', label: command.guestLabel },
    channel: 'direct',
    authorUserId: ctx.property.authorUserId,
    guests: command.guests,
    // 🔑 Ο οικοδεσπότης **είναι** αυτός που δέχεται — η χειροκίνητη κράτηση γεννιέται επιβεβαιωμένη.
    lifecycle: 'confirmed',
    riskDisclosedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  const refusal = refusalOf(stayCalendarConflicts({ kind: 'booking', booking }, ctx.entries));
  if (refusal !== null) return refuse(refusal);
  const ref = ctx.adminDb.collection(COLLECTIONS.STAY_BOOKINGS).doc(booking.id);
  return { kind: 'write', entryId: booking.id, apply: (tx) => tx.set(ref, booking) };
}

function decideUnblock(ctx: WriteContext, blockId: string): Decision {
  const entry = ctx.entries.find((e) => e.kind === 'block' && e.block.id === blockId);
  if (entry === undefined || entry.kind !== 'block') return refuse({ kind: 'entry-absent' });
  // Το εξωτερικό block το ανοίγει η ΠΗΓΗ του — αλλιώς το επόμενο poll θα το ξανάκλεινε.
  if (entry.block.source !== 'owner') return refuse({ kind: 'not-changeable', reason: 'external-source' });
  const ref = ctx.adminDb.collection(COLLECTIONS.STAY_BLOCKS).doc(blockId);
  return { kind: 'write', entryId: blockId, apply: (tx) => tx.delete(ref) };
}

function decideCancel(ctx: WriteContext, bookingId: string): Decision {
  const entry = ctx.entries.find((e) => e.kind === 'booking' && e.booking.id === bookingId);
  if (entry === undefined || entry.kind !== 'booking') return refuse({ kind: 'entry-absent' });
  // Ιδιοδύναμη: ακύρωση ακυρωμένης = καμία αλλαγή, καμία άρνηση.
  if (entry.booking.lifecycle === 'cancelled') return { kind: 'write', entryId: bookingId, apply: () => undefined };
  if (entry.booking.lifecycle === 'completed') return refuse({ kind: 'not-changeable', reason: 'lifecycle' });
  const ref = ctx.adminDb.collection(COLLECTIONS.STAY_BOOKINGS).doc(bookingId);
  return {
    kind: 'write',
    entryId: bookingId,
    apply: (tx) => tx.update(ref, { lifecycle: 'cancelled', updatedAt: ctx.now }),
  };
}

function decide(ctx: WriteContext, command: StayCalendarCommand): Decision {
  switch (command.action) {
    case 'declare':
      if (command.declared && !isStay(ctx.property)) return refuse({ kind: 'not-a-stay' });
      return { kind: 'write', entryId: null, apply: () => undefined, declaredAt: command.declared ? ctx.now : null };
    case 'block':
      return decideBlock(ctx, command);
    case 'unblock':
      return decideUnblock(ctx, command.blockId);
    case 'book':
      return decideBook(ctx, command);
    case 'cancel':
      return decideCancel(ctx, command.bookingId);
  }
}

// =============================================================================
// Ο ΣΚΕΛΕΤΟΣ ΤΗΣ ΣΥΝΑΛΛΑΓΗΣ
// =============================================================================

function nextHead(
  property: OwnerProperty,
  head: StayCalendarHead | null,
  decision: Extract<Decision, { kind: 'write' }>,
  now: string,
): StayCalendarHead {
  return {
    propertyId: property.id,
    authorUserId: property.authorUserId,
    // `undefined` = η πράξη δεν αγγίζει τη δήλωση· κρατά ό,τι ίσχυε.
    declaredAt: decision.declaredAt === undefined ? head?.declaredAt ?? null : decision.declaredAt,
    version: (head?.version ?? 0) + 1,
    timezone: STAY_CALENDAR_TIMEZONE,
    createdAt: head?.createdAt ?? now,
    updatedAt: now,
  };
}

interface Committed {
  readonly result: StayCalendarWriteResult;
  readonly property: OwnerProperty | null;
}

async function transact(
  adminDb: AdminFirestore,
  propertyId: string,
  command: StayCalendarCommand,
  actor: ListingActor,
): Promise<Committed> {
  return adminDb.runTransaction(async (transaction): Promise<Committed> => {
    const propertyRef = stayPropertyRef(adminDb, propertyId);
    // Όλες οι αναγνώσεις μαζί, πριν από κάθε απόφαση. Το ημερολόγιο ακινήτου που δεν
    // διαχειρίζεσαι διαβάζεται στον διακομιστή και ΠΕΤΙΕΤΑΙ — δεν φεύγει ποτέ.
    const [propertySnap, snapshot] = await Promise.all([
      transaction.get(propertyRef),
      readStayCalendar(adminDb, propertyId, transaction),
    ]);
    const property = ownerPropertyFromDocument(propertySnap.data(), propertyId);
    if (property === null || !mayAdminister(custodyOf(property), actor)) {
      return { result: { kind: 'absent' }, property: null };
    }
    if (snapshot.kind === 'unreadable') return { result: { kind: 'unreadable' }, property: null };

    const now = nowISO();
    const decision = decide({ adminDb, property, entries: snapshot.entries, actor, now }, command);
    if (decision.kind === 'refuse') return { result: decision.result, property: null };

    const head = nextHead(property, snapshot.head, decision, now);
    decision.apply(transaction);
    transaction.set(stayCalendarHeadRef(adminDb, propertyId), head);
    return { result: { kind: 'ok', entryId: decision.entryId, version: head.version }, property };
  });
}

/**
 * **Εκτελεί μία πράξη στο ημερολόγιο.** Το ίχνος γράφεται μόνο για δεσμευμένη πράξη.
 *
 * @returns κλειστή έκβαση — ο καλών (διαδρομή) τη μεταφράζει σε HTTP με τον **έναν**
 *   πίνακα `STAY_CALENDAR_WRITE_STATUS`.
 */
export async function executeStayCalendarCommand(
  adminDb: AdminFirestore,
  propertyId: string,
  command: StayCalendarCommand,
  actor: ListingActor,
): Promise<StayCalendarWriteResult> {
  const { result, property } = await transact(adminDb, propertyId, command, actor);
  if (result.kind === 'ok' && property !== null) {
    await recordStayCalendarWrite(property, command, result.entryId, actor.uid);
  }
  return result;
}
