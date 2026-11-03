import 'server-only';

/**
 * **Τα μέσα ενός δημόσιου μοντέλου** (ADR-923 §5.13 Σ3 · Ε5): το υπάρχον δημόσιο ράφι, με πηγή **μόνο** την απόδοση web.
 *
 * 🔒 Το πρωτότυπο δεν αγγίζεται ποτέ: η πηγή είναι το συνοδευτικό `catalogWebRendition`, sRGB και το πολύ 2048 px.
 * 🔑 Κενή λίστα αδειάζει το πρόθεμα: ό,τι πάψει να επιτρέπεται, ληγμένη άδεια ή απόσυρση, σβήνεται από την ίδια πράξη.
 *
 * @module server/catalog/public/public-model-media.server
 */

import { fileCompanionPath } from '@/lib/files/file-companion-objects';
import { reconcilePublicShelf } from '@/services/listings/public-shelf.service';
import { CATALOG_MODEL_SHELF, type CatalogShelfMaterial } from '@/services/upload/utils/public-shelf-catalog-kind';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import type { PublicCatalogMedia } from '@/subapps/catalog/public/public-catalog-schema';
import type { PublicAssetFacts } from './public-model-snapshot.server';

const sourceOf = (asset: PublicAssetFacts): PublicShelfSource<CatalogShelfMaterial> => ({
  privateStoragePath: fileCompanionPath(asset.storagePath, 'catalogWebRendition'),
  material: { assetId: asset.assetId },
  storagePlacement: asset.storagePlacement,
});

/** Το πρόθεμα γίνεται ακριβώς ίσο με τη λίστα. `null` ⇒ το ράφι απέτυχε. Εικόνα που απορρίφθηκε απλώς λείπει από τον χάρτη. */
export async function reconcilePublicModelMedia(modelId: string, assets: readonly PublicAssetFacts[]): Promise<ReadonlyMap<string, PublicCatalogMedia> | null> {
  const report = await reconcilePublicShelf(CATALOG_MODEL_SHELF, modelId, assets.map(sourceOf));
  if (report.outcome === 'failed') return null;
  const labelsOf = new Map(assets.map((asset) => [asset.assetId, asset.labels]));
  return new Map(report.published.map(({ material, canonical }) => [
    material.assetId,
    { assetId: material.assetId, url: canonical.url, labels: labelsOf.get(material.assetId) ?? {} },
  ]));
}
