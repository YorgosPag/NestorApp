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
 * ⚠️ RENDER NOTE (Φάση C): ο `PointRenderer` σήμερα είναι no-op («NUCLEAR: POINT
 * CIRCLE ELIMINATED») — το εισαγόμενο POINT μπαίνει στη σκηνή (import coverage +
 * diagnostics) αλλά δεν ζωγραφίζεται ορατά μέχρι να ενεργοποιηθεί $PDMODE/$PDSIZE
 * glyph rendering. Δες ADR-635.
 *
 * @see dxf-entity-converters.ts — master router που δρομολογεί POINT εδώ.
 * @see types/entities.ts PointEntity — target scene shape.
 */

import type { AnySceneEntity } from '../types/scene';
import { extractEntityColor } from './dxf-converter-helpers';
import { dwarn } from '../debug';

/** Convert POINT entity → scene `type:'point'`. */
export function convertPoint(
  data: Record<string, string>,
  layer: string,
  index: number
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
    ...(color && { color }),
  };
}
