/**
 * @fileoverview **Η ΕΙΣΑΓΩΓΗ ΜΙΑΣ ΠΗΓΗΣ** — η διαφορά γράφεται **μέσα** στη συναλλαγή
 *   της κεφαλής, με `version + 1` **μόνο** όταν άλλαξε κάτι.
 * @related ADR-835 §22 (Στάδιο Γ) · §6.4 · §20.5 · lib/stay/stay-channel-reconcile.ts ·
 *   services/stay-calendar/stay-channel-fetch.ts · services/stay-calendar/stay-calendar-read.service.ts
 * @module services/stay-calendar/stay-channel-import.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΚΑΙ ΤΟ ΠΡΩΤΟ ΒΗΜΑ ΕΙΝΑΙ **ΕΞΩ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **δίκτυο** (έξω από κάθε συναλλαγή — η συναλλαγή ξαναπαίζεται)
 * 2. **συναλλαγή**: ημερολόγιο + κανάλια από την **ίδια** ανάγνωση
 * 3. **συμφιλίωση** (καθαρή) → πράξεις πάνω σε εξωτερικά blocks
 * 4. **γραφή**: blocks + κατάσταση πηγής + `version + 1` **αν** υπάρχει διαφορά
 *
 * 🔑 **Καμία διαφορά ⇒ καμία γραφή, ούτε στο `version`.** Η δημοσκόπηση τρέχει κάθε 30′
 * ανά πηγή: ένα `version + 1` σε κάθε πέρασμα θα δημιουργούσε **τεχνητό ανταγωνισμό**
 * με τις πράξεις του ιδιοκτήτη (η δική του συναλλαγή θα ξαναέπαιζε χωρίς λόγο).
 *
 * 🔴 **Η ΣΥΓΚΡΟΥΣΗ ΔΕΝ ΜΠΛΟΚΑΡΕΙ ΤΗΝ ΕΙΣΑΓΩΓΗ.** Εισαγόμενη κατάληψη πάνω σε κράτησή
 * μας είναι **γεγονός που έγινε** (§22): γράφεται, και **ονομάζεται** στον ιδιοκτήτη από
 * το `stayChannelConflicts`. Άρνηση θα έκρυβε το overbooking αντί να το λύσει.
 */

import 'server-only';
import type { Firestore as AdminFirestore, Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { wholePropertySpace } from '@/lib/spaces/space-ref';
import { stayClockAt } from '@/lib/stay/stay-calendar-of';
import {
  reconcileStayChannelFeed,
  type StayChannelBlockPlan,
} from '@/lib/stay/stay-channel-reconcile';
import { earliestPollAt, instantAfterMinutes, nextPollAtFor } from '@/lib/stay/stay-channel-health';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import {
  STAY_CALENDAR_TIMEZONE,
  type StayBlock,
  type StayCalendarEntry,
  type StayCalendarHead,
} from '@/types/stay-calendar';
import { STAY_RULES_NONE } from '@/types/stay-rules';
import {
  STAY_CHANNEL_MANUAL_SYNC_MINUTES,
  type StayChannelFeed,
  type StayChannelFeedStatus,
  type StayChannels,
} from '@/types/stay-channels';

import { readStayChannelFeed, type StayChannelRead } from './stay-channel-fetch';
import { readStayCalendar, stayCalendarHeadRef, stayChannelsRef } from './stay-calendar-read.service';

const logger = createModuleLogger('stay-channel-import');

/** Τι έγινε σε μία εισαγωγή — για το ίχνος, τη λογιστική και την οθόνη. */
export interface StayChannelImportOutcome {
  readonly feedId: string;
  readonly created: number;
  readonly updated: number;
  readonly deleted: number;
  readonly pending: number;
  readonly failure: StayChannelFeedStatus['lastFailure'];
  /** `false` = το ημερολόγιο δεν διαβάστηκε ⇒ **τίποτα** δεν γράφτηκε (§6.4). */
  readonly applied: boolean;
}

const EMPTY_COUNTS = { created: 0, updated: 0, deleted: 0, pending: 0 } as const;

// =============================================================================
// 1. ΟΙ ΠΡΑΞΕΙΣ ΩΣ ΓΡΑΦΕΣ
// =============================================================================

function externalBlockOf(
  plan: Extract<StayChannelBlockPlan, { kind: 'create' }>,
  feed: StayChannelFeed,
  property: { readonly id: string; readonly authorUserId: string },
  now: string,
): StayBlock {
  return {
    id: plan.id,
    propertyId: property.id,
    authorUserId: property.authorUserId,
    covers: [wholePropertySpace(property.id)],
    from: plan.from,
    to: plan.to,
    source: 'external',
    channel: { feedId: feed.id, externalUid: plan.uid },
    // 🔴 **Ποτέ σημείωση από το feed**: το `SUMMARY` του καναλιού μπορεί να κουβαλά
    //    στοιχεία επισκέπτη (η Airbnb βάζει σύνδεσμο κράτησης και 4 ψηφία τηλεφώνου).
    note: null,
    createdBy: feed.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}

function applyPlan(
  transaction: Transaction,
  adminDb: AdminFirestore,
  plan: readonly StayChannelBlockPlan[],
  context: {
    readonly feed: StayChannelFeed;
    readonly property: { readonly id: string; readonly authorUserId: string };
    readonly now: string;
  },
): void {
  const blocks = adminDb.collection(COLLECTIONS.STAY_BLOCKS);
  for (const step of plan) {
    if (step.kind === 'create') {
      transaction.set(blocks.doc(step.id), externalBlockOf(step, context.feed, context.property, context.now));
      continue;
    }
    if (step.kind === 'update') {
      transaction.update(blocks.doc(step.id), {
        from: step.from,
        to: step.to,
        channel: { feedId: context.feed.id, externalUid: step.uid },
        updatedAt: context.now,
      });
      continue;
    }
    transaction.delete(blocks.doc(step.id));
  }
}

// =============================================================================
// 2. Η ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΠΗΓΗΣ
// =============================================================================

function statusAfterSuccess(
  feed: StayChannelFeed,
  read: Extract<StayChannelRead, { kind: 'events' | 'not-modified' }>,
  eventCount: number,
  now: string,
): StayChannelFeedStatus {
  return {
    ...feed.status,
    lastAttemptAt: now,
    lastSuccessAt: now,
    // 🔑 Η **τελευταία** αποτυχία μένει γραμμένη: ο ιδιοκτήτης βλέπει «έσπασε στις 3, ξαναδουλεύει».
    consecutiveFailures: 0,
    eventCount: read.kind === 'events' ? eventCount : feed.status.eventCount,
    etag: read.kind === 'events' ? read.etag : feed.status.etag,
    lastModified: read.kind === 'events' ? read.lastModified : feed.status.lastModified,
    nextPollAt: nextPollAtFor(0, now),
  };
}

function statusAfterFailure(
  feed: StayChannelFeed,
  read: Extract<StayChannelRead, { kind: 'failed' }>,
  now: string,
): StayChannelFeedStatus {
  const consecutiveFailures = feed.status.consecutiveFailures + 1;
  return {
    ...feed.status,
    lastAttemptAt: now,
    lastFailure: { at: now, failure: read.failure, httpStatus: read.httpStatus },
    consecutiveFailures,
    nextPollAt: nextPollAtFor(consecutiveFailures, now),
  };
}

function withFeed(doc: StayChannels, feed: StayChannelFeed): StayChannels {
  const feeds = doc.feeds.map((candidate) => (candidate.id === feed.id ? feed : candidate));
  // Το «πότε ξαναρωτάμε» είναι **μία** διατύπωση (`earliestPollAt`): δεύτερη εδώ θα
  // αποκλίνει την ημέρα που αλλάξει ο κανόνας, και τότε το cron θα σταματούσε να ρωτά.
  return { ...doc, feeds, nextPollAt: earliestPollAt(feeds), updatedAt: feed.status.lastAttemptAt ?? doc.updatedAt };
}

function nextHead(
  propertyId: string,
  authorUserId: string,
  head: StayCalendarHead | null,
  now: string,
): StayCalendarHead {
  return {
    propertyId,
    authorUserId,
    declaredAt: head?.declaredAt ?? null,
    rules: head?.rules ?? STAY_RULES_NONE,
    version: (head?.version ?? 0) + 1,
    timezone: STAY_CALENDAR_TIMEZONE,
    createdAt: head?.createdAt ?? now,
    updatedAt: now,
  };
}

// =============================================================================
// 3. Η ΣΥΝΑΛΛΑΓΗ
// =============================================================================

function blocksOfFeed(entries: readonly StayCalendarEntry[], feedId: string): readonly StayBlock[] {
  return entries
    .filter((entry) => entry.kind === 'block' && entry.block.channel?.feedId === feedId)
    .map((entry) => (entry.kind === 'block' ? entry.block : null))
    .filter((block): block is StayBlock => block !== null);
}

function countsOf(plan: readonly StayChannelBlockPlan[]): { created: number; updated: number; deleted: number } {
  return {
    created: plan.filter((step) => step.kind === 'create').length,
    updated: plan.filter((step) => step.kind === 'update').length,
    deleted: plan.filter((step) => step.kind === 'delete').length,
  };
}

/**
 * **Εφαρμόζει μία ανάγνωση πηγής.** Το δίκτυο έχει **ήδη** τρέξει: εδώ μόνο βάση.
 *
 * @returns τι άλλαξε — ή `applied: false` όταν το ημερολόγιο δεν διαβάζεται.
 */
export async function applyStayChannelRead(
  adminDb: AdminFirestore,
  propertyId: string,
  feedId: string,
  read: StayChannelRead,
): Promise<StayChannelImportOutcome> {
  return adminDb.runTransaction(async (transaction): Promise<StayChannelImportOutcome> => {
    const snapshot = await readStayCalendar(adminDb, propertyId, transaction);
    if (snapshot.kind === 'unreadable') {
      // 🔴 Ό,τι δεν διαβάζεται **δεν** διορθώνεται με γραφή: ούτε blocks, ούτε κατάσταση.
      return { feedId, ...EMPTY_COUNTS, failure: null, applied: false };
    }
    const doc = snapshot.channelDoc;
    const feed = doc?.feeds.find((candidate) => candidate.id === feedId);
    if (doc === null || feed === undefined) {
      return { feedId, ...EMPTY_COUNTS, failure: null, applied: false };
    }

    const now = nowISO();
    if (read.kind === 'failed') {
      const status = statusAfterFailure(feed, read, now);
      transaction.set(stayChannelsRef(adminDb, propertyId), withFeed(doc, { ...feed, status }));
      return { feedId, ...EMPTY_COUNTS, failure: status.lastFailure, applied: true };
    }

    return applySuccess(transaction, { adminDb, propertyId, feed, doc, snapshot, read, now });
  });
}

/** Ό,τι χρειάζεται η επιτυχής εφαρμογή — μαζί, ώστε η υπογραφή να μένει μία γραμμή. */
interface SuccessContext {
  readonly adminDb: AdminFirestore;
  readonly propertyId: string;
  readonly feed: StayChannelFeed;
  readonly doc: StayChannels;
  readonly snapshot: Extract<Awaited<ReturnType<typeof readStayCalendar>>, { kind: 'readable' }>;
  readonly read: Extract<StayChannelRead, { kind: 'events' | 'not-modified' }>;
  readonly now: string;
}

/** Η διαφορά μιας **επιτυχούς** ανάγνωσης — η μόνη διαδρομή που αγγίζει νύχτες. */
function applySuccess(transaction: Transaction, ctx: SuccessContext): StayChannelImportOutcome {
  const { adminDb, propertyId, feed, doc, snapshot, read, now } = ctx;
  // 🔑 `not-modified`: το κανάλι λέει «τίποτα δεν άλλαξε» ⇒ **καμία** συμφιλίωση.
  const reconciliation = read.kind === 'not-modified'
    ? { plan: [], pendingRemovals: feed.pendingRemovals, eventCount: feed.status.eventCount }
    : reconcileStayChannelFeed({
      feedId: feed.id,
      events: read.events,
      existing: blocksOfFeed(snapshot.entries, feed.id),
      pendingRemovals: feed.pendingRemovals,
      today: stayClockAt(new Date(now)).today,
      now,
      blockIdOf: (source, uid) => enterpriseIdService.generateDeterministicStayExternalBlockId(source, uid),
    });

  const property = { id: propertyId, authorUserId: doc.authorUserId };
  applyPlan(transaction, adminDb, reconciliation.plan, { feed, property, now });
  const status = statusAfterSuccess(feed, read, reconciliation.eventCount, now);
  transaction.set(
    stayChannelsRef(adminDb, propertyId),
    withFeed(doc, { ...feed, status, pendingRemovals: reconciliation.pendingRemovals }),
  );
  // Το `version` αυξάνεται **μόνο** όταν οι νύχτες άλλαξαν — δες την κεφαλίδα.
  if (reconciliation.plan.length > 0) {
    transaction.set(
      stayCalendarHeadRef(adminDb, propertyId),
      nextHead(propertyId, doc.authorUserId, snapshot.head, now),
    );
  }
  return {
    feedId: feed.id,
    ...countsOf(reconciliation.plan),
    pending: Object.keys(reconciliation.pendingRemovals).length,
    failure: null,
    applied: true,
  };
}

/**
 * **Δημοσκοπεί μία πηγή**: δίκτυο → συναλλαγή. Η **μία** διαδρομή, για το cron και για
 * το «συγχρονισμός τώρα» της οθόνης.
 */
export async function importStayChannelFeed(
  adminDb: AdminFirestore,
  propertyId: string,
  feed: StayChannelFeed,
): Promise<StayChannelImportOutcome> {
  const read = await readStayChannelFeed(feed);
  const outcome = await applyStayChannelRead(adminDb, propertyId, feed.id, read);
  if (outcome.failure !== null) {
    logger.warn('Πηγή ημερολογίου δεν διαβάστηκε', {
      data: { propertyId, feedId: feed.id, channel: feed.channel, failure: outcome.failure.failure },
    });
  }
  return outcome;
}

/**
 * **Αφαίρεση πηγής** — η πηγή **και** οι νύχτες της, σε **μία** συναλλαγή.
 *
 * 🔴 **Καμία «διαγραφή με δύο αναγνώσεις» εδώ, και είναι απόφαση**: εκείνη φυλάει από
 * **σιωπηλό** άνοιγμα νυχτών όταν ένα feed στέλνει κολοβό σώμα. Εδώ ο άνθρωπος **ζήτησε
 * ρητά** να φύγει η σύνδεση — το να κρατούσαμε τις νύχτες θα ήταν κλεισμένες μέρες
 * **χωρίς πηγή που μπορεί να τις ανοίξει** (το `decideUnblock` αρνείται το εξωτερικό).
 *
 * 🔑 Η **αφαίρεση των blocks** ανοίγει νύχτες ⇒ `version + 1` **πάντα** όταν υπήρχαν.
 */
export async function removeStayChannelFeed(
  adminDb: AdminFirestore,
  propertyId: string,
  feedId: string,
): Promise<'ok' | 'feed-absent' | 'unreadable'> {
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await readStayCalendar(adminDb, propertyId, transaction);
    if (snapshot.kind === 'unreadable') return 'unreadable';
    const doc = snapshot.channelDoc;
    if (doc === null || !doc.feeds.some((feed) => feed.id === feedId)) return 'feed-absent';

    const now = nowISO();
    const blocks = blocksOfFeed(snapshot.entries, feedId);
    for (const block of blocks) {
      transaction.delete(adminDb.collection(COLLECTIONS.STAY_BLOCKS).doc(block.id));
    }
    const feeds = doc.feeds.filter((feed) => feed.id !== feedId);
    transaction.set(stayChannelsRef(adminDb, propertyId), {
      ...doc,
      feeds,
      nextPollAt: earliestPollAt(feeds),
      updatedAt: now,
    });
    if (blocks.length > 0) {
      transaction.set(
        stayCalendarHeadRef(adminDb, propertyId),
        nextHead(propertyId, doc.authorUserId, snapshot.head, now),
      );
    }
    return 'ok';
  });
}

/** Επιτρέπεται **τώρα** χειροκίνητος συγχρονισμός αυτής της πηγής; (φρένο κατάχρησης) */
export function manualSyncAllowedAt(feed: StayChannelFeed, now: string): boolean {
  const last = feed.status.lastAttemptAt;
  return last === null || instantAfterMinutes(last, STAY_CHANNEL_MANUAL_SYNC_MINUTES) <= now;
}
