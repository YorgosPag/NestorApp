/**
 * @module canvas-v2/preview-canvas/preview-text-paint
 * @description ADR-508 §text-parity (Giorgio 2026-07-07) — μικρό ημιδιάφανο «φάντασμα-λέξη» στη θέση
 * εισαγωγής των single-click annotation εργαλείων «Κείμενο» (`text`) / «Πολυγραμμικό Κείμενο» (`mtext`).
 *
 * Η λέξη = i18n `tools.text` («Κείμενο» / «Text», ανάλογα με τη γλώσσα app) επιλύεται **ΕΔΩ** (render
 * layer) — ο generator παραμένει pure (N.11: μηδέν hardcoded «text»/«κείμενο» string). Ίδιο world→screen
 * SSoT (`CoordinateTransforms`) με τους υπόλοιπους preview renderers· οι κυανές listening dims + τα λευκά
 * ίχνη ευθυγράμμισης ζωγραφίζονται από τους ΚΟΙΝΟΥΣ painters (drawing-hover-overlays / tracking), όχι εδώ.
 *
 * @see ../../hooks/drawing/drawing-preview-generator — generateTextPreview (παράγει το PreviewText)
 * @see ./preview-entity-dispatch — case 'text' → renderPreviewText
 */

import type { ViewTransform } from '../../rendering/types/Types';
import type { PreviewText } from '../../hooks/drawing/drawing-types';
import type { PreviewRenderHelpers } from './preview-renderer-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { UI_FONTS } from '../../config/text-rendering-config';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { OPACITY } from '../../config/color-config';
import { i18n } from '@/i18n';

/** Screen-px μετατόπιση της λέξης ώστε να μη σκεπάζει τον σταυρόνημα του κέρσορα (πάνω-δεξιά). */
const GHOST_TEXT_OFFSET_X = 8;
const GHOST_TEXT_OFFSET_Y = -8;

/**
 * Ζωγραφίζει το ghost-φάντασμα της λέξης στη θέση εισαγωγής. Η θέση έρχεται ήδη flush-to-face (όταν
 * υπάρχει παρειά) από τον generator· εδώ γίνεται μόνο world→screen + i18n resolve + ημιδιάφανο fill.
 */
export function renderPreviewText(
  ctx: CanvasRenderingContext2D,
  entity: PreviewText,
  transform: ViewTransform,
  h: PreviewRenderHelpers,
): void {
  const pos = CoordinateTransforms.worldToScreen(entity.position, transform, h.viewport);
  const label = i18n.t('tools.text', { ns: 'dxf-viewer-shell' });
  // ADR-508 §text-parity (2-click) — στη rotation phase η λέξη περιστρέφεται κατά τη γωνία κλίσης.
  // DXF = CCW (Y-up)· canvas = CW (Y-down) → αντιστροφή προσήμου (ΙΔΙΑ σύμβαση με τον `TextRenderer`).
  const rotationRad = -((entity.rotationDeg ?? 0) * Math.PI) / 180;
  ctx.save();
  ctx.font = UI_FONTS.ARIAL.NORMAL;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = OPACITY.SUBTLE;
  ctx.fillStyle = PANEL_LAYOUT.CAD_COLORS.DRAWING_WHITE;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rotationRad);
  ctx.fillText(label, GHOST_TEXT_OFFSET_X, GHOST_TEXT_OFFSET_Y);
  ctx.restore();
}
