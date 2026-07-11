/**
 * 🏢 ENTERPRISE: DXF POINT Converter (ADR-635 Φάση B)
 *
 * Το POINT είναι το απλούστερο DXF entity — μία θέση (10/20). Χαρτογραφείται στο
 * ήδη υπάρχον scene `PointEntity` (`type:'point'`, `PointRenderer` ήδη registered).
 * Extracted σε δικό του module (mirror dxf-xline-ray-converter.ts SRP split) για να
 * μείνει το dxf-entity-converters.ts κάτω από το 500-line Google cap (N.7.1).
 *
 * DXF Codes: 10,20 = Position (30/Z αγνοείται — Point2D είναι 2D-only, ίδια σύμβαση
 * με CIRCLE/ARC). Αγνοούμε: 39 (thickness), 50 (PDMODE display angle),
 * 210/220/230 (extrusion direction) — άσχετα με τη ΘΕΣΗ, μόνο με το πώς το AutoCAD
 * ΣΧΕΔΙΑΖΕΙ το glyph.
 *
 * 🏢 RENDER (Φάση C): το drawing-wide $PDMODE/$PDSIZE (DxfHeaderData) bake-άρεται εδώ
 * ΠΑΝΩ σε κάθε PointEntity (`pdMode`/`pdSize`) ώστε ο `PointRenderer` να μένει stateless
 * (mirror του DIMSTYLE baking σε DimensionEntity). Ο renderer ζωγραφίζει το AutoCAD glyph.
 *
 * @see dxf-entity-converters.ts — master router που δρομολογεί POINT εδώ (περνάει header).
 * @see rendering/entities/shared/point-glyph.ts — decode SSoT ($PDMODE→figure, $PDSIZE→size).
 * @see types/entities.ts PointEntity — target scene shape.
 */

import type { AnySceneEntity } from '../types/scene';
import type { DxfHeaderData } from './dxf-parser-types';
import { extractEntityColor } from './dxf-converter-helpers';
import { dwarn } from '../debug';

/** Convert POINT entity → scene `type:'point'`. Bakes the drawing-wide $PDMODE/$PDSIZE. */
export function convertPoint(
  data: Record<string, string>,
  layer: string,
  index: number,
  header?: DxfHeaderData
): AnySceneEntity | null {
  const x = parseFloat(data['10']);
  const y = parseFloat(data['20']);

  if (isNaN(x) || isNaN(y)) {
    dwarn('EntityConverter', `⚠️ Skipping POINT ${index}: invalid position`, { x, y });
    return null;
  }

  const color = extractEntityColor(data);

  return {
    id: `point_${index}`,
    type: 'point',
    layerId: layer,
    visible: true,
    position: { x, y },
    // Drawing-wide point display baked per-point (undefined header → renderer defaults to dot).
    ...(header ? { pdMode: header.pdmode, pdSize: header.pdsize } : {}),
    ...(color && { color }),
  };
}
