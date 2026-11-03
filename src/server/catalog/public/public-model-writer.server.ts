import 'server-only';

/**
 * **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΔΗΜΟΣΙΟΥ ΕΓΓΡΑΦΟΥ ΜΟΝΤΕΛΟΥ** (ADR-923 §5.13 Δ3 · Δ4, CHECK 3.112).
 *
 * Το CAS, ο φράχτης και η σειρά ραφιού ζουν στο `public-document-drain.server.ts`, κοινά με το προφίλ. Εδώ μένει ό,τι είναι
 * δικό του μοντέλου: στιγμιότυπο, δύο περάσματα προβολής και κλειστό σχήμα.
 * 🔒 Το έγγραφο περνά από το κλειστό σχήμα πριν γραφτεί: σφάλμα προβολής δεν γίνεται δημόσιο πεδίο.
 *
 * @module server/catalog/public/public-model-writer.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { publicCatalogModelFromDocument } from '@/subapps/catalog/public/public-catalog-from-document';
import { publicCatalogModelSchema, type PublicCatalogMedia, type PublicCatalogModel } from '@/subapps/catalog/public/public-catalog-schema';
import { projectPublicModel } from '@/subapps/catalog/public/project-public-model';
import type { SupplierStandingReader } from '@/subapps/catalog/public/public-publication-condition';
import { drainPublicDocument, publicDrainTarget, type PublicModelDrain } from './public-document-drain.server';
import { reconcilePublicModelMedia } from './public-model-media.server';
import { readPublicModelSnapshot, type PublicAssetFacts, type PublicModelSnapshot } from './public-model-snapshot.server';
import { revalidatePublicModel } from './public-model-revalidate.server';
import { readLiveSupplierStanding } from './public-standing.server';

export type { PublicModelDrain } from './public-document-drain.server';

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

/** Φέρνει το δημόσιο έγγραφο στην κατάσταση της τελευταίας σημείωσης. Ιδεμπότητο: δεύτερη κλήση δίνει `clean`. */
export function drainPublicModel(db: Firestore, companyId: string, modelId: string, atMs: number, deps: PublicDrainDeps = LIVE_PUBLIC_DRAIN_DEPS): Promise<PublicModelDrain> {
  const publicDoc = db.collection(COLLECTIONS.PUBLIC_CATALOG_MODELS).doc(modelId);
  return drainPublicDocument<Draft, PublicCatalogModel>(publicDrainTarget(db, companyId, { kind: 'model', modelId }, publicDoc), deps.readStanding, {
    readDraft: async () => draftOf(await deps.readSnapshot(companyId, modelId, atMs), atMs),
    assetsOf: (draft) => draft.assets,
    finalDocument: (draft, media) => finalDocument(draft, media, atMs),
    parseStored: (raw) => publicCatalogModelFromDocument(raw, modelId),
    reconcileMedia: (assets) => deps.reconcileMedia(modelId, assets),
    revalidate: () => deps.revalidate(companyId, modelId),
  });
}
