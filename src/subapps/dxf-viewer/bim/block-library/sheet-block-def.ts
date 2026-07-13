/**
 * `DetailPrimitive[]` (sheet-mm) → **block-local** {@link InSessionBlockDef} — ΕΝΑ σημείο.
 *
 * Κάθε «χάρτινο» αντικείμενο που προσγειώνεται στο σχέδιο ως block (πινακίδα σχεδίου ADR-651,
 * πίνακες τοπογραφικού ADR-650 M7, ό,τι έρθει μετά) κάνει **ακριβώς τα ίδια δύο βήματα**:
 * περνά τα primitives από το τρίτο backend του ADR-622 (`detailPrimitivesToEntities` — y-flip +
 * annotation scale) και δηλώνει bounds = μέγεθος φύλλου × scale. Αυτό εδώ είναι αυτά τα δύο
 * βήματα, μία φορά, αντί για ένα αντίγραφο ανά καταναλωτή (N.18 — sibling clone guard).
 *
 * Η αρχή (0,0) του block πέφτει **κάτω-αριστερά** — σύμβαση DXF INSERT, την επιβάλλει το y-flip.
 *
 * @see ../structural/detail-sheet/render/detail-primitives-to-entities.ts — ο μετασχηματισμός
 * @see ./place-block-from-library.ts — def + σημείο → `BlockEntity`
 */

import { detailPrimitivesToEntities } from '../structural/detail-sheet/render/detail-primitives-to-entities';
import type { DetailPrimitive } from '../structural/detail-sheet/detail-sheet-types';
import type { InSessionBlockDef } from './block-library-types';

export interface SheetBlockDefOptions {
  /** Όνομα του DXF block ορισμού (ASCII — γίνεται `BLOCK` record στο export). */
  readonly name: string;
  /** Μέγεθος του φύλλου σε sheet-mm (πριν το annotation scale). */
  readonly widthMm: number;
  readonly heightMm: number;
  /** paper-mm → model units (annotation scale· 1:50 ⇒ 50). */
  readonly scaleFactor: number;
  /** Layer των members· `'0'` = block-local default (σύμβαση DXF). */
  readonly layerId?: string;
}

export function buildSheetBlockDef(
  primitives: readonly DetailPrimitive[],
  options: SheetBlockDefOptions,
): InSessionBlockDef {
  const { name, widthMm, heightMm, scaleFactor } = options;

  const localMembers = detailPrimitivesToEntities(primitives, {
    layerId: options.layerId ?? '0',
    scaleFactor,
    sheetHeightMm: heightMm,
  });

  return {
    name,
    localMembers,
    boundsMm: {
      minX: 0,
      minY: 0,
      maxX: widthMm * scaleFactor,
      maxY: heightMm * scaleFactor,
    },
  };
}
