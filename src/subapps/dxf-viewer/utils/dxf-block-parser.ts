/**
 * 🏢 ENTERPRISE: DXF BLOCK definition parser (ADR-635 Φ2)
 *
 * Parses the BLOCKS section into a name → definition map so INSERT references can be
 * expanded with their placement transform (see dxf-block-expander.ts). Without this,
 * block-definition geometry is emitted at its authored coordinates — far from the drawing
 * (e.g. NEW00O_BLOCK authored @ +363619, meant to sit at +17125 after INSERT @ -346494).
 *
 * @see dxf-block-expander.ts - INSERT → scene entities
 * @see dxf-entity-parser.ts  - shared parseEntityAt / findSectionRange
 */

import type { Point2D } from '../rendering/types/Types';
import type { EntityData } from './dxf-converter-helpers';
import { DxfEntityParser, lineAt } from './dxf-entity-parser';

/** A parsed BLOCK definition: base (grab) point + its member entities (raw, unexpanded). */
export interface BlockDef {
  base: Point2D;
  entities: EntityData[];
}

/** Map of block name → its definition. */
export type BlockDefMap = Map<string, BlockDef>;

/**
 * Parse the BLOCK header (name code 2, base point 10/20) starting at a `0/BLOCK` marker.
 * Reuses `parseEntity` (collects the header's group codes) so there is no twin scan loop.
 * @returns name, base, and the index of the first `0` after the header (an entity or ENDBLK).
 */
function parseBlockHeader(
  lines: string[],
  startIndex: number
): { name: string; base: Point2D; next: number } {
  const header = DxfEntityParser.parseEntity(lines, startIndex);
  const data = header?.data ?? {};
  return {
    name: data['2'] ?? '',
    base: { x: parseFloat(data['10'] ?? '0') || 0, y: parseFloat(data['20'] ?? '0') || 0 },
    next: DxfEntityParser.findNextEntity(lines, startIndex + 2),
  };
}

/**
 * Parse every BLOCK…ENDBLK in the BLOCKS section into a definition map.
 * Member entities are parsed with the SAME dispatch as top-level entities
 * (`DxfEntityParser.parseEntityAt`) so POLYLINE-compound / nested INSERT are handled identically.
 */
export function parseBlockDefinitions(lines: string[]): BlockDefMap {
  const defs: BlockDefMap = new Map();
  const range = DxfEntityParser.findSectionRange(lines, 'BLOCKS');
  if (!range) return defs;

  let i = range.start;
  while (i < range.end) {
    if (lineAt(lines, i) !== '0') { i += 2; continue; }

    if (lineAt(lines, i + 1) !== 'BLOCK') {
      i += 2;
      continue;
    }

    const header = parseBlockHeader(lines, i);
    i = header.next;

    const entities: EntityData[] = [];
    while (i < range.end) {
      if (lineAt(lines, i) !== '0') { i += 2; continue; }
      if (lineAt(lines, i + 1) === 'ENDBLK') {
        i = DxfEntityParser.findNextEntity(lines, i + 2);
        break;
      }
      const { entity, next } = DxfEntityParser.parseEntityAt(lines, i);
      if (entity) entities.push(entity);
      i = next;
    }

    if (header.name) defs.set(header.name, { base: header.base, entities });
  }

  return defs;
}
