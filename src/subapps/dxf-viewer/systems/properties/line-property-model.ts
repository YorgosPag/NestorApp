/**
 * LINE PROPERTY MODEL — ADR-357 §4 / ADR-362 §7
 *
 * Pure read/apply helper for the LINE entity in the Properties Palette.
 * Mirror of `dimension-property-model.ts` (buildDimensionPatch) so both entity
 * types share the same "edited form → undoable UpdateEntityCommand patch" shape.
 *
 * SSoT split: the palette component owns UI + command dispatch; this module owns
 * the geometry math that turns the edited LineFormState into the command patch.
 */

import { fromDisplay, type DisplayUnit } from '../../config/units';
import type { DxfLine } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { LineFormState } from './entity-property-schema';

interface LayerLike {
  id?: string;
  name: string;
}

/**
 * Build the UpdateEntityCommand patch for a LINE from its edited form state.
 * Returns an empty object when nothing changed (caller skips the command).
 */
export function buildLinePatch(
  line: DxfLine,
  form: LineFormState,
  layers: readonly LayerLike[],
  displayUnit: DisplayUnit,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  // Start point
  const newStartXMm = fromDisplay(parseFloat(form.startX), displayUnit);
  const newStartYMm = fromDisplay(parseFloat(form.startY), displayUnit);
  if (!isNaN(newStartXMm) && !isNaN(newStartYMm)) {
    const origStartX = line.start.x;
    const origStartY = line.start.y;
    if (Math.abs(newStartXMm - origStartX) > 0.0001 || Math.abs(newStartYMm - origStartY) > 0.0001) {
      patch.start = { x: newStartXMm, y: newStartYMm };
    }
  }

  // Layer
  const newLayerId = form.layerId;
  if (newLayerId && newLayerId !== (line.layerId ?? '')) {
    patch.layerId = newLayerId;
    const layerObj = layers.find(l => l.id === newLayerId);
    if (layerObj) patch.layer = layerObj.name;
  }

  // Color
  const colorTrimmed = form.color.trim();
  const originalColor = line.colorMode === 'Concrete' ? (line.color ?? '') : '';
  if (colorTrimmed !== originalColor) {
    if (colorTrimmed === '') {
      patch.colorMode = 'ByLayer';
      patch.color = null;
    } else {
      patch.colorMode = 'Concrete';
      patch.color = colorTrimmed;
    }
  }

  // Linetype
  const origLinetype = line.linetypeName ?? 'ByLayer';
  if (form.linetype !== origLinetype) {
    patch.linetypeName = form.linetype === 'ByLayer' ? undefined : form.linetype;
  }

  // Length + Angle → recompute end
  const startX = patch.start ? (patch.start as { x: number }).x : line.start.x;
  const startY = patch.start ? (patch.start as { x: number; y: number }).y : line.start.y;
  const dx0 = line.end.x - line.start.x;
  const dy0 = line.end.y - line.start.y;
  const origLengthMm = Math.hypot(dx0, dy0);
  let origAngleDeg = Math.atan2(-dy0, dx0) * (180 / Math.PI);
  if (origAngleDeg < 0) origAngleDeg += 360;

  const newLengthMm = fromDisplay(parseFloat(form.lengthDisplay), displayUnit);
  const newAngleDeg = parseFloat(form.angleDeg);
  const finalLength = isNaN(newLengthMm) ? origLengthMm : newLengthMm;
  const finalAngle = isNaN(newAngleDeg) ? origAngleDeg : newAngleDeg;
  const finalRad = finalAngle * (Math.PI / 180);

  if (
    Math.abs(finalLength - origLengthMm) > 0.0001 ||
    Math.abs(finalAngle - origAngleDeg) > 0.0001 ||
    patch.start
  ) {
    patch.end = {
      x: startX + finalLength * Math.cos(finalRad),
      y: startY - finalLength * Math.sin(finalRad),
    };
  }

  return patch;
}
