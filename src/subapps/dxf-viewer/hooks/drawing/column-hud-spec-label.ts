/**
 * ADR-508 §column-hud — ΜΙΑ πηγή αλήθειας για την ετικέτα «ύψος X» του live Column HUD (grip drag).
 *
 * Αδελφό του `wall-hud-spec-label` (N.11-clean: η μετάφραση ζει εδώ, ΟΧΙ στον pure painter
 * `column-hud-paint`). Μονάδες εμφάνισης μέσω του κοινού `formatLengthForDisplay`.
 *
 * @see ../../canvas-v2/preview-canvas/column-hud-paint.ts — paintColumnHud (pure painter)
 * @see ./wall-hud-spec-label.ts — ο αδελφός του τοίχου
 */

import { i18n } from '@/i18n';
import { formatLengthForDisplay } from '../../config/display-length-format';

/** Μεταφρασμένη ετικέτα «ύψος X» (display units) από το ύψος κολόνας σε mm. */
export function buildColumnHudSpecLabel(heightMm: number): string {
  return i18n.t('tools.column.hudSpec', {
    height: formatLengthForDisplay(heightMm),
    ns: 'dxf-viewer-shell',
  });
}
