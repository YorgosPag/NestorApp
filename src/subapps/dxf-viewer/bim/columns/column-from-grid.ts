/**
 * ADR-441 Slice GEN-COL — «Κολώνες από κάναβο» (columns at grid intersections).
 *
 * Pure builder: μία κολώνα σε κάθε τομή ορατών αξόνων X×Y, **born-hosted** με
 * `center-x`/`center-y` bindings (Revit «Column → At Grids») → ακολουθεί τον άξονα
 * από τη γέννα μέσω του ΥΠΑΡΧΟΝΤΟΣ hosting reconciler (ADR-441 Slice COL,
 * committed f992df62). Το generation layer χτίζει μόνο τις δεμένες κολώνες· το
 * follow-on-move δουλεύει ήδη.
 *
 * ΜΗΔΕΝ αναπαραγωγή geometry/builder — κάθε κολώνα περνά από το ΥΠΑΡΧΟΝ SSoT
 * `buildDefaultColumnParams`/`buildColumnEntity` (column-completion.ts). Ο
 * intersection enumerator μοιράζεται τον ίδιο axis reader με την εσχάρα θεμελίωσης
 * (`gridAxesFromReader`, minPerAxis=1: μία τομή = μία κολώνα).
 *
 * @see bim/foundations/foundation-from-grid.ts — gridAxesFromReader (SSoT axis reader)
 * @see hooks/drawing/column-completion.ts — column builder SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity } from '../types/column-types';
import type { GuideBinding } from '../hosting/guide-binding-types';
import {
  gridAxesFromReader,
  type AxisGuideReader,
  type GridAxes,
} from '../foundations/foundation-from-grid';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  type ColumnParamOverrides,
} from '../../hooks/drawing/column-completion';
import type { SceneUnits } from '../../utils/scene-units';

/** Προδιαγραφή ΜΙΑΣ κολώνας σε τομή αξόνων πριν χτιστεί entity/geometry. */
export interface GridColumnSpec {
  readonly position: Point2D;
  readonly bindings: readonly GuideBinding[];
}

export interface BuildColumnGridResult {
  readonly ok: boolean;
  /** Όταν `ok=false`: λιγότεροι από 1 ορατός άξονας ανά διεύθυνση. */
  readonly reason?: 'insufficient-guides';
  readonly columns: readonly ColumnEntity[];
  /** Πλήθος τομών που απορρίφθηκαν από τον validator (degenerate params). */
  readonly ignoredCount: number;
}

/** Push callback — emit ΜΙΑ τομή. */
type PushColumn = (spec: GridColumnSpec) => void;

/**
 * SSoT enumeration των τομών X×Y με τα `center-x`/`center-y` bindings τους.
 * Χρησιμοποιείται από τον entity builder ΚΑΙ (μελλοντικά) από live ghost — μηδέν
 * duplication των nested loops.
 */
export function enumerateGridIntersections(axes: GridAxes, cb: PushColumn): void {
  for (let xi = 0; xi < axes.xs.offsets.length; xi++) {
    for (let yi = 0; yi < axes.ys.offsets.length; yi++) {
      cb({
        position: { x: axes.xs.offsets[xi], y: axes.ys.offsets[yi] },
        bindings: [
          { guideId: axes.xs.ids[xi], slot: 'center-x' },
          { guideId: axes.ys.ids[yi], slot: 'center-y' },
        ],
      });
    }
  }
}

/**
 * Build ΜΙΑ δεμένη κολώνα στην τομή. `null` αν ο validator απορρίψει τα params.
 * Το `guideBindings` tag-άρεται με τον ίδιο τρόπο που το κάνει το host-on-snap του
 * column tool (`{ ...entity, guideBindings }`).
 */
function buildBoundColumn(
  position: Readonly<Point2D>,
  bindings: readonly GuideBinding[],
  layerId: string,
  overrides: ColumnParamOverrides,
  sceneUnits: SceneUnits,
): ColumnEntity | null {
  const params = buildDefaultColumnParams(position, overrides.kind, overrides, sceneUnits);
  const result = buildColumnEntity(params, layerId, sceneUnits);
  if (!result.ok) return null;
  return { ...result.entity, guideBindings: bindings };
}

/**
 * Παράγει μία born-bound κολώνα σε κάθε τομή ορατών αξόνων του κανάβου.
 * Σύνολο = nX·nY κολώνες (π.χ. 3×3 → 9). `layerId` = currentLevelId (ίδιο με τον
 * column draw tool).
 */
export function buildColumnGridFromGuides(
  reader: AxisGuideReader,
  overrides: ColumnParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
): BuildColumnGridResult {
  const axes = gridAxesFromReader(reader, 1);
  if (!axes) {
    return { ok: false, reason: 'insufficient-guides', columns: [], ignoredCount: 0 };
  }

  const columns: ColumnEntity[] = [];
  let ignoredCount = 0;
  enumerateGridIntersections(axes, ({ position, bindings }) => {
    const col = buildBoundColumn(position, bindings, layerId, overrides, sceneUnits);
    if (col) columns.push(col);
    else ignoredCount++;
  });

  return { ok: true, columns, ignoredCount };
}
