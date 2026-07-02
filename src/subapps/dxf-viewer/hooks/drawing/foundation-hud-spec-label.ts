/**
 * ADR-564 §foundation-hud — ΜΙΑ πηγή αλήθειας για τις ετικέτες του live Foundation HUD.
 *
 * Αδελφό των `beam-hud-spec-label` / `column-hud-spec-label` (N.11-clean: η μετάφραση ζει εδώ,
 * ΟΧΙ στους pure painters `wall-hud-paint` / `column-hud-paint`, τους οποίους ξαναχρησιμοποιεί το
 * πέδιλο ως γραμμικό (strip/tie-beam) ή footprint (pad) μέλος). Δύο αρχέτυπα:
 *   · γραμμικό (strip/tie-beam) → «b X · h Y» (πλάτος band × βάθος διατομής) όπως το δοκάρι,
 *   · pad (footprint) → «βάθος X» (single vertical label, mirror του column «ύψος X» — το πέδιλο
 *     δείχνει πλάτος/μήκος ήδη ως aligned δ. στις παρειές μέσω `paintFootprintHud`).
 * Μονάδες εμφάνισης μέσω του κοινού `formatLengthForDisplay`.
 *
 * @see ./beam-hud-spec-label.ts — ο αδελφός του δοκαριού (γραμμικό)
 * @see ./column-hud-spec-label.ts — ο αδελφός της κολόνας (footprint)
 * @see ../../canvas-v2/preview-canvas/wall-hud-paint.ts — paintWallHud (γραμμικός pure painter)
 * @see ../../canvas-v2/preview-canvas/column-hud-paint.ts — paintFootprintHud (footprint pure painter)
 */

import { i18n } from '@/i18n';
import { formatLengthForDisplay } from '../../config/display-length-format';

/**
 * Μεταφρασμένη ετικέτα «b X · h Y» (display units) του γραμμικού πεδίλου (strip/tie-beam):
 * `widthMm` = πλάτος band κάθετα στον άξονα, `heightMm` = βάθος διατομής (`thicknessMm`).
 */
export function buildFoundationHudSpecLabel(widthMm: number, heightMm: number): string {
  return i18n.t('tools.foundation.hudSpec', {
    width: formatLengthForDisplay(widthMm),
    height: formatLengthForDisplay(heightMm),
    ns: 'dxf-viewer-shell',
  });
}

/** Μεταφρασμένη ετικέτα «βάθος X» (display units) του footprint πεδίλου (pad) από το βάθος (mm). */
export function buildFoundationPadHudSpecLabel(depthMm: number): string {
  return i18n.t('tools.foundation.padHudSpec', {
    depth: formatLengthForDisplay(depthMm),
    ns: 'dxf-viewer-shell',
  });
}
