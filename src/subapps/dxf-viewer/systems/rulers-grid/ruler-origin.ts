/**
 * 🏢 SSoT — «Αρχική» θέση κόσμου (ADR-040 Phase XXII.B).
 *
 * Το world (0,0) αγκυρώνεται στην κάτω-αριστερή γωνία των χαράκων. Μέχρι το Phase XXII.B
 * η αγκύρωση ζούσε ΜΟΝΟ μέσα στο bootstrap effect του DxfCanvas, και το `resetToOrigin()`
 * (zoom-reset) βασιζόταν στο re-fire εκείνου του effect (interception μέσω του transform
 * prop). Με το transform εκτός React props, η αγκύρωση έγινε ρητή: ΚΑΙ το bootstrap ΚΑΙ
 * το zoom-reset καλούν αυτόν τον helper — ένα σημείο αλήθειας, μηδέν interception.
 */
import type { ViewTransform } from '../../rendering/types/Types';
import { RULERS_GRID_CONFIG } from './config';

/** Transform με scale 1 και world (0,0) στην κάτω-αριστερή γωνία των χαράκων. */
export function computeRulerOriginTransform(viewportHeight: number): ViewTransform {
  return {
    scale: 1,
    offsetX: RULERS_GRID_CONFIG.DEFAULT_RULER_WIDTH,
    offsetY: viewportHeight - RULERS_GRID_CONFIG.DEFAULT_RULER_HEIGHT,
  };
}
