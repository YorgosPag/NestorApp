import 'server-only';

/**
 * **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΔΗΜΟΣΙΟΥ ΕΓΓΡΑΦΟΥ ΜΟΝΤΕΛΟΥ** (ADR-923 §5.13 Δ3 · Δ4, CHECK 3.112).
 *
 * Ροή: διάβασε `R` → κρίνε τη συνθήκη → πρόβαλε → σε συναλλαγή ξαναδιάβασε `R` και γράψε έγγραφο **και** `drainedRevision`.
 *
 * 🔑 **Φράχτης σε δύο scopes.** Το `model:<id>` πιάνει αλλαγή του μοντέλου. Το `catalog` πιάνει ανάκληση: μια καθυστερημένη
 *    εγγραφή με παλιά, ανοιχτή συνθήκη δεν ξαναγεννά έγγραφο που μόλις αποσύρθηκε.
 * 🔒 `unknown` ⇒ καμία εγγραφή, καμία ανάγνωση καταλόγου, το outbox μένει βρώμικο. Ξεκάθαρο `warn` με τον χώρο: μόνιμη βλάβη
 *    δεν επιτρέπεται να μοιάζει με υγιή σάρωση.
 * 🔒 Το έγγραφο περνά από το κλειστό σχήμα πριν γραφτεί: σφάλμα προβολής δεν γίνεται δημόσιο πεδίο.
 * ⚠️ Σειρά ραφιού: στο `set` πρώτα τα bytes (τα URL δεν υπάρχουν πριν), στο `delete` πρώτα το έγγραφο. Αποτυχία ραφιού μετά
 *    από `delete` ξανασημειώνει το scope, ώστε δημόσια bytes να μη μείνουν ορφανά.
 *
 * @module server/catalog/public/public-model-writer.server
 */

import { isDeepStrictEqual } from 'node:util';

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { publicCatalogModelFromDocument } from '@/subapps/catalog/public/public-catalog-from-document';
import { publicCatalogModelSchema, type PublicCatalogMedia, type PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import { projectPublicModel } from '@/subapps/catalog/public/project-public-model';
import { publicModelActionOf, readPublicationCondition, type PublicationCondition, type SupplierStandingReader } from '@/subapps/catalog/public/public-publication-condition';
import type { PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';
import { reconcilePublicModelMedia } from './public-model-media.server';
import { readPublicModelSnapshot, type PublicAssetFacts, type PublicModelSnapshot } from './public-model-snapshot.server';
import { PUBLIC_CATALOG_SCOPE, publicOutboxRef, publicOutboxSignal, type PublicOutboxRecord } from './public-outbox.server';
import { revalidatePublicModel } from './public-model-revalidate.server';
import { readLiveSupplierStanding } from './public-standing.server';

const logger = createModuleLogger('PublicModelWriter');

export type PublicModelDrain = 'published' | 'withdrawn' | 'unchanged' | 'clean' | 'deferred' | 'raced' | 'media-failed';

/** Ό,τι έρχεται από έξω: εγχεόμενο, ώστε οι άγκυρες να μην αγγίζουν κάδο, μνήμη ή κρίση προμηθευτή. */
export interface PublicDrainDeps {
  readonly readStanding: SupplierStandingReader;
  readonly readSnapshot: (companyId: string, modelId: string, nowMs: number) => Promise<PublicModelSnapshot | null>;
  readonly reconcileMedia: (modelId: string, assets: readonly PublicAssetFacts[]) => Promise<ReadonlyMap<string, PublicCatalogMedia> | null>;
  readonly revalidate: (companyId: string, modelId: string) => void;
}

export const LIVE_PUBLIC_DRAIN_DEPS: PublicDrainDeps = {
  readStanding: readLiveSupplierStanding,
  readSnapshot: readPublicModelSnapshot,
  reconcileMedia: reconcilePublicModelMedia,
  revalidate: revalidatePublicModel,
};

interface DrainTarget {
  readonly db: Firestore;
  readonly companyId: string;
  readonly modelId: string;
  readonly modelOutbox: DocumentReference;
  readonly catalogOutbox: DocumentReference;
  readonly publicDoc: DocumentReference;
}

interface Fence {
  readonly model: number;
  readonly catalog: number;
}

function targetOf(db: Firestore, companyId: string, modelId: string): DrainTarget {
  const scope: PublicScope = { kind: 'model', modelId };
  return {
    db,
    companyId,
    modelId,
    modelOutbox: publicOutboxRef(db, companyId, scope),
    catalogOutbox: publicOutboxRef(db, companyId, PUBLIC_CATALOG_SCOPE),
    publicDoc: db.collection(COLLECTIONS.PUBLIC_CATALOG_MODELS).doc(modelId),
  };
}

const revisionOf = (record: PublicOutboxRecord | undefined): number => record?.revision ?? 0;

async function readFence(target: DrainTarget): Promise<Fence & { readonly drained: number }> {
  const [model, catalog] = await target.db.getAll(target.modelOutbox, target.catalogOutbox);
  const record = model.data() as PublicOutboxRecord | undefined;
  return { model: revisionOf(record), catalog: revisionOf(catalog.data() as PublicOutboxRecord | undefined), drained: record?.drainedRevision ?? 0 };
}

interface Draft {
  readonly snapshot: PublicModelSnapshot;
  readonly assets: readonly PublicAssetFacts[];
}

const mediaOf = (model: PublicCatalogModel) => [...model.media, ...model.variants.flatMap((variant) => variant.media)];

/** Πρώτο πέρασμα με κενά URL: λέει ποια μέσα μπαίνουν, χωρίς να γραφτεί δεύτερη φορά ο κανόνας της προβολής. */
function draftOf(snapshot: PublicModelSnapshot | null, atMs: number): Draft | null {
  if (snapshot === null) return null;
  const media = new Map([...snapshot.assets].map(([id, asset]) => [id, { assetId: id, url: '', labels: asset.labels }]));
  const draft = projectPublicModel({ ...snapshot.projection, atMs, media });
  if (draft === null) return null;
  const assets = [...new Set(mediaOf(draft).map((item) => item.assetId))].flatMap((id) => snapshot.assets.get(id) ?? []);
  return { snapshot, assets };
}

function finalDocument(draft: Draft, media: ReadonlyMap<string, PublicCatalogMedia>, atMs: number): PublicCatalogModel | null {
  const document = projectPublicModel({ ...draft.snapshot.projection, atMs, media });
  return document === null ? null : publicCatalogModelSchema.parse(document);
}

/** Η μία εγγραφή: CAS στον φράχτη, έγγραφο και `drainedRevision` μαζί. */
async function commit(target: DrainTarget, fence: Fence, document: PublicCatalogModel | null): Promise<PublicModelDrain> {
  const { db, modelId, modelOutbox, catalogOutbox, publicDoc } = target;
  return db.runTransaction(async (tx) => {
    const [model, catalog] = await tx.getAll(modelOutbox, catalogOutbox);
    const moved = revisionOf(model.data() as PublicOutboxRecord | undefined) !== fence.model
      || revisionOf(catalog.data() as PublicOutboxRecord | undefined) !== fence.catalog;
    if (moved) return 'raced';
    const stored = await tx.get(publicDoc);
    const same = document === null ? !stored.exists : isDeepStrictEqual(publicCatalogModelFromDocument(stored.data(), modelId), document);
    if (!same && document === null) tx.delete(publicDoc);
    if (!same && document !== null) tx.set(publicDoc, document);
    tx.set(modelOutbox, { drainedRevision: fence.model, dirty: false }, { merge: true });
    if (same) return 'unchanged';
    return document === null ? 'withdrawn' : 'published';
  });
}

/** Το έγγραφο έφυγε: αδειάζει το ράφι. Αποτυχία ⇒ ξανά βρώμικο, αλλιώς τα bytes μένουν δημόσια χωρίς κανέναν να τα δείχνει. */
async function emptyShelf(target: DrainTarget, deps: PublicDrainDeps): Promise<PublicModelDrain> {
  if ((await deps.reconcileMedia(target.modelId, [])) !== null) return 'withdrawn';
  await target.modelOutbox.set(publicOutboxSignal(target.companyId, { kind: 'model', modelId: target.modelId }), { merge: true });
  return 'media-failed';
}

async function withdraw(target: DrainTarget, fence: Fence, deps: PublicDrainDeps): Promise<PublicModelDrain> {
  const outcome = await commit(target, fence, null);
  if (outcome !== 'withdrawn') return outcome;
  deps.revalidate(target.companyId, target.modelId);
  return emptyShelf(target, deps);
}

async function publish(target: DrainTarget, fence: Fence, draft: Draft, deps: PublicDrainDeps, atMs: number): Promise<PublicModelDrain> {
  const media = await deps.reconcileMedia(target.modelId, draft.assets);
  if (media === null) return 'media-failed';
  const outcome = await commit(target, fence, finalDocument(draft, media, atMs));
  if (outcome === 'published') deps.revalidate(target.companyId, target.modelId);
  return outcome;
}

function deferred(companyId: string, modelId: string): PublicModelDrain {
  logger.warn('Η συνθήκη δημοσίευσης δεν κρίθηκε: το μοντέλο μένει ως έχει', { companyId, modelId });
  return 'deferred';
}

async function drainWith(target: DrainTarget, fence: Fence, condition: PublicationCondition, deps: PublicDrainDeps, atMs: number): Promise<PublicModelDrain> {
  const { companyId, modelId } = target;
  const draft = condition === 'open' ? draftOf(await deps.readSnapshot(companyId, modelId, atMs), atMs) : null;
  switch (publicModelActionOf(condition, draft !== null)) {
    case 'defer':
      return deferred(companyId, modelId);
    case 'delete':
      return withdraw(target, fence, deps);
    case 'set':
      return draft === null ? withdraw(target, fence, deps) : publish(target, fence, draft, deps, atMs);
  }
}

/** Φέρνει το δημόσιο έγγραφο στην κατάσταση της τελευταίας σημείωσης. Ιδεμπότητο: δεύτερη κλήση δίνει `clean`. */
export async function drainPublicModel(db: Firestore, companyId: string, modelId: string, atMs: number, deps: PublicDrainDeps = LIVE_PUBLIC_DRAIN_DEPS): Promise<PublicModelDrain> {
  const target = targetOf(db, companyId, modelId);
  const fence = await readFence(target);
  if (fence.drained >= fence.model) return 'clean';
  const condition = await readPublicationCondition(companyId, deps.readStanding);
  return drainWith(target, fence, condition, deps, atMs);
}
