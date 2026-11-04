import 'server-only';

/**
 * Το **έγγραφο της ανάγνωσης** (`plan_readings/{plrd_*}`, ADR-929 Δ11, Δ15 #5): κρυφή μνήμη, μία-πτήση και απόδειξη
 * αποστολής σε **ένα** έγγραφο με ντετερμινιστικό id (`generateDeterministicPlanReadingId(companyId, key)`).
 *
 * 🔑 **Μία-πτήση με μίσθωση.** Το «κλείδωμα» γίνεται σε συναλλαγή: έγγραφο `read` ⇒ κρυφή μνήμη · `pending` με ζωντανή
 * μίσθωση ⇒ «τρέχει ήδη» · τίποτα, `failed` ή ληγμένη μίσθωση ⇒ το παίρνει αυτή η αίτηση. Δύο αιτήσεις για την ίδια
 * εικόνα δεν πληρώνουν ποτέ δύο κλήσεις (ADR-929 Δ11, N.7.2 #2–#3).
 * 🔑 **Ανάγνωση + κόστος σε μία δέσμη.** Το τελικό έγγραφο και η δαπάνη της εταιρείας γράφονται μαζί ή καθόλου.
 * 🔑 **Απόδειξη αποστολής (Δ15 #5).** Το έγγραφο κρατά το sha256 των bytes που **στάλθηκαν**, το πλήθος και το hash του
 * πίνακα τμημάτων, και την όψη (crop + ασπρισμένες περιοχές) που επιβεβαίωσε ο άνθρωπος. Η εταιρεία απαντά πάντα «τι
 * ακριβώς είδε ο πάροχος» για κάθε σχέδιο.
 * 🔒 Μόνο Admin SDK· η συλλογή δεν έχει κανόνα πελάτη (default-deny).
 *
 * @module server/plan-recognition/plan-reading-store.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { assertOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { companyAiSpendWrite } from '@/services/ai-pipeline/ai-usage.service';
import type { PlanReaderFailure, PlanReaderUsage } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reader-port';
import type { PlanReadingRequest } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-contract';
import type { PlanReadingDropped, PlanViewReading } from '@/subapps/dxf-viewer/bim/plan-recognition/reading/plan-reading-wire';
import { PLAN_READING_USAGE_CHANNEL } from './plan-reading-allowance.server';

/** Πάνω από το `maxDuration` της διαδρομής (120″): μετά από αυτό, όποιος κράτησε τη μίσθωση δεν υπάρχει πια. */
export const PLAN_READING_LEASE_MS = 150_000;

/** Τι στάλθηκε **πραγματικά** στον πάροχο (Δ15 #5). */
export interface PlanReadingSentProof {
  readonly imageSha256: string;
  readonly mimeType: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly bytes: number;
  readonly segmentCount: number;
  readonly segmentsSha256: string;
  readonly view: PlanReadingRequest['view'];
}

export interface PlanReadingIdentity {
  readonly readingId: string;
  readonly readingKey: string;
  readonly companyId: string;
  readonly backgroundId: string;
  readonly fileId: string;
  readonly pageNumber: number;
  readonly model: string;
  readonly schemaVersion: number;
}

export interface StoredPlanReading extends PlanReadingIdentity {
  readonly status: 'pending' | 'read' | 'failed';
  readonly leaseUntil: number | null;
  readonly sent: PlanReadingSentProof;
  readonly reading: PlanViewReading | null;
  readonly dropped: PlanReadingDropped | null;
  readonly failure: PlanReaderFailure | null;
  readonly usage: PlanReaderUsage | null;
  readonly latencyMs: number | null;
  readonly createdBy: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type PlanReadingClaim =
  | { readonly kind: 'cached'; readonly stored: StoredPlanReading }
  | { readonly kind: 'in-flight' }
  /** Μόνο με `probeOnly`: τίποτα δεν εμποδίζει μια νέα ανάγνωση, και τίποτα δεν γράφτηκε. */
  | { readonly kind: 'free' }
  | { readonly kind: 'claimed' };

export interface PlanReadingClaimOptions {
  /** Μόνο ερώτηση «υπάρχει ήδη;», χωρίς μίσθωση: η κρυφή μνήμη κρίνεται **πριν** από το όριο κόστους. */
  readonly probeOnly?: boolean;
}

const readingsRef = () => getAdminFirestore().collection(COLLECTIONS.PLAN_READINGS);

/** Κρυφή μνήμη ή μίσθωση, σε **μία** συναλλαγή. */
export async function claimPlanReading(
  identity: PlanReadingIdentity,
  sent: PlanReadingSentProof,
  createdBy: string,
  now: number,
  options: PlanReadingClaimOptions = {},
): Promise<PlanReadingClaim> {
  const ref = readingsRef().doc(identity.readingId);
  return getAdminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? (snap.data() as StoredPlanReading) : null;
    // Το id περιέχει την εταιρεία στον σπόρο του· ξένο έγγραφο εδώ σημαίνει σύγκρουση ή αλλοίωση, ποτέ κρυφή μνήμη.
    if (existing) assertOwnedByCompany(existing, identity.companyId, () => new Error('plan reading id collision across tenants'));
    if (existing?.status === 'read') return { kind: 'cached', stored: existing };
    if (existing?.status === 'pending' && (existing.leaseUntil ?? 0) > now) return { kind: 'in-flight' };
    if (options.probeOnly) return { kind: 'free' };
    const pending: StoredPlanReading = {
      ...identity,
      status: 'pending',
      leaseUntil: now + PLAN_READING_LEASE_MS,
      sent,
      reading: null,
      dropped: null,
      failure: null,
      usage: null,
      latencyMs: null,
      createdBy,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    tx.set(ref, pending);
    return { kind: 'claimed' };
  });
}

export interface PlanReadingSettlement {
  readonly status: 'read' | 'failed';
  readonly reading: PlanViewReading | null;
  readonly dropped: PlanReadingDropped | null;
  readonly failure: PlanReaderFailure | null;
  readonly usage: PlanReaderUsage | null;
  readonly latencyMs: number;
}

/** Το τελικό έγγραφο **και** η δαπάνη της εταιρείας, μαζί ή καθόλου. */
export async function settlePlanReading(identity: PlanReadingIdentity, settlement: PlanReadingSettlement, now: number): Promise<void> {
  const batch = getAdminFirestore().batch();
  batch.set(readingsRef().doc(identity.readingId), { ...settlement, leaseUntil: null, updatedAt: now }, { merge: true });
  if (settlement.usage) {
    const spend = companyAiSpendWrite(identity.companyId, PLAN_READING_USAGE_CHANNEL, {
      inputTokens: settlement.usage.inputTokens,
      outputTokens: settlement.usage.outputTokens,
      // Χωρίς τιμή στον πίνακα το κόστος είναι άγνωστο· η εκτίμηση το είχε ήδη αποκλείσει (`cost-unknown`).
      costUsd: settlement.usage.costUsd ?? 0,
      cacheHit: false,
    });
    batch.set(spend.ref, spend.data, { merge: true });
  }
  await batch.commit();
}

/** Επανεκτέλεση από την κρυφή μνήμη: κόστος 0, μετριέται (Δ16 #1). Αποτυχία εδώ δεν αλλάζει την απάντηση. */
export async function recordPlanReadingCacheHit(companyId: string): Promise<void> {
  const spend = companyAiSpendWrite(companyId, PLAN_READING_USAGE_CHANNEL, { inputTokens: 0, outputTokens: 0, costUsd: 0, cacheHit: true });
  await spend.ref.set(spend.data, { merge: true });
}
