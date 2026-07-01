/**
 * ADR-508 §wall-hud — ΜΙΑ πηγή αλήθειας για την ετικέτα «πάχος X · ύψος Y» του live Wall HUD.
 *
 * Καταναλώνεται ΚΑΙ από τη σχεδίαση (`drawing-hover-handler` — ghost τοίχου awaitingEnd) ΚΑΙ από
 * την επεξεργασία λαβών (`useGripDimAnnotation` — σύρσιμο λαβής υφιστάμενου τοίχου), ώστε το
 * μεταφρασμένο κείμενο + οι μονάδες εμφάνισης να παράγονται ΑΚΡΙΒΩΣ ίδια και στα δύο (full SSoT,
 * N.11-clean: η μετάφραση ζει εδώ, ΟΧΙ στον pure painter `wall-hud-paint`).
 *
 * @see ../../canvas-v2/preview-canvas/wall-hud-paint.ts — WallHudMeta + paintWallHud (pure painter)
 */

import { i18n } from '@/i18n';
import { formatLengthForDisplay } from '../../config/display-length-format';
import type { WallHudMeta } from '../../canvas-v2/preview-canvas/wall-hud-paint';

/** Μεταφρασμένη ετικέτα «πάχος X · ύψος Y» (display units) από τα αριθμητικά HUD δεδομένα. */
export function buildWallHudSpecLabel(meta: Pick<WallHudMeta, 'thicknessMm' | 'heightMm'>): string {
  return i18n.t('tools.wall.hudSpec', {
    thickness: formatLengthForDisplay(meta.thicknessMm),
    height: formatLengthForDisplay(meta.heightMm),
    ns: 'dxf-viewer-shell',
  });
}
