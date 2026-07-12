/**
 * DXF ASCII — INSERT + named BLOCK writer (ADR-640 M2)
 * ============================================================================
 *
 * Split out of `dxf-ascii-writer.ts` for file-size SRP (N.7.1), mirroring the
 * anonymous-dimension-BLOCK split (`dxf-ascii-dimension-block-writer.ts`) and the
 * TABLES / HATCH / TEXT / primitive-emitter splits.
 *
 * Round-trips a first-class {@link BlockEntity} (M1 import: a named single INSERT
 * preserved as a container) back to the AutoCAD/Revit convention:
 *   1. one `INSERT` entity per block instance (ENTITIES section) — name + placement
 *      transform (position/scale/rotation), and
 *   2. one named `BLOCK … ENDBLK` definition per DISTINCT `block.name` (BLOCKS
 *      section) whose members are emitted in BLOCK-LOCAL coords at base (0,0).
 *
 * Because M1 stores members BLOCK-LOCAL with the base baked to the origin, export
 * is zero inverse math: the INSERT carries the placement, the BLOCK carries the
 * local geometry. Member serialization is delegated back to the writer's own
 * `writeEntity` via the injected `emitMember` callback (same dependency-injection
 * SSoT the HATCH writer uses for `emitLine`) — no line/arc/text serialization is
 * re-implemented here.
 */

import type { BlockEntity, Entity } from '../../types/entities';
import type { Pair } from './dxf-ascii-hatch-writer';
// ADR-640 M3 — round-trip the anonymous flag: an imported `*U#`/`*A#` block (now preserved) must
// re-export with BLOCK flag 70=1 so a re-import keeps it anonymous (and AutoCAD reads it faithfully).
import { isAnonymousBlockName } from '../../utils/dxf-anonymous-block';

/** Serialize one block member (any entity type) through the writer's `writeEntity`. */
export type EmitMember = (member: Entity) => void;

/**
 * Emit one `INSERT` entity: block name (2), insertion point (10/20/30, scaled),
 * X/Y/Z scale factors (41/42/43, dimensionless — NOT scaled) and rotation in
 * degrees (50). Mirrors the group codes `createBlockInstance` reads on import, so
 * the reference round-trips losslessly.
 */
export function emitInsert(
  pair: Pair, block: BlockEntity, layer: string, aci: number, s: number,
): void {
  pair(0, 'INSERT');
  pair(8, layer);
  pair(62, aci);
  pair(2, block.name);
  pair(10, block.position.x * s);
  pair(20, block.position.y * s);
  pair(30, 0);
  pair(41, block.scale.x);
  pair(42, block.scale.y);
  pair(43, 1);
  pair(50, block.rotation);
}

/**
 * Emit one named `BLOCK … ENDBLK` definition per DISTINCT `block.name` (dedup —
 * many instances share one definition, matching AutoCAD). The base point is (0,0)
 * because M1 baked the block base to the origin; members are serialized via the
 * injected `emitMember` (the writer's `writeEntity`) in their stored BLOCK-LOCAL
 * coordinates.
 *
 * @param layerFor Resolves the DXF layer NAME for the block header (the INSERT's layer).
 */
export function writeBlockDefinitions(
  pair: Pair,
  blocks: readonly BlockEntity[],
  layerFor: (block: BlockEntity) => string,
  emitMember: EmitMember,
): void {
  const seen = new Set<string>();
  for (const block of blocks) {
    if (seen.has(block.name)) continue; // one definition per distinct name
    seen.add(block.name);

    const layer = layerFor(block);
    pair(0, 'BLOCK');
    pair(8, layer);
    pair(2, block.name);
    // ADR-640 M3 — flag 1 = anonymous (`*U#`/`*A#`/…), 0 = named. Faithful re-import + AutoCAD read.
    pair(70, isAnonymousBlockName(block.name) ? 1 : 0);
    pair(10, 0); pair(20, 0); pair(30, 0);  // base point at origin (M1 baked)
    pair(3, block.name);                    // block name (repeated per DXF BLOCK spec)

    for (const member of block.entities) emitMember(member);

    pair(0, 'ENDBLK');
    pair(8, layer);
  }
}
