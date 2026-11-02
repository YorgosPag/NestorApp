import 'server-only';

/**
 * Οι **εικόνες μιας έκδοσης** (ADR-923 §5.3 · §5.6): από το μέσο στην καταγεγραμμένη απόδοση, με προέλεγχο.
 * Η έκδοση είναι το **δίχτυ ασφαλείας** των αποδόσεων (`ensureCatalogAssetRenditions`): παλιότερη συνταγή ή γενιά
 * ξαναφτιάχνεται εδώ. Απόδοση που δεν βγαίνει ⇒ `renditionMissing`, ποτέ σελίδα με τρύπα.
 * @module server/catalog/publishing/publication-assets.server
 */

import { createHash } from 'node:crypto';

import { COLLECTIONS } from '@/config/firestore-collections';
import { fileCompanionPath } from '@/lib/files/file-companion-objects';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { preflightPrintImages, type PlacedImageFacts } from '@/subapps/catalog/publishing/publication-preflight';
import type { LayoutDocument } from '@/subapps/catalog/publishing/layout-model';
import { needsCatalogRenditions, type CatalogRenditions } from '@/subapps/catalog/renditions/catalog-renditions';
import { assetFileTypeFactsOf } from '@/subapps/catalog/schema/judge-asset-file';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import { ensureCatalogAssetRenditions, type CatalogRenditionRecord } from '../catalog-asset-renditions.server';
import type { StoredCatalogRecord } from '../catalog-store.server';
import { PublicationRunError } from './publication-prices.server';
import type { AssetBytesReader, PublicationFontFile } from './typst-adapter';

type Ready = Extract<CatalogRenditions, { status: 'ready' }>;

const COMPANION = { print: 'catalogPrintRendition', web: 'catalogWebRendition' } as const;

interface ResolvedAsset {
  readonly record: CatalogRenditionRecord;
  readonly renditions: Ready;
}

async function resolveAsset(asset: StoredCatalogRecord<CatalogAssetDefinition>): Promise<ResolvedAsset> {
  if (asset.fileId === null) throw new PublicationRunError('renditionMissing');
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS[FILE_COLLECTION.company]).doc(asset.fileId).get();
  const data = snap.data();
  // 🔒 Ξένο SVG δεν περνά ποτέ από το `sharp` (ADR-899): όσα δεν έχουν αποδόσεις σταματούν εδώ, πριν το δίχτυ ασφαλείας.
  if (!data || !needsCatalogRenditions(asset.kind, assetFileTypeFactsOf(data))) throw new PublicationRunError('renditionMissing');
  const record: CatalogRenditionRecord = data;
  const renditions = await ensureCatalogAssetRenditions(db, { custody: 'company', fileId: asset.fileId, record });
  if (renditions?.status !== 'ready') throw new PublicationRunError('renditionMissing');
  return { record, renditions };
}

/** Τα bytes των όψεων, μία φορά για όλα τα προφίλ. Το αποτύπωμα της σύνδεσης ξανακρίνεται: άλλα bytes σημαίνουν άλλο αρχείο από αυτό που ελέγχθηκε. */
export async function readPublicationFonts(fonts: readonly StoredCatalogRecord<CatalogAssetDefinition>[]): Promise<readonly PublicationFontFile[]> {
  const db = getAdminFirestore();
  return Promise.all(fonts.map(async (asset) => {
    const snap = asset.fileId === null ? null : await db.collection(COLLECTIONS[FILE_COLLECTION.company]).doc(asset.fileId).get();
    const data = snap?.data();
    if (!data || typeof data.storagePath !== 'string') throw new PublicationRunError('fontMissing');
    const [bytes] = await fileRecordBucket(data).file(data.storagePath).download();
    if (createHash('sha256').update(bytes).digest('hex') !== asset.font?.sha256) throw new PublicationRunError('fontMissing');
    return { name: `${asset.id}.ttf`, bytes };
  }));
}

export interface PublicationAssets {
  readonly read: AssetBytesReader;
  readonly lowResolutionImageCount: number;
  readonly nonCmykImageCount: number;
}

/** Φέρνει τις καταγραφές όλων των εικόνων· τα bytes ανά προφίλ, όταν ζητηθούν. */
export async function resolvePublicationAssets(document: LayoutDocument, assets: ReadonlyMap<string, StoredCatalogRecord<CatalogAssetDefinition>>): Promise<PublicationAssets> {
  const resolved = new Map<string, ResolvedAsset>();
  for (const [id, asset] of assets) resolved.set(id, await resolveAsset(asset));
  const facts = (id: string): PlacedImageFacts | null => {
    const print = resolved.get(id)?.renditions.print;
    return print ? { widthPx: print.width, colourModel: print.colour.model } : null;
  };
  const read: AssetBytesReader = async (assetId, use) => {
    const asset = resolved.get(assetId);
    const path = asset?.record.storagePath;
    if (!asset || !path) throw new PublicationRunError('renditionMissing');
    const [bytes] = await fileRecordBucket(asset.record).file(fileCompanionPath(path, COMPANION[use])).download();
    return bytes;
  };
  return { read, ...preflightPrintImages(document, facts) };
}
