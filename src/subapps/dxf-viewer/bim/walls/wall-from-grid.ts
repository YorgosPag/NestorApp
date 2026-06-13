/**
 * ADR-441 Slice GEN-WALL — «Τοίχοι από κάναβο» (walls on grid axis segments).
 *
 * Pure builder: ένας τοίχος σε κάθε **segment άξονα** (intersection-to-intersection,
 * mirror της εσχάρας θεμελίωσης), **born-hosted** με start/end x/y bindings → ακολουθεί
 * τον άξονα από τη γέννα μέσω του ΥΠΑΡΧΟΝΤΟΣ hosting reconciler (ADR-441 Slice WALL,
 * committed f992df62). Το generation layer χτίζει μόνο τους δεμένους τοίχους.
 *
 * ΚΛΕΙΔΙ SSoT: ο segment enumerator είναι ΑΥΤΟΥΣΙΟΣ ο `enumerateGridStrips` της
 * εσχάρας — τα bindings που παράγει (`start-x`/`end-x`/`start-y`/`end-y`) είναι ΑΚΡΙΒΩΣ
 * τα slots των τοίχων. Μηδέν duplication των loops. Ο τοίχος μπαίνει με centerline ΠΑΝΩ
 * στον άξονα (Revit «Wall Centerline» location line· μηδέν extend).
 *
 * @see bim/foundations/foundation-from-grid.ts — enumerateGridStrips (SSoT segment enumerator)
 * @see hooks/drawing/wall-completion.ts — wall builder SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import type { ColumnEntity } from '../types/column-types';
import type { GuideBinding } from '../hosting/guide-binding-types';
import type { StripJustification } from '../types/foundation-types';
import {
  enumerateGridStrips,
  gridAxesFromReader,
  type AxisGuideReader,
} from '../foundations/foundation-from-grid';
import {
  DEFAULT_GRID_PERIMETER_MODE,
  type GridPerimeterMode,
} from '../grid/grid-justification';
import { justifyGridSegment } from '../grid/grid-segment-justification';
import {
  buildDefaultWallParams,
  buildWallEntity,
  resolveWallThicknessMm,
  type WallParamOverrides,
} from '../../hooks/drawing/wall-completion';
import type { SceneUnits } from '../../utils/scene-units';
import { trimWallEndpointsToColumns } from './wall-column-trim';

export interface BuildWallGridResult {
  readonly ok: boolean;
  /** Όταν `ok=false`: λιγότεροι από 2 ορατοί άξονες ανά διεύθυνση. */
  readonly reason?: 'insufficient-guides';
  readonly walls: readonly WallEntity[];
  /** Πλήθος segments που απορρίφθηκαν από τον validator (degenerate). */
  readonly ignoredCount: number;
}

/**
 * Build ΕΝΑΝ δεμένο τοίχο σε segment. `null` αν ο validator απορρίψει τα params.
 * Το `guideBindings` tag-άρεται όπως το host-on-snap του wall tool
 * (`{ ...entity, guideBindings }`). Πάντα 'straight' (segments αξόνων = ευθείες).
 *
 * Αν κάθεται κολώνα σε άκρο, το άκρο τραβιέται στην **παρειά** της (face-to-face,
 * μέσω `GuideBinding.extend` → follow-move-safe). Μηδέν κολώνες → centerline στον άξονα.
 */
function buildBoundWall(
  start: Readonly<Point2D>,
  end: Readonly<Point2D>,
  bindings: readonly GuideBinding[],
  justification: StripJustification,
  layerId: string,
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  columns: readonly ColumnEntity[],
): WallEntity | null {
  const trimmed = trimWallEndpointsToColumns(start, end, bindings, columns, sceneUnits);
  // ADR-441 3-mode — Revit «Wall Location Line»: center/finish-interior/finish-exterior.
  // Κάθετη μετατόπιση ±thickness/2 + extend στα perpendicular bindings (follow-move-safe).
  const thicknessMm = resolveWallThicknessMm(overrides);
  const justified = justifyGridSegment(trimmed.start, trimmed.end, trimmed.bindings, thicknessMm, justification, sceneUnits);
  const params = buildDefaultWallParams(justified.start, justified.end, overrides, sceneUnits);
  const result = buildWallEntity(params, layerId, 'straight', sceneUnits);
  if (!result.ok) return null;
  return { ...result.entity, guideBindings: justified.bindings };
}

/**
 * Παράγει έναν born-bound τοίχο σε κάθε segment άξονα του κανάβου.
 * Σύνολο = nX·(nY-1) + nY·(nX-1) τοίχοι (π.χ. 3×3 → 12). `layerId` = currentLevelId
 * (ίδιο με τον wall draw tool). `columns` (προαιρετικό): οι κολώνες της σκηνής → τα
 * άκρα τοίχων που πέφτουν σε κολώνα τραβιούνται στην παρειά της (Revit face-to-face).
 */
export function buildWallGridFromGuides(
  reader: AxisGuideReader,
  overrides: WallParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
  columns: readonly ColumnEntity[] = [],
  mode: GridPerimeterMode = DEFAULT_GRID_PERIMETER_MODE,
): BuildWallGridResult {
  const axes = gridAxesFromReader(reader);
  if (!axes) {
    return { ok: false, reason: 'insufficient-guides', walls: [], ignoredCount: 0 };
  }

  const walls: WallEntity[] = [];
  let ignoredCount = 0;
  enumerateGridStrips(axes, ({ start, end, bindings, justification }) => {
    const wall = buildBoundWall(start, end, bindings, justification, layerId, overrides, sceneUnits, columns);
    if (wall) walls.push(wall);
    else ignoredCount++;
  }, mode);

  return { ok: true, walls, ignoredCount };
}
