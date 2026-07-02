/**
 * ADR-564 §linear-hud — ΜΙΑ πηγή αλήθειας για την ετικέτα «b X · h Y» του live Beam HUD.
 *
 * Αδελφό του `wall-hud-spec-label` (N.11-clean: η μετάφραση ζει εδώ, ΟΧΙ στον pure painter
 * `wall-hud-paint`, τον οποίο ξαναχρησιμοποιεί το δοκάρι ως γραμμικό μέλος). Το δοκάρι έχει
 * διατομή `width × depth` (πλάτος × δομικό βάθος) αντί για `πάχος × ύψος` του τοίχου — η μόνη
 * διαφορά είναι το i18n key. Μονάδες εμφάνισης μέσω του κοινού `formatLengthForDisplay`.
 *
 * @see ../../canvas-v2/preview-canvas/wall-hud-paint.ts — paintWallHud (κοινός pure painter)
 * @see ./wall-hud-spec-label.ts — ο αδελφός του τοίχου
 */

import { i18n } from '@/i18n';
import { formatLengthForDisplay } from '../../config/display-length-format';

/** Μεταφρασμένη ετικέτα «b X · h Y» (display units) από τη διατομή δοκαριού (mm). */
export function buildBeamHudSpecLabel(widthMm: number, depthMm: number): string {
  return i18n.t('tools.beam.hudSpec', {
    width: formatLengthForDisplay(widthMm),
    depth: formatLengthForDisplay(depthMm),
    ns: 'dxf-viewer-shell',
  });
}
