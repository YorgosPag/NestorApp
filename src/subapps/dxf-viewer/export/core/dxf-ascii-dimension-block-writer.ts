/**
 * DXF ASCII — anonymous dimension BLOCK writer (ADR-362 Round 26)
 * ============================================================================
 *
 * Split out of `dxf-ascii-writer.ts` for file-size SRP (N.7.1), mirroring the
 * TABLES / HATCH / TEXT / primitive-emitter splits. Emits one anonymous
 * `BLOCK *Di … ENDBLK` per dimension, carrying the dimension's real drawn
 * geometry (built from the on-screen SSoT `buildDimensionBlockPrimitives`) so
 * dimensions display reliably even in readers that don't regenerate geometry.
 */

import type { Entity } from '../../types/entities';
import type { DimensionEntity, DimStyle } from '../../types/dimension';
import {
  buildDimensionBlockPrimitives,
  type DimBlockPrimitive,
} from '../../systems/dimensions/dim-block-primitives';
import type { DimensionLookup } from '../../systems/dimensions/dim-geometry-builder';
import type { Pair } from './dxf-ascii-hatch-writer';
import { emit3DFace, emitLine, emitCircle, emitArc } from './dxf-ascii-primitive-emitters';
import { emitText } from './dxf-ascii-text-writer';

const ACI_BYLAYER = 256; // dimension-block geometry follows the dim's layer colour

/** Build a `DimensionLookup` over the export's dimensions (baseline/continued chains). */
export function buildDimensionLookup(dimEntities: readonly Entity[]): DimensionLookup {
  const byId = new Map<string, DimensionEntity>();
  for (const e of dimEntities) byId.set(e.id, e as unknown as DimensionEntity);
  return (id: string) => byId.get(id);
}

/**
 * Emit one anonymous `BLOCK *Di … ENDBLK` containing the dimension's real drawn
 * geometry. Geometry comes entirely from `buildDimensionBlockPrimitives` (the
 * on-screen SSoT); we only serialize the world-space primitives through the
 * existing entity emitters. On a build failure (partial def points / missing
 * chain parent) we skip the block silently — the DIMENSION entity remains.
 */
export function writeDimensionBlock(
  pair: Pair, entity: DimensionEntity, style: DimStyle, blockName: string, layer: string, s: number,
  lookup: DimensionLookup,
): void {
  let primitives: DimBlockPrimitive[];
  try {
    primitives = buildDimensionBlockPrimitives(entity, style, lookup);
  } catch {
    return; // degenerate / unresolved chain → no block (regen-capable readers still show the DIMENSION)
  }

  pair(0, 'BLOCK');
  pair(8, layer);
  pair(2, blockName);
  pair(70, 1);                 // anonymous block flag (bit 1)
  pair(10, 0); pair(20, 0); pair(30, 0); // base point at origin
  pair(3, blockName);          // block name (repeated per DXF BLOCK spec)

  for (const prim of primitives) {
    switch (prim.kind) {
      case 'line':
        emitLine(prim.a, prim.b, layer, ACI_BYLAYER, s, pair);
        break;
      case 'arc':
        emitArc(prim.center, prim.radius, prim.startDeg, prim.endDeg, layer, ACI_BYLAYER, s, pair);
        break;
      case 'circle':
        emitCircle(prim.center, prim.radius, layer, ACI_BYLAYER, s, pair);
        break;
      case 'fill':
        // Solid arrowhead → 3DFACE (z=0). Reuses the ADR-505 §C solid-fill primitive.
        emit3DFace(prim.points.map((pt) => ({ x: pt.x, y: pt.y, zMm: 0 })), layer, ACI_BYLAYER, s, s, pair);
        break;
      case 'text':
        // centred dimension text — h=centre(1)/v=middle(2), byte-identical to the old `centered` flag.
        emitText(prim.position, prim.text, prim.heightWorld, layer, ACI_BYLAYER, s, pair, prim.rotationDeg, { h: 1, v: 2 });
        break;
    }
  }

  pair(0, 'ENDBLK');
  pair(8, layer);
}
