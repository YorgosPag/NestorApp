import 'server-only';

/**
 * **Ο ένας δρόμος προς δημόσιο έγγραφο** (ADR-923 §5.13 Δ3 · Δ4, §22 Υ8): κοινός για μοντέλο και προφίλ, CHECK 3.112.
 *
 * Ροή: διάβασε `R` → κρίνε τη συνθήκη → πρόβαλε → σε συναλλαγή ξαναδιάβασε `R` και γράψε έγγραφο **και** `drainedRevision`.
 *
 * 🔑 **Φράχτης σε δύο scopes.** Το δικό του scope πιάνει αλλαγή του ίδιου του εγγράφου. Το `catalog` πιάνει ανάκληση: μια
 *    καθυστερημένη εγγραφή με παλιά, ανοιχτή συνθήκη δεν ξαναγεννά έγγραφο που μόλις αποσύρθηκε.
 * 🔒 `unknown` ⇒ καμία εγγραφή, καμία ανάγνωση καταλόγου, το outbox μένει βρώμικο. Ξεκάθαρο `warn` με τον χώρο: μόνιμη βλάβη
 *    δεν επιτρέπεται να μοιάζει με υγιή σάρωση.
 * ⚠️ Σειρά ραφιού: στο `set` πρώτα τα bytes (τα URL δεν υπάρχουν πριν), στο `delete` πρώτα το έγγραφο. Αποτυχία ραφιού μετά
 *    από `delete` ξανασημειώνει το scope, ώστε δημόσια bytes να μη μείνουν ορφανά.
 *
 * @module server/catalog/public/public-document-drain.server
 */

import { isDeepStrictEqual } from 'node:util';

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import type { PublicCatalogMedia } from '@/subapps/catalog/public/public-catalog-schema';
import { publicModelActionOf, readPublicationCondition, type PublicationCondition, type SupplierStandingReader } from '@/subapps/catalog/public/public-publication-condition';
import { publicScopeKey, type PublicScope } from '@/subapps/catalog/public/public-scopes-of-write';
import type { PublicAssetFacts } from './public-model-snapshot.server';
import { PUBLIC_CATALOG_SCOPE, publicOutboxRef, publicOutboxSignal, type PublicOutboxRecord } from './public-outbox.server';

const logger = createModuleLogger('PublicDocumentDrain');

export type PublicModelDrain = 'published' | 'withdrawn' | 'unchanged' | 'clean' | 'deferred' | 'raced' | 'media-failed';

export interface PublicDrainTarget {
  readonly db: Firestore;
  readonly companyId: string;
  readonly scope: PublicScope;
  readonly outbox: DocumentReference;
  readonly catalogOutbox: DocumentReference;
  readonly publicDoc: DocumentReference;
}

export function publicDrainTarget(db: Firestore, companyId: string, scope: PublicScope, publicDoc: DocumentReference): PublicDrainTarget {
  return { db, companyId, scope, publicDoc, outbox: publicOutboxRef(db, companyId, scope), catalogOutbox: publicOutboxRef(db, companyId, PUBLIC_CATALOG_SCOPE) };
}

/** Ό,τι διαφέρει ανά είδος εγγράφου. Τα πάντα έρχονται από τον καλούντα: το CAS δεν ξέρει τι δημοσιεύει. */
export interface PublicDocumentFlow<TDraft, TDocument> {
  readonly readDraft: () => Promise<TDraft | null>;
  readonly assetsOf: (draft: TDraft) => readonly PublicAssetFacts[];
  readonly finalDocument: (draft: TDraft, media: ReadonlyMap<string, PublicCatalogMedia>) => TDocument | null;
  readonly parseStored: (raw: unknown) => TDocument | null;
  readonly reconcileMedia: (assets: readonly PublicAssetFacts[]) => Promise<ReadonlyMap<string, PublicCatalogMedia> | null>;
  readonly revalidate: () => void;
}

interface Fence {
  readonly own: number;
  readonly catalog: number;
}

const revisionOf = (record: PublicOutboxRecord | undefined): number => record?.revision ?? 0;

async function readFence(target: PublicDrainTarget): Promise<Fence & { readonly drained: number }> {
  const [own, catalog] = await target.db.getAll(target.outbox, target.catalogOutbox);
  const record = own.data() as PublicOutboxRecord | undefined;
  return { own: revisionOf(record), catalog: revisionOf(catalog.data() as PublicOutboxRecord | undefined), drained: record?.drainedRevision ?? 0 };
}

/** Η μία εγγραφή: CAS στον φράχτη, έγγραφο και `drainedRevision` μαζί. */
async function commit<TDocument extends object>(target: PublicDrainTarget, fence: Fence, parseStored: (raw: unknown) => TDocument | null, document: TDocument | null): Promise<PublicModelDrain> {
  const { db, outbox, catalogOutbox, publicDoc } = target;
  return db.runTransaction(async (tx) => {
    const [own, catalog] = await tx.getAll(outbox, catalogOutbox);
    const moved = revisionOf(own.data() as PublicOutboxRecord | undefined) !== fence.own
      || revisionOf(catalog.data() as PublicOutboxRecord | undefined) !== fence.catalog;
    if (moved) return 'raced';
    const stored = await tx.get(publicDoc);
    const same = document === null ? !stored.exists : isDeepStrictEqual(parseStored(stored.data()), document);
    if (!same && document === null) tx.delete(publicDoc);
    if (!same && document !== null) tx.set(publicDoc, document);
    tx.set(outbox, { drainedRevision: fence.own, dirty: false }, { merge: true });
    if (same) return 'unchanged';
    return document === null ? 'withdrawn' : 'published';
  });
}

/** Το έγγραφο έφυγε: αδειάζει το ράφι. Αποτυχία ⇒ ξανά βρώμικο, αλλιώς τα bytes μένουν δημόσια χωρίς κανέναν να τα δείχνει. */
async function emptyShelf<TDraft, TDocument>(target: PublicDrainTarget, flow: PublicDocumentFlow<TDraft, TDocument>): Promise<PublicModelDrain> {
  if ((await flow.reconcileMedia([])) !== null) return 'withdrawn';
  await target.outbox.set(publicOutboxSignal(target.companyId, target.scope), { merge: true });
  return 'media-failed';
}

async function withdraw<TDraft, TDocument extends object>(target: PublicDrainTarget, fence: Fence, flow: PublicDocumentFlow<TDraft, TDocument>): Promise<PublicModelDrain> {
  const outcome = await commit(target, fence, flow.parseStored, null);
  if (outcome !== 'withdrawn') return outcome;
  flow.revalidate();
  return emptyShelf(target, flow);
}

async function publish<TDraft, TDocument extends object>(target: PublicDrainTarget, fence: Fence, draft: TDraft, flow: PublicDocumentFlow<TDraft, TDocument>): Promise<PublicModelDrain> {
  const media = await flow.reconcileMedia(flow.assetsOf(draft));
  if (media === null) return 'media-failed';
  const outcome = await commit(target, fence, flow.parseStored, flow.finalDocument(draft, media));
  if (outcome === 'published') flow.revalidate();
  return outcome;
}

async function drainWith<TDraft, TDocument extends object>(target: PublicDrainTarget, fence: Fence, condition: PublicationCondition, flow: PublicDocumentFlow<TDraft, TDocument>): Promise<PublicModelDrain> {
  const draft = condition === 'open' ? await flow.readDraft() : null;
  switch (publicModelActionOf(condition, draft !== null)) {
    case 'defer':
      logger.warn('Η συνθήκη δημοσίευσης δεν κρίθηκε: το έγγραφο μένει ως έχει', { companyId: target.companyId, scope: publicScopeKey(target.scope) });
      return 'deferred';
    case 'delete':
      return withdraw(target, fence, flow);
    case 'set':
      return draft === null ? withdraw(target, fence, flow) : publish(target, fence, draft, flow);
  }
}

/** Φέρνει το δημόσιο έγγραφο στην κατάσταση της τελευταίας σημείωσης. Ιδεμπότητο: δεύτερη κλήση δίνει `clean`. */
export async function drainPublicDocument<TDraft, TDocument extends object>(target: PublicDrainTarget, readStanding: SupplierStandingReader, flow: PublicDocumentFlow<TDraft, TDocument>): Promise<PublicModelDrain> {
  const fence = await readFence(target);
  if (fence.drained >= fence.own) return 'clean';
  const condition = await readPublicationCondition(target.companyId, readStanding);
  return drainWith(target, fence, condition, flow);
}
