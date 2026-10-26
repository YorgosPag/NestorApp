/**
 * ADR-920 Β4.8 Β3.4 · ADR-650 M8β/Γ — η ΜΙΑ άλως εστίασης γραμμής ασυνέχειας στην κάτοψη.
 *
 * «Αυτήν κοιτάω τώρα» έχει την ίδια όψη είτε η γραμμή είναι υποψήφια υπό έγκριση
 * (`TopoAutoBreaklinePreviewOverlay`) είτε δεσμευμένη στην επιφάνεια (`TopoBreaklineOverlay`):
 * χρώμα επιλογής, πάχος `halo`, ημιδιαφανής — κάτω από τη γραμμή, ώστε να «ανάβει» χωρίς να σβήνει
 * ό,τι διασχίζει. Ένα σημείο ⇒ οι δύο όψεις δεν μπορούν να αποκλίνουν.
 */
import { UI_COLORS } from '../../../config/color-config';
import {
  AUTO_BREAKLINE_HALO_OPACITY, AUTO_BREAKLINE_STROKE_PX,
} from '../../../systems/topography/auto-breaklines/auto-breakline-review-style';
import type { BreaklineStrokeSpec } from './TopoBreaklineStroke';

export const BREAKLINE_FOCUS_HALO: BreaklineStrokeSpec = {
  color: UI_COLORS.SELECTION_HIGHLIGHT,
  widthPx: AUTO_BREAKLINE_STROKE_PX.halo,
  opacity: AUTO_BREAKLINE_HALO_OPACITY,
};
