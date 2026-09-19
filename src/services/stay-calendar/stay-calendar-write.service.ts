/**
 * @fileoverview **ΚΑΘΕ ΕΓΓΡΑΦΗ ΣΤΟ ΗΜΕΡΟΛΟΓΙΟ ΚΑΤΑΛΥΜΑΤΟΣ** — μία συναλλαγή, ένας κριτής,
 *   μία κεφαλή που σειριοποιεί.
 * @related ADR-835 §20 (Στάδιο Α) · §23 (Στάδιο Δ) · §12 Κ1 · lib/stay/stay-conflict.ts ·
 *   lib/stay/stay-command-authority.ts · services/stay-calendar/stay-calendar-request-write.ts ·
 *   services/stay-calendar/stay-calendar-read.service.ts · CHECK 3.56 · CHECK 3.17
 * @module services/stay-calendar/stay-calendar-write.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ ΜΕΣΑ ΣΤΗ ΣΥΝΑΛΛΑΓΗ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **ακίνητο** + **ημερολόγιο** (κεφαλή + blocks + κρατήσεις) + η **δημόσια προβολή** όταν
 *    ενεργεί επισκέπτης — από την **ίδια** συναλλαγή
 * 2. **ποιος ενεργεί** — ο πίνακας εξουσίας (`STAY_COMMAND_AUTHORITY`) και ύστερα το κριτήριο
 *    του δρώντα: κατοχή (`mayAdminister`, 3.56) για τον οικοδεσπότη, δημόσια αγγελία για τον επισκέπτη
 * 3. η **κεφαλή του επισκέπτη** που αγγίζει η πράξη (Στάδιο Δ) — ακόμη ανάγνωση, πριν από κάθε γραφή
 * 4. **κριτής κατάληψης** πάνω στα φρέσκα (`stayCalendarConflicts`)
 * 5. **γραφή** της εγγραφής **και** `version + 1` στην κεφαλή
 *
 * Το βήμα 5 δεν είναι λογιστική: η Firestore δεν κλειδώνει εύρος ερωτήματος, και χωρίς
 * την κεφαλή δύο παράλληλα «κλείσε 10–14/10» θα περνούσαν και τα δύο (phantom insert).
 * Με την κεφαλή, η δεύτερη συναλλαγή **ξαναπαίζεται** και ο κριτής τη σταματά. Το βήμα 3 είναι
 * το ίδιο μάθημα για τον **άνθρωπο**: δύο αιτήματα σε **διαφορετικά** ακίνητα δεν μοιράζονται
 * κεφαλή ακινήτου — μοιράζονται κεφαλή επισκέπτη.
 *
 * ⚠️ **Το ίχνος και η ειδοποίηση γράφονται ΜΕΤΑ τη δέσμευση**, όπως στο
 * `mandate-acceptance.service` — ό,τι μέσα σε συναλλαγή που ξαναπαίζεται θα έγραφε πράξεις
 * που δεν έγιναν, και θα έστελνε email για αίτημα που ποτέ δεν γράφτηκε.
 */

import 'server-only';
import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { custodyOf, mayAdminister } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { wholePropertySpace } from '@/lib/spaces/space-ref';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { stayClockAt } from '@/lib/stay/stay-calendar-of';
import { actorMayIssue, stayActorPerformer, type StayActor } from '@/lib/stay/stay-command-authority';
import { stayCalendarConflicts } from '@/lib/stay/stay-conflict';
import { stayGuestHeadFromDocument, type StayGuestHead } from '@/lib/stay/stay-guest-head';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { ownerPropertyOfferKinds, type OwnerProperty } from '@/types/owner-property';
import type { PublicListing } from '@/types/public-listing';
import { STAY_CALENDAR_TIMEZONE, type StayBlock, type StayCalendarEntry, type StayCalendarHead } from '@/types/stay-calendar';
import { STAY_RULES_NONE } from '@/types/stay-rules';
import { recordStayCalendarWrite } from './stay-calendar-audit';
import { announceStayBookingNotice } from './stay-booking-notifier.service';
import { decideAnswer, decideRequest, stayGuestHeadRef } from './stay-calendar-request-write';
import { decideRestrict, decideRules, unacknowledgedWarnings } from './stay-calendar-rules-write';
import { newStayBooking, refuse, type Decision, type StayBookingNotice, type WriteContext } from './stay-calendar-write-decision';
import { readStayCalendar, stayCalendarHeadRef, stayPropertyRef } from './stay-calendar-read.service';
import { refusalOf, type StayCalendarWriteResult } from './stay-calendar-write-result';

function isStay(property: OwnerProperty): boolean {
  return ownerPropertyOfferKinds(property).includes('leaseShort');
}

// =============================================================================
// ΟΙ ΑΠΟΦΑΣΕΙΣ ΤΟΥ ΟΙΚΟΔΕΣΠΟΤΗ (Στάδιο Α) — καθαρές ως προς τα δεδομένα, γράφουν μόνο μέσω `apply`
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
    // Block του ιδιοκτήτη: καμία πηγή. Το εξωτερικό block το γεννά **μόνο** η εισαγωγή (§22).
    channel: null,
    note: command.note,
    createdBy: ctx.performedBy,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  const refusal = refusalOf(stayCalendarConflicts({ kind: 'block', block }, ctx.entries, ctx.now));
  if (refusal !== null) return refuse(refusal);
  const ref = ctx.adminDb.collection(COLLECTIONS.STAY_BLOCKS).doc(block.id);
  return { kind: 'write', entryId: block.id, apply: (tx) => tx.set(ref, block) };
}

function decideBook(ctx: WriteContext, command: Extract<StayCalendarCommand, { action: 'book' }>): Decision {
  if (!isStay(ctx.property)) return refuse({ kind: 'not-a-stay' });
  const booking = newStayBooking(ctx, {
    checkIn: command.checkIn,
    checkOut: command.checkOut,
    holder: { kind: 'offline', label: command.guestLabel },
    channel: 'direct',
    guests: command.guests,
    pets: command.pets,
    // Ο οικοδεσπότης γράφει κράτηση που **συμφώνησε αλλού** — η πλατφόρμα δεν υπόσχεται τιμή.
    price: null,
    // 🔑 Ο οικοδεσπότης **είναι** αυτός που δέχεται — η χειροκίνητη κράτηση γεννιέται επιβεβαιωμένη.
    lifecycle: 'confirmed',
    riskDisclosedAt: null,
    hold: null,
  });
  // 🔑 Ζωντανό αίτημα επισκέπτη **κλείνει** τις νύχτες και για τον οικοδεσπότη — η άρνηση το
  //    ονομάζει («αίτημα σε αναμονή ως 14:00»): πρώτα απάντησε, μετά κράτα (Στάδιο Δ, §23.4).
  const refusal = refusalOf(stayCalendarConflicts({ kind: 'booking', booking }, ctx.entries, ctx.now));
  if (refusal !== null) return refuse(refusal);
  // Επικάλυψη = σκληρή άρνηση (πάνω)· κανόνας = προειδοποίηση που ο οικοδεσπότης αποδέχεται.
  const warnings = unacknowledgedWarnings(ctx, command);
  if (warnings !== null) return warnings;
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

/**
 * **Ακύρωση ΕΠΙΒΕΒΑΙΩΜΕΝΗΣ κράτησης.** 🔴 Αίτημα **δεν** ακυρώνεται — απαντιέται (`decline`) ή
 * αποσύρεται (`withdraw`): ένα «ακυρωμένο αίτημα» θα ονόμαζε λάθος γεγονός (§4.11 #3).
 */
function decideCancel(ctx: WriteContext, bookingId: string): Decision {
  const entry = ctx.entries.find((e) => e.kind === 'booking' && e.booking.id === bookingId);
  if (entry === undefined || entry.kind !== 'booking') return refuse({ kind: 'entry-absent' });
  // Ιδιοδύναμη: ακύρωση ακυρωμένης = καμία αλλαγή, καμία άρνηση.
  if (entry.booking.lifecycle === 'cancelled') return { kind: 'write', entryId: bookingId, apply: () => undefined };
  if (entry.booking.lifecycle !== 'confirmed') return refuse({ kind: 'not-changeable', reason: 'lifecycle' });
  const ref = ctx.adminDb.collection(COLLECTIONS.STAY_BOOKINGS).doc(bookingId);
  const after = { ...entry.booking, lifecycle: 'cancelled' as const, updatedAt: ctx.now };
  return {
    kind: 'write',
    entryId: bookingId,
    // 🔴 §23.12 Ε5: κράτηση **επισκέπτη** ⇒ ο επισκέπτης μαθαίνει (μετρημένο ζωντανά: δεν μάθαινε).
    ...(after.guestUserId !== null ? { notice: { event: 'cancel' as const, booking: after } } : {}),
    apply: (tx) => tx.update(ref, { lifecycle: after.lifecycle, updatedAt: after.updatedAt }),
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
    case 'rules':
      return isStay(ctx.property) ? decideRules(command.rules) : refuse({ kind: 'not-a-stay' });
    case 'restrict':
      return isStay(ctx.property) ? decideRestrict(ctx, command) : refuse({ kind: 'not-a-stay' });
    case 'request':
      return decideRequest(ctx, command);
    case 'withdraw':
    case 'accept':
    case 'decline':
    case 'expire':
      return decideAnswer(ctx, command.action, command.bookingId);
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
    rules: decision.rules ?? head?.rules ?? STAY_RULES_NONE,
    version: (head?.version ?? 0) + 1,
    timezone: STAY_CALENDAR_TIMEZONE,
    createdAt: head?.createdAt ?? now,
    updatedAt: now,
  };
}

interface Committed {
  readonly result: StayCalendarWriteResult;
  readonly property: OwnerProperty | null;
  readonly notice: StayBookingNotice | null;
}

const refused = (result: StayCalendarWriteResult): Committed => ({ result, property: null, notice: null });

/** Ο δρώντας περνά το **δικό του** κριτήριο; — ο πίνακας εξουσίας έχει ήδη ρωτηθεί. */
function actorAdmitted(actor: StayActor, property: OwnerProperty, listing: PublicListing | null): boolean {
  switch (actor.kind) {
    case 'host':
      return mayAdminister(custodyOf(property), actor.actor);
    case 'guest':
      // Ο επισκέπτης ενεργεί **μόνο** πάνω σε ό,τι είναι δημόσια αγγελία.
      return listing !== null;
    case 'system':
      return true;
  }
}

/** Ποιου επισκέπτη την κεφαλή αγγίζει η πράξη — ή κανενός. */
function touchedGuest(actor: StayActor, command: StayCalendarCommand, entries: readonly StayCalendarEntry[]): string | null {
  if (command.action === 'request') return actor.kind === 'guest' ? actor.uid : null;
  if (command.action !== 'withdraw' && command.action !== 'accept' && command.action !== 'decline'
    && command.action !== 'expire') return null;
  const entry = entries.find((e) => e.kind === 'booking' && e.booking.id === command.bookingId);
  return entry?.kind === 'booking' ? entry.booking.guestUserId : null;
}

/** `undefined` = χαλασμένη κεφαλή (⇒ άρνηση)· `null` = δεν υπάρχει ή δεν αγγίζεται. */
async function readGuestHead(
  adminDb: AdminFirestore,
  transaction: Transaction,
  uid: string | null,
): Promise<StayGuestHead | null | undefined> {
  if (uid === null) return null;
  const snap = await transaction.get(stayGuestHeadRef(adminDb, uid));
  if (!snap.exists) return null;
  return stayGuestHeadFromDocument(snap.data(), uid) ?? undefined;
}

async function readListing(adminDb: AdminFirestore, transaction: Transaction, actor: StayActor, propertyId: string): Promise<PublicListing | null> {
  if (actor.kind !== 'guest') return null;
  // 🔑 Η ταυτότητα της δημόσιας προβολής **είναι** η ταυτότητα της αγγελίας (ADR-777 Α3).
  const snap = await transaction.get(adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(propertyId));
  return snap.exists ? publicListingFromDocument(snap.data(), snap.id) : null;
}

async function transact(
  adminDb: AdminFirestore,
  propertyId: string,
  command: StayCalendarCommand,
  actor: StayActor,
): Promise<Committed> {
  return adminDb.runTransaction(async (transaction): Promise<Committed> => {
    // Όλες οι αναγνώσεις πριν από κάθε απόφαση. Το ημερολόγιο ακινήτου που δεν διαχειρίζεσαι
    // διαβάζεται στον διακομιστή και ΠΕΤΙΕΤΑΙ — δεν φεύγει ποτέ.
    const [propertySnap, snapshot, listing] = await Promise.all([
      transaction.get(stayPropertyRef(adminDb, propertyId)),
      readStayCalendar(adminDb, propertyId, transaction),
      readListing(adminDb, transaction, actor, propertyId),
    ]);
    const property = ownerPropertyFromDocument(propertySnap.data(), propertyId);
    if (property === null || !actorMayIssue(actor, command.action) || !actorAdmitted(actor, property, listing)) {
      return refused({ kind: 'absent' });
    }
    if (snapshot.kind === 'unreadable') return refused({ kind: 'unreadable' });
    const guestHead = await readGuestHead(adminDb, transaction, touchedGuest(actor, command, snapshot.entries));
    if (guestHead === undefined) return refused({ kind: 'unreadable' });

    const now = nowISO();
    const context: WriteContext = {
      adminDb, property, head: snapshot.head, entries: snapshot.entries, months: snapshot.months,
      reading: snapshot, actor, performedBy: stayActorPerformer(actor), listing, guestHead,
      now, clock: stayClockAt(new Date(now)),
    };
    const decision = decide(context, command);
    if (decision.kind === 'refuse') return refused(decision.result);
    return commit(transaction, context, decision);
  });
}

/** **Η δέσμευση**: η εγγραφή της απόφασης **και** `version + 1` στην κεφαλή — πάντα μαζί. */
function commit(
  transaction: Transaction,
  ctx: WriteContext,
  decision: Extract<Decision, { kind: 'write' }>,
): Committed {
  const head = nextHead(ctx.property, ctx.head, decision, ctx.now);
  decision.apply(transaction);
  transaction.set(stayCalendarHeadRef(ctx.adminDb, ctx.property.id), head);
  return {
    result: { kind: 'ok', entryId: decision.entryId, version: head.version, holdExpiresAt: decision.holdExpiresAt ?? null },
    property: ctx.property,
    notice: decision.notice ?? null,
  };
}

/**
 * **Εκτελεί μία πράξη στο ημερολόγιο.** Το ίχνος και η ειδοποίηση γράφονται μόνο για δεσμευμένη πράξη.
 *
 * @param actor — ποιος ενεργεί· ο πίνακας εξουσίας (`STAY_COMMAND_AUTHORITY`) κρίνει αν επιτρέπεται.
 * @returns κλειστή έκβαση — ο καλών (διαδρομή) τη μεταφράζει σε HTTP με τον **έναν**
 *   πίνακα `STAY_CALENDAR_WRITE_STATUS`.
 */
export async function executeStayCalendarCommand(
  adminDb: AdminFirestore,
  propertyId: string,
  command: StayCalendarCommand,
  actor: StayActor,
): Promise<StayCalendarWriteResult> {
  const { result, property, notice } = await transact(adminDb, propertyId, command, actor);
  if (result.kind === 'ok' && property !== null) {
    await recordStayCalendarWrite(property, command, result.entryId, stayActorPerformer(actor));
    if (notice !== null) await announceStayBookingNotice(adminDb, property, notice);
  }
  return result;
}
