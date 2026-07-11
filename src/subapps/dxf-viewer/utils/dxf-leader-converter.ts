/**
 * dxf-leader-converter — LEADER entity → `LeaderEntity` (ADR-635 Φάση B Batch 2 Part B).
 *
 * A LEADER is an annotation callout: a polyline path with an arrowhead at its TIP.
 * Mirrors the sibling converter split (dimension / hatch / xline-ray / quad-fill): one
 * focused module per DXF entity family, re-exported by `dxf-entity-converters.ts`.
 *
 * DXF group codes (AutoCAD R13+):
 *   10/20 = ordered path vertices (ARROW TIP = vertices[0], text end = last) — read from
 *           `pairs` (ADR-507), because the flat `data` map keeps only the LAST 10/20.
 *   40    = text annotation height (not needed for the path)
 *   71    = arrowhead flag (0 = disabled, 1 = enabled) → arrowHead.type closed|none
 *   62    = ACI color
 *   340   = hard-pointer to the annotation object (MTEXT/TOLERANCE/BLOCK) — NOT resolved
 *           here (needs the OBJECTS handle table); the callout line + arrow import cleanly.
 *
 * Arrow SIZE = DIMASZ default (2.5 mm-paper). AutoCAD sizes leader arrows from the owning
 * DIMSTYLE's DIMASZ; without style resolution we use the same Standard default the
 * dimension pipeline uses (`DEFAULT_DIMSTYLE.dimasz`). The unit-normalization pass
 * (`scaleEntity` case 'leader') scales it alongside the vertices, so it stays correct in
 * metre/cm drawings too.
 */

import type { AnySceneEntity } from '../types/scene';
import { type EntityData, parseVerticesFromPairs, extractEntityColor } from './dxf-converter-helpers';
import { DEFAULT_DIMSTYLE } from './dxf-parser-types';
import { dwarn } from '../debug';

export function convertLeader(
  entityData: EntityData,
  index: number,
): AnySceneEntity | null {
  const { data, layer, pairs } = entityData;
  const vertices = parseVerticesFromPairs(pairs).map(v => ({ x: v.x, y: v.y }));

  if (vertices.length < 2) {
    dwarn('EntityConverter', `⚠️ Skipping LEADER ${index}: insufficient vertices`, vertices.length);
    return null;
  }

  // Code 71 = arrowhead flag (0 disabled / 1 enabled); missing → enabled (AutoCAD default).
  const arrowEnabled = (parseInt(data['71'] ?? '1', 10) || 0) !== 0;
  const color = extractEntityColor(data);

  return {
    id: `leader_${index}`,
    type: 'leader',
    layerId: layer,
    visible: true,
    vertices,
    arrowHead: {
      type: arrowEnabled ? 'closed' : 'none',
      size: DEFAULT_DIMSTYLE.dimasz,
    },
    ...(color && { color }),
  };
}
