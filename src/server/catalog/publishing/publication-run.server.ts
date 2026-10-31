import 'server-only';

/**
 * =============================================================================
 * Ο ΚΥΚΛΟΣ ΖΩΗΣ ΜΙΑΣ ΕΚΔΟΣΗΣ (ADR-923 §5.6) — ασύγχρονη, ιδεμπότητη, μία φορά
 * =============================================================================
 *
 * ```
 * αίτηση → στιγμιότυπο → hash εισόδων → id εγγράφου = f(χώρος, hash)
 *          ready        ⇒ επιστρέφεται το ίδιο αρχείο, καμία απόδοση
 *          queued/running ⇒ ο δεύτερος καλών περιμένει την ίδια δουλειά
 *          failed/καμία ⇒ queued → (after) running → ready | failed
 * ```
 *
 * 🔑 **Ιδιοκτήτης κύκλου ζωής**: αυτό το αρχείο, και μόνο αυτό, γράφει `catalog_publication_runs`. Η μετάβαση σε `queued`
 *    γίνεται σε συναλλαγή, άρα δύο ταυτόχρονα κλικ βλέπουν ένα έγγραφο.
 * 🔑 **Πρόοδος**: το Typst δεν αναφέρει σελίδες ενώ τρέχει. Μετράμε ό,τι υπάρχει πριν από αυτό (λογικές ενότητες του
 *    μοντέλου) και ανά προφίλ· το μετρημένο 4,5–8,6 s της μηχανής είναι μικρό μέρος της συνολικής διάρκειας.
 * 🔒 Το αρχείο ζει σε ιδιωτικό δρόμο **χωρίς** download token: η μόνη πόρτα είναι η διαδρομή λήψης με κριτή `pricingView`.
 * ⚠️ Επανεκκίνηση στη μέση ⇒ το cron τη γράφει `interrupted`· η επόμενη αίτηση την ξαναπιάνει στο ίδιο id.
 * @module server/catalog/publishing/publication-run.server
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { nowISO } from '@/lib/date-local';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import { CATALOG_PUBLICATION_RUN_TRACKED_FIELDS } from '@/config/audit-tracked-fields-catalog';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import { publicationBucket } from '@/server/catalog/publishing/publication-bucket.server';
import { createObjectOnce } from '@/server/storage/create-object-once.server';
import { generateDeterministicCatalogPublicationRunId } from '@/services/enterprise-id.service';
import { countLayoutSections } from '@/subapps/catalog/publishing/layout-model';
import {
  EMPTY_PUBLICATION_REPORT,
  type PublicationArtifact,
  type PublicationFailure,
  type PublicationProgress,
  type PublicationRecipeDefinition,
  type PublicationReport,
  type PublicationRunDefinition,
} from '@/subapps/catalog/types/publication';
import type { PublicationOutputProfile } from '@/subapps/catalog/publishing/publication-vocabulary';
import { readOwned, runCatalogReadOnly, type StoredCatalogRecord } from '../catalog-store.server';
import { resolvePublicationAssets, type PublicationAssets } from './publication-assets.server';
import { PublicationRunError } from './publication-prices.server';
import { readPublicationSnapshot, type PublicationSnapshot } from './publication-snapshot.server';
import { renderPublicationPdf } from './typst-adapter';
import { assertTypstAvailable, runTypst, TypstFailedError, TypstUnavailableError, type TypstRunner } from './typst-engine.server';

const logger = createModuleLogger('CatalogPublicationRun');

export type StoredPublicationRun = PublicationRunDefinition & {
  readonly id: string;
  readonly companyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Πόσο μπορεί να μείνει χωρίς κίνηση μια έκδοση πριν θεωρηθεί κομμένη. */
export const PUBLICATION_RUN_STALE_MS = 15 * 60 * 1000;

const runRef = (db: Firestore, id: string): DocumentReference => db.collection(COLLECTIONS.CATALOG_PUBLICATION_RUNS).doc(id);

export function publicationArtifactPath(companyId: string, runId: string, profile: PublicationOutputProfile): string {
  return `catalog-publications/${companyId}/${runId}/${profile}.pdf`;
}

function queuedRun(id: string, ctx: AuthContext, recipe: StoredCatalogRecord<PublicationRecipeDefinition>, snapshot: PublicationSnapshot, attempts: number, createdAt: string | null): StoredPublicationRun {
  const now = nowISO();
  return {
    id,
    companyId: ctx.companyId,
    recipeId: recipe.id,
    recipeRevision: recipe.revision,
    inputHash: snapshot.inputHash,
    audienceKey: snapshot.audienceKey,
    priced: snapshot.priced,
    status: 'queued',
    progress: { phase: 'queued', pagesDone: 0, pagesTotal: countLayoutSections(snapshot.document) },
    artifacts: [],
    report: null,
    failure: null,
    attempts,
    requestedAt: now,
    requestedBy: ctx.uid,
    finishedAt: null,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

/** Το ιστορικό: **κάθε** αίτηση και **κάθε** κατάληξη (ADR-195). Η έκδοση δεν περνά από τη μηχανή, άρα το γράφει εδώ. */
function recordRunChange(before: StoredPublicationRun | null, after: StoredPublicationRun): Promise<void> {
  return recordTrackedEntityWrite({
    entityType: 'catalog_publication_run',
    entityId: after.id,
    entityName: after.inputHash.slice(0, 12),
    trackedFields: CATALOG_PUBLICATION_RUN_TRACKED_FIELDS,
    before,
    after,
    performedBy: after.requestedBy,
    ledger: { companyId: after.companyId },
  });
}

export interface RequestedRun {
  readonly run: StoredPublicationRun;
  /** `true` μόνο για όποιον έγραψε το `queued`: αυτός, και κανείς άλλος, ξεκινά την απόδοση. */
  readonly mustExecute: boolean;
  readonly snapshot: PublicationSnapshot;
  readonly recipe: StoredCatalogRecord<PublicationRecipeDefinition>;
}

/** Η αίτηση: ιδεμπότητη από κατασκευή. Ίδιες είσοδοι ⇒ ίδιο id ⇒ ίδιο έγγραφο. */
export async function requestPublicationRun(ctx: AuthContext, recipeId: string): Promise<RequestedRun> {
  const { recipe, snapshot } = await runCatalogReadOnly(ctx, async (scope) => {
    const stored = await readOwned<PublicationRecipeDefinition>(scope, 'publicationRecipe', recipeId);
    return { recipe: stored, snapshot: await readPublicationSnapshot(scope, stored) };
  });
  const db = getAdminFirestore();
  const id = generateDeterministicCatalogPublicationRunId(ctx.companyId, snapshot.inputHash);
  const ref = runRef(db, id);
  const outcome = await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data() as StoredPublicationRun | undefined;
    if (current && current.status !== 'failed') return { run: current, before: current, mustExecute: false };
    const run = queuedRun(id, ctx, recipe, snapshot, (current?.attempts ?? 0) + 1, current?.createdAt ?? null);
    tx.set(ref, run);
    return { run, before: current ?? null, mustExecute: true };
  });
  if (outcome.mustExecute) await recordRunChange(outcome.before, outcome.run);
  return { run: outcome.run, mustExecute: outcome.mustExecute, snapshot, recipe };
}

function updateRun(ref: DocumentReference, patch: Partial<StoredPublicationRun>): Promise<unknown> {
  return ref.update({ ...patch, updatedAt: nowISO() });
}

async function renderProfile(input: {
  readonly requested: RequestedRun;
  readonly profile: PublicationOutputProfile;
  readonly assets: PublicationAssets;
  readonly run: TypstRunner;
}): Promise<PublicationArtifact> {
  const { requested, profile, assets } = input;
  const { snapshot, recipe } = requested;
  const rendered = await renderPublicationPdf(
    { document: snapshot.document, fontCode: recipe.theme.fontCode, dataAsOfEpoch: snapshot.dataAsOfEpoch, readAsset: assets.read, run: input.run },
    profile,
  );
  const storagePath = publicationArtifactPath(recipe.companyId, requested.run.id, profile);
  // 🔑 Μόνο δημιουργία: το κλειδί είναι ντετερμινιστικό, άρα επανάληψη μετά από διακοπή βρίσκει τα ίδια bytes (`exists`).
  await createObjectOnce(publicationBucket(), storagePath, rendered.bytes, 'application/pdf');
  return { profile, storagePath, sizeBytes: rendered.bytes.length, pageCount: rendered.pageCount, sha256: rendered.sha256, renderMs: rendered.renderMs };
}

export function publicationFailureOf(cause: unknown): PublicationFailure {
  if (cause instanceof PublicationRunError) return cause.failure;
  if (cause instanceof TypstUnavailableError) return 'engineUnavailable';
  if (cause instanceof TypstFailedError) return cause.outcome === 'timeout' ? 'engineTimeout' : 'engineFailed';
  return 'internal';
}

function reportOf(snapshot: PublicationSnapshot, assets: PublicationAssets): PublicationReport {
  return { ...EMPTY_PUBLICATION_REPORT, ...snapshot.report, lowResolutionImageCount: assets.lowResolutionImageCount, nonCmykImageCount: assets.nonCmykImageCount };
}

/** Η απόδοση, μέσα στο `after` της αίτησης. Δεν πετά ποτέ: κάθε αποτυχία γίνεται κατάσταση της έκδοσης. */
export async function executePublicationRun(requested: RequestedRun, run: TypstRunner = runTypst): Promise<void> {
  const ref = runRef(getAdminFirestore(), requested.run.id);
  const { snapshot, recipe } = requested;
  const pagesTotal = countLayoutSections(snapshot.document);
  const progress = (phase: PublicationProgress['phase'], pagesDone: number): PublicationProgress => ({ phase, pagesDone, pagesTotal });
  try {
    await assertTypstAvailable();
    await updateRun(ref, { status: 'running', progress: progress('reading', 0) });
    const assets = await resolvePublicationAssets(snapshot.document, snapshot.assets);
    await updateRun(ref, { progress: progress('composing', pagesTotal) });
    const artifacts: PublicationArtifact[] = [];
    for (const profile of recipe.profiles) {
      await updateRun(ref, { progress: progress('rendering', pagesTotal) });
      artifacts.push(await renderProfile({ requested, profile, assets, run }));
      await updateRun(ref, { progress: progress('storing', pagesTotal), artifacts });
    }
    await updateRun(ref, { status: 'ready', progress: progress('done', pagesTotal), report: reportOf(snapshot, assets), finishedAt: nowISO() });
    await recordRunChange(requested.run, { ...requested.run, status: 'ready' });
  } catch (cause) {
    const failure = publicationFailureOf(cause);
    logger.error('Catalog publication failed', { runId: requested.run.id, failure, error: cause instanceof Error ? cause.message : String(cause) });
    await updateRun(ref, { status: 'failed', failure, finishedAt: nowISO() });
    await recordRunChange(requested.run, { ...requested.run, status: 'failed', failure });
  }
}

/** Οι εκδόσεις μιας εταιρείας, οι νεότερες πρώτες — ό,τι βλέπει η οθόνη. */
export async function readRecentPublicationRuns(ctx: AuthContext, limit: number): Promise<StoredPublicationRun[]> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.CATALOG_PUBLICATION_RUNS)
    .where('companyId', '==', ctx.companyId)
    .orderBy('requestedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((doc) => doc.data() as StoredPublicationRun);
}

/** Μία έκδοση αυτού του χώρου· ξένη ≡ ανύπαρκτη. */
export async function readOwnedPublicationRun(ctx: AuthContext, id: string): Promise<StoredPublicationRun | null> {
  const data = (await runRef(getAdminFirestore(), id).get()).data() as StoredPublicationRun | undefined;
  return data && data.companyId === ctx.companyId ? data : null;
}

/** Το δίχτυ: έκδοση που έμεινε ανοιχτή επειδή η διεργασία κόπηκε. Δεν την ξανατρέχει, το λέει. */
export async function failInterruptedPublicationRuns(db: Firestore, nowMs: number, limit: number): Promise<number> {
  const cutoff = new Date(nowMs - PUBLICATION_RUN_STALE_MS).toISOString();
  // tenant-scope-exempt: εργασία συστήματος (cron) — οι κομμένες εκδόσεις αφορούν κάθε χώρο με την ίδια πολιτική.
  const snap = await db.collection(COLLECTIONS.CATALOG_PUBLICATION_RUNS)
    .where('status', 'in', ['queued', 'running'])
    .where('updatedAt', '<', cutoff)
    .limit(limit)
    .get();
  await Promise.all(snap.docs.map(async (doc) => {
    await updateRun(doc.ref, { status: 'failed', failure: 'interrupted', finishedAt: nowISO() });
    const before = doc.data() as StoredPublicationRun;
    await recordRunChange(before, { ...before, status: 'failed', failure: 'interrupted' });
  }));
  return snap.size;
}
