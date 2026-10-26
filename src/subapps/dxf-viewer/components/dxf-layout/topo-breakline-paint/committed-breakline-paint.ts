/**
 * ADR-920 Β4.8 Β3.5 — η ΜΙΑ όψη μιας ΔΕΣΜΕΥΜΕΝΗΣ ασυνέχειας στην οθόνη (SVG): περίβλημα, γραμμή με το μοτίβο της
 * πηγής z, κουκκίδες κορυφών — και η εστιασμένη παραλλαγή (πιο χοντρή, με την κοινή άλως στη θέση του περιβλήματος).
 *
 * Τη διαβάζουν η κάτοψη (`TopoBreaklineOverlay`) ΚΑΙ το δείγμα γραμμής της λίστας (`TopoBreaklinePatternSwatch`):
 * το υπόμνημα είναι ο ίδιος painter με τα ίδια specs, άρα δεν μπορεί να «λέει» άλλο μοτίβο από αυτό που ζωγραφίζεται.
 */
import { UI_COLORS } from '../../../config/color-config';
import type { BreaklineElevationSource } from '../../../systems/topography/topo-types';
import {
  breaklineDashPattern, breaklineSvgDasharray,
  TOPO_BREAKLINE_STROKE_PX, TOPO_BREAKLINE_VERTEX_DOT_PX, TOPO_BREAKLINE_VERTEX_OUTLINE_PX,
} from '../../../systems/topography/topo-breakline-style';
import { AUTO_BREAKLINE_STROKE_PX } from '../../../systems/topography/auto-breaklines/auto-breakline-review-style';
import type { BreaklineStrokeSpec, BreaklineVertexDots } from './TopoBreaklineStroke';
import { BREAKLINE_FOCUS_HALO } from './breakline-focus-halo';

const CASING: BreaklineStrokeSpec = {
  color: UI_COLORS.TOPO_BREAKLINE_CASING, widthPx: TOPO_BREAKLINE_STROKE_PX.casing,
};

export const COMMITTED_BREAKLINE_DOTS: BreaklineVertexDots = {
  diameterPx: TOPO_BREAKLINE_VERTEX_DOT_PX,
  fill: UI_COLORS.TOPO_BREAKLINE,
  outline: UI_COLORS.TOPO_BREAKLINE_CASING,
  outlinePx: TOPO_BREAKLINE_VERTEX_OUTLINE_PX,
};

export interface CommittedBreaklinePaint {
  readonly under: BreaklineStrokeSpec;
  readonly stroke: BreaklineStrokeSpec;
}

/** Under-stroke + main stroke for a breakline of this z-source (`undefined` = unknown ⇒ solid). */
export function committedBreaklinePaint(
  source: BreaklineElevationSource | undefined,
  focused: boolean,
): CommittedBreaklinePaint {
  const widthPx = focused ? AUTO_BREAKLINE_STROKE_PX.focused : TOPO_BREAKLINE_STROKE_PX.stroke;
  return {
    under: focused ? BREAKLINE_FOCUS_HALO : CASING,
    stroke: {
      color: UI_COLORS.TOPO_BREAKLINE,
      widthPx,
      dash: breaklineSvgDasharray(breaklineDashPattern(source), widthPx),
    },
  };
}
