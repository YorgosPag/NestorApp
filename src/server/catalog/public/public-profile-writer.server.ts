import 'server-only';

/**
 * **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΔΗΜΟΣΙΟΥ ΠΡΟΦΙΛ** (ADR-923 §22 Υ8, CHECK 3.112): ίδιος δρόμος με το μοντέλο, ίδια συνθήκη, ίδιο ράφι.
 *
 * 🔑 Υποκείμενο στο ράφι είναι το id του εγγράφου προφίλ, όχι ο `companyId`: τα δημόσια κλειδιά δεν κουβαλούν ταυτότητα μισθωτή.
 *
 * @module server/catalog/public/public-profile-writer.server
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import type { PublicCatalogMedia } from '@/subapps/catalog/public/public-catalog-schema';
import type { SupplierStandingReader } from '@/subapps/catalog/public/public-publication-condition';
import { PUBLIC_PROFILE_SCOPE } from '@/subapps/catalog/public/public-scopes-of-write';
import { projectPublicProfile, publicSupplierProfileFromDocument, publicSupplierProfileSchema, type PublicSupplierProfile } from '@/subapps/catalog/public/public-supplier-profile';
import { drainPublicDocument, publicDrainTarget, type PublicModelDrain } from './public-document-drain.server';
import { reconcilePublicModelMedia } from './public-model-media.server';
import { revalidatePublicCompany } from './public-model-revalidate.server';
import { readPublicProfileSnapshot, type PublicAssetFacts, type PublicProfileSnapshot } from './public-model-snapshot.server';
import { readLiveSupplierStanding } from './public-standing.server';

export interface PublicProfileDrainDeps {
  readonly readStanding: SupplierStandingReader;
  readonly readSnapshot: (companyId: string, nowMs: number) => Promise<PublicProfileSnapshot | null>;
  readonly reconcileMedia: (subjectId: string, assets: readonly PublicAssetFacts[]) => Promise<ReadonlyMap<string, PublicCatalogMedia> | null>;
  readonly revalidate: (companyId: string) => void;
}

export const LIVE_PUBLIC_PROFILE_DEPS: PublicProfileDrainDeps = {
  readStanding: readLiveSupplierStanding,
  readSnapshot: readPublicProfileSnapshot,
  reconcileMedia: reconcilePublicModelMedia,
  revalidate: revalidatePublicCompany,
};

/** Πρώτο πέρασμα με κενά URL: η προβολή λέει αν μένει κάτι να δημοσιευτεί. */
function draftOf(snapshot: PublicProfileSnapshot | null, companyId: string): PublicProfileSnapshot | null {
  if (snapshot === null) return null;
  const media = new Map([...snapshot.assets].map(([id, asset]) => [id, { assetId: id, url: '', labels: asset.labels }]));
  return projectPublicProfile({ companyId, definition: snapshot.definition, quoteIntake: snapshot.quoteIntake, media }) === null ? null : snapshot;
}

function finalDocument(snapshot: PublicProfileSnapshot, media: ReadonlyMap<string, PublicCatalogMedia>, companyId: string): PublicSupplierProfile | null {
  const document = projectPublicProfile({ companyId, definition: snapshot.definition, quoteIntake: snapshot.quoteIntake, media });
  return document === null ? null : publicSupplierProfileSchema.parse(document);
}

export function drainPublicProfile(db: Firestore, companyId: string, atMs: number, deps: PublicProfileDrainDeps = LIVE_PUBLIC_PROFILE_DEPS): Promise<PublicModelDrain> {
  const publicDoc = db.collection(COLLECTIONS.PUBLIC_SUPPLIER_PROFILES).doc(companyId);
  const subjectId = generateDeterministicCatalogSupplierProfileId(companyId);
  return drainPublicDocument<PublicProfileSnapshot, PublicSupplierProfile>(publicDrainTarget(db, companyId, PUBLIC_PROFILE_SCOPE, publicDoc), deps.readStanding, {
    readDraft: async () => draftOf(await deps.readSnapshot(companyId, atMs), companyId),
    assetsOf: (snapshot) => [...snapshot.assets.values()],
    finalDocument: (snapshot, media) => finalDocument(snapshot, media, companyId),
    parseStored: (raw) => publicSupplierProfileFromDocument(raw, companyId),
    reconcileMedia: (assets) => deps.reconcileMedia(subjectId, assets),
    revalidate: () => deps.revalidate(companyId),
  });
}
