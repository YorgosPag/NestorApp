/**
 * ============================================================================
 * IMAGE ENTITY DXF EXPORT — async client pre-pass (ADR-651 Φάση Ε)
 * ============================================================================
 *
 * Client-side pre-pass (μοτίβο: `image-fill-export.ts` — ΠΟΛΥ απλούστερο: καμία tile-grid,
 * καμία PIP culling, ΕΝΑ `IMAGE` ανά entity): για κάθε `ImageEntity` της σκηνής κατεβάζει/
 * decode-άρει το raster και γεμίζει το `dxfImageExport` marker (ίδιο idiom με τα
 * `dxfFaces`/`dxfMlineSource`/hatch `dxfImageExport`) ώστε ο pure DXF writer
 * (`dxf-ascii-image-writer.ts`) να το σειριοποιήσει ως native `IMAGE`+`IMAGEDEF`.
 *
 * Αποτυχία decode/fetch → η εικόνα ΠΑΡΑΛΕΙΠΕΤΑΙ σιωπηλά (καμία εξαίρεση, το DXF βγαίνει
 * κανονικά χωρίς αυτήν)· δεν υπάρχει νόημα σε solid-downgrade fallback εδώ (σε αντίθεση με
 * το hatch image-fill, μια «γυμνή» εικόνα δεν έχει fill-χρώμα να υποβαθμιστεί).
 *
 * SSoT reuse (μηδέν διπλότυπο, N.12/N.18):
 *   • `decodeImageWithTimeout` / `fetchRasterWithTimeout` — κοινό `image-export-shared.ts`
 *     (ίδιο module με το `image-fill-export.ts`).
 *   • `isImageEntity`         — type guard SSoT (`types/image.ts`).
 *
 * @module export/core/image-entity-export
 * @see export/core/image-export-shared
 * @see docs/centralized-systems/reference/adrs/ADR-651-auto-title-block-generator.md
 */

import type { Entity } from '../../types/entities';
import type { ImageEntity } from '../../types/image';
import { isImageEntity } from '../../types/image';
import type { ExportArtifact } from '../types';
import { decodeImageWithTimeout, fetchRasterWithTimeout } from './image-export-shared';

/** Διαγνωστικοί κωδικοί (ASCII, μη user-facing — δεν περνούν από i18n· surface μόνο για logs). */
export type ImageEntityExportWarning =
  | 'image-entity:decode-failed'
  | 'image-entity:raster-fetch-failed';

/** Αποτέλεσμα του async pre-pass: entities (με marker όπου πέτυχε) + raster artifacts + warnings. */
export interface DxfImageEntityResolution {
  readonly entities: Entity[];
  readonly rasters: ExportArtifact[];
  readonly warnings: ImageEntityExportWarning[];
}

/**
 * Async pre-pass (client): για κάθε `ImageEntity` κατεβάζει/decode-άρει το raster και προσθέτει
 * `dxfImageExport` marker (ΕΝΑ insert = η κάτω-αριστερή γωνία `position`). Αποτυχία decode/fetch
 * → το entity περνά αυτούσιο (χωρίς marker) — ο writer το παραλείπει σιωπηλά. Μη-image entities
 * περνούν αυτούσια. Rasters deduped ανά filename (πολλές εικόνες ίδιου URL → ΕΝΑ αρχείο + ΕΝΑ IMAGEDEF).
 */
export async function resolveImageEntitiesForDxf(
  entities: readonly Entity[],
): Promise<DxfImageEntityResolution> {
  const out: Entity[] = [];
  const rasters = new Map<string, ExportArtifact>();
  const warnings: ImageEntityExportWarning[] = [];

  for (const e of entities) {
    if (!isImageEntity(e)) { out.push(e); continue; }
    out.push(await resolveOneImageEntity(e, rasters, warnings));
  }

  return { entities: out, rasters: [...rasters.values()], warnings };
}

/** Resolve ΕΝΟΣ `ImageEntity` → ίδιο entity με `dxfImageExport` marker (ή αυτούσιο σε αποτυχία). */
async function resolveOneImageEntity(
  entity: ImageEntity,
  rasters: Map<string, ExportArtifact>,
  warnings: ImageEntityExportWarning[],
): Promise<Entity> {
  const img = await decodeImageWithTimeout(entity.url);
  if (!img) { warnings.push('image-entity:decode-failed'); return entity as unknown as Entity; }

  // Το `url` (ΟΧΙ το entity `id`) είναι το κλειδί ταυτότητας του raster — δύο ImageEntity που
  // δείχνουν στο ΙΔΙΟ αρχείο πρέπει να καταλήξουν στο ΙΔΙΟ filename ώστε να μοιραστούν ΕΝΑ IMAGEDEF.
  const raster = await fetchRasterWithTimeout(entity.url, entity.url);
  if (!raster) { warnings.push('image-entity:raster-fetch-failed'); return entity as unknown as Entity; }
  if (!rasters.has(raster.filename)) rasters.set(raster.filename, raster.artifact);

  return {
    ...entity,
    dxfImageExport: {
      filename: raster.filename,
      pixelWidth: img.naturalWidth,
      pixelHeight: img.naturalHeight,
      tileWorldWidth: entity.width,
      tileWorldHeight: entity.height,
      angleDeg: entity.rotation ?? 0,
      inserts: [entity.position],
    },
  } as unknown as Entity;
}
