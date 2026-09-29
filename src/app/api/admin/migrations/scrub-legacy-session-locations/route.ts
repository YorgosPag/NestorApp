/**
 * =============================================================================
 * MIGRATION: Καθαρισμός εγγραφών συνεδρίας της εποχής ipapi (ADR-894 §10 Β4)
 * =============================================================================
 *
 * Κάθε `users/{uid}/sessions/*` **χωρίς** `location.precision` (γραμμένη από τον browser πριν το ADR-894):
 * η τοποθεσία του ipapi φεύγει, μπαίνει `purgeAt` (τέλος + 90 ημέρες ⇒ το σβήσιμο το κάνει το TTL), η ληγμένη
 * «`active`» γίνεται `expired`, το `isCurrent` φεύγει. Η απόφαση ζει στον καθαρό `planLegacySessionScrub`.
 *
 * - GET  = dry-run (σάρωση + αναφορά, μηδέν εγγραφές)
 * - POST = εκτέλεση (batch writes + audit log) — **μόνο με απόφαση του Giorgio** μετά το dry-run
 *
 * 🔑 Σάρωση **ανά χρήστη** (`users/{uid}/sessions`), όχι `collectionGroup('sessions')`: η ομάδα θα έπιανε και
 *    την top-level συλλογή `sessions` (ADR-255), που δεν έχει αυτό το σχήμα.
 * ⚠️ Το TTL σβήνει **μόνο** αφού γίνει `firebase deploy` του `firestore.indexes.json` (CHECK 3.86).
 *
 * @module api/admin/migrations/scrub-legacy-session-locations
 * @see ADR-704 — Admin Migration-Runner SSoT · ADR-894 §10 Β4
 * 🔒 SECURITY: `admin:migrations:execute` + withSensitiveRateLimit (από το `createMigrationRoute`)
 */

import { Timestamp, type DocumentData, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FieldValue } from '@/lib/firebaseAdmin';
import { normalizeToDate } from '@/lib/date-local';
import { BATCH_SIZE_READ, flushInBatches, processAdminBatch, type BatchUpdate } from '@/lib/admin-batch-utils';
import { createMigrationRoute, type MigrationOutcome } from '@/lib/admin-migration-runner';
import { planLegacySessionScrub, type LegacyScrubFacts } from '@/services/session/legacy-session-scrub';

export const maxDuration = 60;

const migrationRoute = createMigrationRoute({ name: 'scrub-legacy-session-locations', run: runScrub });
export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;

interface ScrubTally {
  scanned: number;
  alreadyCurrentSchema: number;
  legacy: number;
  markExpired: number;
  /** Ήδη πέρα από τις 90 ημέρες ⇒ `purgeAt` = τώρα ⇒ σβήνονται στο επόμενο πέρασμα του TTL. */
  purgeOnNextTtlPass: number;
  usersWithLegacy: number;
}

function millisOf(value: unknown): number | null {
  return normalizeToDate(value)?.getTime() ?? null;
}

function factsOf(data: DocumentData): LegacyScrubFacts {
  return {
    location: data.location,
    status: data.status,
    expiresAtMs: millisOf(data.timestamps?.expiresAt),
    revokedAtMs: millisOf(data.timestamps?.revokedAt),
    hasPurgeAt: data.purgeAt !== undefined,
    hasIsCurrent: data.isCurrent !== undefined,
  };
}

/** Ένα έγγραφο → ίσως μία ενημέρωση· η καταμέτρηση γίνεται εδώ, μία φορά. */
function planDoc(doc: QueryDocumentSnapshot<DocumentData>, nowMs: number, tally: ScrubTally): BatchUpdate | null {
  tally.scanned += 1;
  const plan = planLegacySessionScrub(factsOf(doc.data()), nowMs);
  if (plan.kind === 'skip') {
    tally.alreadyCurrentSchema += 1;
    return null;
  }
  const { update } = plan;
  tally.legacy += 1;
  if (update.markExpired) tally.markExpired += 1;
  if (update.purgeAtMs === nowMs) tally.purgeOnNextTtlPass += 1;
  return {
    ref: doc.ref,
    data: {
      location: update.location,
      ...(update.purgeAtMs !== null ? { purgeAt: Timestamp.fromMillis(update.purgeAtMs) } : {}),
      ...(update.markExpired ? { status: 'expired' } : {}),
      ...(update.dropIsCurrent ? { isCurrent: FieldValue.delete() } : {}),
    },
  };
}

async function planUser(db: Firestore, uid: string, nowMs: number, tally: ScrubTally): Promise<BatchUpdate[]> {
  const sessions = db.collection(COLLECTIONS.USERS).doc(uid).collection(SUBCOLLECTIONS.USER_SESSIONS);
  const { results } = await processAdminBatch(sessions, BATCH_SIZE_READ, (docs) =>
    docs.map((doc) => planDoc(doc, nowMs, tally)).filter((u): u is BatchUpdate => u !== null),
  );
  const updates = results.flat();
  if (updates.length > 0) tally.usersWithLegacy += 1;
  return updates;
}

async function runScrub(db: Firestore, { dryRun }: { dryRun: boolean }): Promise<MigrationOutcome> {
  const startedAt = Date.now();
  const tally: ScrubTally = {
    scanned: 0, alreadyCurrentSchema: 0, legacy: 0, markExpired: 0, purgeOnNextTtlPass: 0, usersWithLegacy: 0,
  };
  const { results: uidPages } = await processAdminBatch(db.collection(COLLECTIONS.USERS), BATCH_SIZE_READ, (docs) =>
    docs.map((doc) => doc.id),
  );

  const updates: BatchUpdate[] = [];
  for (const uid of uidPages.flat()) updates.push(...(await planUser(db, uid, startedAt, tally)));

  const flushed = dryRun ? { written: 0, errors: [] as string[] } : await flushInBatches(db, updates);
  return {
    body: { dryRun, ...tally, written: flushed.written, errors: flushed.errors, durationMs: Date.now() - startedAt },
    audit: { legacy: tally.legacy, written: flushed.written, usersWithLegacy: tally.usersWithLegacy },
  };
}
