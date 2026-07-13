/**
 * Block Library — capture: import scene → distinct {@link InSessionBlockDef}.
 *
 * Μετά από DXF import, σαρώνει τα entities της σκηνής και μαζεύει ΜΙΑ φορά κάθε named
 * `BlockEntity` (πρώτο instance κερδίζει) ως ορισμό βιβλιοθήκης. Τα members αποθηκεύονται
 * σε BLOCK-LOCAL space (ήδη base→origin από `createBlockInstance`) — έτοιμα για re-placement.
 *
 * Φιλτράρει anonymous decorations (`*X` R12-hatch, `*D` dimension) μέσω του SSoT
 * `shouldPreserveBlockName` — κρατάμε μόνο πραγματικά, επαναχρησιμοποιήσιμα blocks.
 *
 * Pure — καμία παρενέργεια. Ο καλών περνά το αποτέλεσμα στο `setSessionBlockDefs`.
 *
 * @see systems/block/block-instance.ts — παραγωγή των BlockEntity (base baked)
 * @see utils/dxf-anonymous-block.ts — shouldPreserveBlockName (SSoT)
 */

import type { BlockEntity, Entity } from '../../types/entities';
import { shouldPreserveBlockName } from '../../utils/dxf-anonymous-block';
import type { InSessionBlockDef } from './block-library-types';

/** Local type guard — αποφεύγει coupling σε συγκεκριμένο export path του isBlockEntity. */
function isBlock(entity: Entity): entity is BlockEntity {
  return (entity as { type?: string }).type === 'block';
}

/**
 * Distinct named block defs από τα entities μιας σκηνής. Σειρά = πρώτη εμφάνιση.
 * Blocks χωρίς μέλη ή με anonymous-decoration όνομα παραλείπονται.
 */
export function captureBlockDefsFromScene(entities: readonly Entity[]): InSessionBlockDef[] {
  const byName = new Map<string, InSessionBlockDef>();

  for (const entity of entities) {
    if (!isBlock(entity)) continue;
    const { name } = entity;
    if (!name || byName.has(name)) continue;
    if (!shouldPreserveBlockName(name)) continue;
    if (!entity.entities || entity.entities.length === 0) continue;

    byName.set(name, {
      name,
      localMembers: entity.entities,
      boundsMm: null,
    });
  }

  return [...byName.values()];
}
