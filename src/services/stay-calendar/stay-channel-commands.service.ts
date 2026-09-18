/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΟΥ ΙΔΙΟΚΤΗΤΗ ΠΑΝΩ ΣΤΑ ΚΑΝΑΛΙΑ** — προσθήκη (με
 *   **υποχρεωτική** πρώτη ανάγνωση), αφαίρεση, χειροκίνητος συγχρονισμός, ανάκληση
 *   συνδέσμων — και η προβολή της οθόνης.
 * @related ADR-835 §22 (Στάδιο Γ) · CHECK 3.56 (ο ΕΝΑΣ κριτής κατοχής) ·
 *   lib/stay/stay-channel-command.ts · services/stay-calendar/stay-channel-import.service.ts
 * @module services/stay-calendar/stay-channel-commands.service
 *
 * 🔑 **Ο κριτής κατοχής είναι ο ΕΝΑΣ**: `mayAdminister(custodyOf(property))` — ποτέ
 * `authorUserId === uid` (γραφείο: άλλος υπάλληλος). `absent` και για «δεν υπάρχει» και
 * για «δεν το διαχειρίζεσαι»: η άρνηση δεν αποκαλύπτει ύπαρξη.
 *
 * 🔴 **Η ΠΡΟΣΘΗΚΗ ΔΙΑΒΑΖΕΙ ΠΡΙΝ ΑΠΟΘΗΚΕΥΣΕΙ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Πηγή που δεν
 * πέτυχε ποτέ είναι `stale` (δες `stayChannelFreshnessAt`) ⇒ **όλη** η αγγελία θα έλεγε
 * «η διαθεσιμότητα δεν επιβεβαιώνεται». Ένα τυπογραφικό λάθος στο URL δεν επιτρέπεται να
 * βγάλει κατάλυμα από την αγορά: ο σύνδεσμος που δεν διαβάζεται **δεν αποθηκεύεται**, και
 * ο λόγος λέγεται. (Η αγορά αποθηκεύει και δείχνει «Warning» — Guesty.)
 */

import 'server-only';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { nowISO } from '@/lib/date-local';
import { publicUrl } from '@/lib/http/public-origin';
import { custodyOf, mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { stayClockAt } from '@/lib/stay/stay-calendar-of';
import { stayChannelConflicts } from '@/lib/stay/stay-channel-conflicts';
import {
  earliestPollAt,
  stayChannelFreshnessAt,
  stayChannelKindOfUrl,
} from '@/lib/stay/stay-channel-health';
import type {
  StayChannelCommand,
  StayChannelFeedView,
  StayChannelsView,
  StayChannelWriteResult,
} from '@/lib/stay/stay-channel-command';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { ownerPropertyOfferKinds, type OwnerProperty } from '@/types/owner-property';
import {
  STAY_CHANNEL_ACCEPTS_IMPORT,
  STAY_CHANNEL_MAX_FEEDS,
  STAY_CHANNEL_STATUS_NEW,
  type StayChannelFeed,
  type StayChannels,
} from '@/types/stay-channels';

import { readStayChannelFeed } from './stay-channel-fetch';
import {
  applyStayChannelRead,
  manualSyncAllowedAt,
  removeStayChannelFeed,
} from './stay-channel-import.service';
import { readStayCalendar, stayChannelsRef, stayPropertyRef } from './stay-calendar-read.service';
import {
  stayExportConfigured,
  stayExportToken,
  STAY_EXPORT_SCOPE_ALL,
} from './stay-channel-export.service';

/** Η δημόσια διαδρομή του feed — **μία** διατύπωση, εδώ και στη διαδρομή. */
export function stayIcalPath(token: string): string {
  return `/api/stay-ical/${encodeURIComponent(`${token}.ics`)}`;
}

function exportUrlFor(propertyId: string, scope: string, generation: number): string | null {
  const token = stayExportToken(propertyId, scope, generation);
  return token === null ? null : publicUrl(stayIcalPath(token));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isStay(property: OwnerProperty): boolean {
  return ownerPropertyOfferKinds(property).includes('leaseShort');
}

/** Το ακίνητο **αν το διαχειρίζεσαι** — ένας κριτής, μία απάντηση. */
async function administrableProperty(
  adminDb: AdminFirestore,
  propertyId: string,
  actor: ListingActor,
): Promise<OwnerProperty | null> {
  const snap = await stayPropertyRef(adminDb, propertyId).get();
  const property = ownerPropertyFromDocument(snap.data(), propertyId);
  return property !== null && mayAdminister(custodyOf(property), actor) ? property : null;
}

// =============================================================================
// 1. Η ΠΡΟΒΟΛΗ
// =============================================================================

function feedViewOf(feed: StayChannelFeed, propertyId: string, generation: number, now: string): StayChannelFeedView {
  return {
    id: feed.id,
    label: feed.label,
    host: hostOf(feed.url),
    channel: feed.channel,
    acceptsImport: STAY_CHANNEL_ACCEPTS_IMPORT[feed.channel],
    freshness: stayChannelFreshnessAt(feed.status, now),
    lastSuccessAt: feed.status.lastSuccessAt,
    lastFailureAt: feed.status.lastFailure?.at ?? null,
    lastFailure: feed.status.lastFailure?.failure ?? null,
    eventCount: feed.status.eventCount,
    // 🏆 Ο σύνδεσμος **αυτής** της πηγής: χωρίς τα δικά της γεγονότα ⇒ κανένας κύκλος.
    exportUrl: exportUrlFor(propertyId, feed.id, generation),
  };
}

/**
 * **Η οθόνη των καναλιών** — ή `absent` (δεν υπάρχει / δεν το διαχειρίζεσαι).
 */
export async function readStayChannelsView(
  adminDb: AdminFirestore,
  propertyId: string,
  actor: ListingActor,
): Promise<StayChannelsView | { readonly kind: 'absent' }> {
  const property = await administrableProperty(adminDb, propertyId, actor);
  if (property === null) return { kind: 'absent' };

  const snapshot = await readStayCalendar(adminDb, propertyId, null);
  if (snapshot.kind === 'unreadable') return { kind: 'unreadable' };

  const now = nowISO();
  const generation = snapshot.channelDoc?.exportGeneration ?? 0;
  const feeds = snapshot.channelDoc?.feeds ?? [];
  return {
    kind: 'readable',
    exportConfigured: stayExportConfigured(),
    exportUrl: exportUrlFor(propertyId, STAY_EXPORT_SCOPE_ALL, generation),
    feeds: feeds.map((feed) => feedViewOf(feed, propertyId, generation, now)),
    conflicts: stayChannelConflicts(snapshot.entries, stayClockAt(new Date(now))),
  };
}

// =============================================================================
// 2. ΟΙ ΠΡΑΞΕΙΣ
// =============================================================================

function channelsDocOf(existing: StayChannels | null, property: OwnerProperty, now: string): StayChannels {
  return existing ?? {
    propertyId: property.id,
    authorUserId: property.authorUserId,
    // 🔴 **ΓΕΝΙΑ 0, ΟΧΙ 1**: η προβολή υπογράφει με `exportGeneration ?? 0` **πριν** υπάρξει
    //    έγγραφο. Ξεκινώντας από 1, ο σύνδεσμος που ο άνθρωπος αντέγραψε **πριν** προσθέσει
    //    την πρώτη πηγή θα πέθαινε τη στιγμή της προσθήκης — ανάκληση που κανείς δεν ζήτησε.
    exportGeneration: 0,
    feeds: [],
    nextPollAt: '9999-12-31T00:00:00.000Z',
    createdAt: now,
    updatedAt: now,
  };
}

function writeChannels(adminDb: AdminFirestore, propertyId: string, doc: StayChannels, now: string): Promise<unknown> {
  return stayChannelsRef(adminDb, propertyId).set({
    ...doc,
    nextPollAt: earliestPollAt(doc.feeds),
    updatedAt: now,
  });
}

/**
 * **Προσθήκη πηγής**: υπογραφή σχήματος → **ανάγνωση** → αποθήκευση → εισαγωγή.
 *
 * ⚠️ Η σειρά είναι συμβόλαιο: η ανάγνωση γίνεται **πριν** από κάθε γραφή, ώστε ο
 * σύνδεσμος που δεν διαβάζεται να **μην** υπάρξει ποτέ ως πηγή (δες την κεφαλίδα).
 */
async function addFeed(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  existing: StayChannels | null,
  command: Extract<StayChannelCommand, { action: 'add-feed' }>,
  actor: ListingActor,
): Promise<StayChannelWriteResult> {
  const doc = channelsDocOf(existing, property, nowISO());
  if (doc.feeds.length >= STAY_CHANNEL_MAX_FEEDS) {
    return { kind: 'too-many-feeds', max: STAY_CHANNEL_MAX_FEEDS };
  }
  if (doc.feeds.some((feed) => feed.url === command.url)) return { kind: 'duplicate-feed' };

  const now = nowISO();
  const feed: StayChannelFeed = {
    id: enterpriseIdService.generateStayChannelFeedId(),
    label: command.label,
    url: command.url,
    channel: stayChannelKindOfUrl(command.url),
    status: { ...STAY_CHANNEL_STATUS_NEW, nextPollAt: now },
    pendingRemovals: {},
    createdAt: now,
    createdBy: actor.uid,
  };

  const read = await readStayChannelFeed(feed);
  if (read.kind === 'failed') {
    return { kind: 'feed-unreadable', failure: read.failure, httpStatus: read.httpStatus };
  }

  await writeChannels(adminDb, property.id, { ...doc, feeds: [...doc.feeds, feed] }, now);
  // Η εισαγωγή τρέχει **μετά** την αποθήκευση, με τη συναλλαγή της κεφαλής: ο άνθρωπος
  // βλέπει τις νύχτες του καναλιού από την **πρώτη** στιγμή.
  await applyStayChannelRead(adminDb, property.id, feed.id, read);
  return { kind: 'ok' };
}

/** **Αφαίρεση πηγής**: φεύγει μαζί με **όλα** τα blocks της — αλλιώς θα έμεναν κλειστές
 * νύχτες χωρίς πηγή που μπορεί να τις ανοίξει. Μία συναλλαγή, στην υπηρεσία εισαγωγής. */
async function removeFeed(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  feedId: string,
): Promise<StayChannelWriteResult> {
  const outcome = await removeStayChannelFeed(adminDb, property.id, feedId);
  return outcome === 'ok' ? { kind: 'ok' } : { kind: outcome };
}

/** **Χειροκίνητος συγχρονισμός** μιας πηγής — με φρένο κατάχρησης. */
async function syncFeed(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  existing: StayChannels | null,
  feedId: string,
): Promise<StayChannelWriteResult> {
  const feed = existing?.feeds.find((candidate) => candidate.id === feedId);
  if (feed === undefined) return { kind: 'feed-absent' };
  if (!manualSyncAllowedAt(feed, nowISO())) return { kind: 'too-soon' };
  const read = await readStayChannelFeed(feed);
  await applyStayChannelRead(adminDb, property.id, feed.id, read);
  return read.kind === 'failed'
    ? { kind: 'feed-unreadable', failure: read.failure, httpStatus: read.httpStatus }
    : { kind: 'ok' };
}

/** **Ανάκληση όλων των συνδέσμων εξαγωγής** — γενιά + 1, μία πράξη. */
async function rotateExport(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  existing: StayChannels | null,
): Promise<StayChannelWriteResult> {
  if (!stayExportConfigured()) return { kind: 'export-unconfigured' };
  const now = nowISO();
  const doc = channelsDocOf(existing, property, now);
  await writeChannels(adminDb, property.id, { ...doc, exportGeneration: doc.exportGeneration + 1 }, now);
  return { kind: 'ok' };
}

/**
 * **Εκτελεί μία πράξη πάνω στα κανάλια.**
 *
 * ⚠️ **Οι πράξεις δεν ζουν στη συναλλαγή της κεφαλής** — και είναι απόφαση: κάνουν
 * **δίκτυο**. Η κατάληψη (blocks + `version`) γράφεται πάντα μέσα στη συναλλαγή του
 * `applyStayChannelRead`· εδώ γράφεται μόνο το **μητρώο** των πηγών, που δεν κρίνεται
 * από τον κριτή κατάληψης.
 */
export async function executeStayChannelCommand(
  adminDb: AdminFirestore,
  propertyId: string,
  command: StayChannelCommand,
  actor: ListingActor,
): Promise<StayChannelWriteResult> {
  const property = await administrableProperty(adminDb, propertyId, actor);
  if (property === null) return { kind: 'absent' };
  if (!isStay(property)) return { kind: 'not-a-stay' };

  const snapshot = await readStayCalendar(adminDb, propertyId, null);
  if (snapshot.kind === 'unreadable') return { kind: 'unreadable' };
  const existing = snapshot.channelDoc;

  switch (command.action) {
    case 'add-feed':
      return addFeed(adminDb, property, existing, command, actor);
    case 'remove-feed':
      return removeFeed(adminDb, property, command.feedId);
    case 'sync-feed':
      return syncFeed(adminDb, property, existing, command.feedId);
    case 'rotate-export':
      return rotateExport(adminDb, property, existing);
  }
}
