import 'server-only';

/**
 * Οι **εικόνες μιας έκδοσης** (ADR-923 §5.3 · §5.6): από το μέσο στην καταγεγραμμένη απόδοση, με προέλεγχο.
 * Η έκδοση είναι το **δίχτυ ασφαλείας** των αποδόσεων (`ensureCatalogAssetRenditions`): παλιότερη συνταγή ή γενιά
 * ξαναφτιάχνεται εδώ. Απόδοση που δεν βγαίνει ⇒ `renditionMissing`, ποτέ σελίδα με τρύπα.
 * @module server/catalog/publishing/publication-assets.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { fileCompanionPath } from '@/lib/files/file-companion-objects';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { fileRecordBucket } from '@/server/files/file-record-bucket';
import { preflightPrintImages, type PlacedImageFacts } from '@/subapps/catalog/publishing/publication-preflight';
import type { LayoutDocument } from '@/subapps/catalog/publishing/layout-model';
import type { CatalogRenditions } from '@/subapps/catalog/renditions/catalog-renditions';
import type { CatalogAssetDefinition } from '@/subapps/catalog/types/asset';
import { ensureCatalogAssetRenditions, type CatalogRenditionRecord } from '../catalog-asset-renditions.server';
import type { StoredCatalogRecord } from '../catalog-store.server';
import { PublicationRunError } from './publication-prices.server';
import type { AssetBytesReader } from './typst-adapter';

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
  const record = snap.data() as CatalogRenditionRecord | undefined;
  if (!record) throw new PublicationRunError('renditionMissing');
  const renditions = await ensureCatalogAssetRenditions(db, { custody: 'company', fileId: asset.fileId, record });
  if (renditions?.status !== 'ready') throw new PublicationRunError('renditionMissing');
  return { record, renditions };
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
