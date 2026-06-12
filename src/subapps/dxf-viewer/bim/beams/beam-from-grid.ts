/**
 * ADR-441 Slice GEN-BEAM — «Δοκάρια από κάναβο» (beams on grid axis segments).
 *
 * Pure builder: μία δοκός σε κάθε **segment άξονα** (intersection-to-intersection,
 * mirror της εσχάρας/τοίχων), **born-hosted** με start/end x/y bindings → ακολουθεί
 * τον άξονα από τη γέννα μέσω του `beamHostingStrategy` (ADR-441 Slice GEN-BEAM). Το
 * generation layer χτίζει μόνο τις δεμένες δοκούς.
 *
 * ΚΛΕΙΔΙ SSoT: ο segment enumerator είναι ΑΥΤΟΥΣΙΟΣ ο `enumerateGridStrips` της
 * εσχάρας — τα bindings που παράγει (`start-x`/`end-x`/`start-y`/`end-y`) είναι ΑΚΡΙΒΩΣ
 * τα slots των δοκαριών (όπως ήδη τοίχοι & συνδετήριες). Μηδέν duplication των loops. Η
 * δοκός μπαίνει με centerline ΠΑΝΩ στον άξονα (Revit beam-on-grid· μηδέν extend).
 *
 * v1 scope: create-only ΧΩΡΙΣ auto-miter στις γωνίες (Revit beams=frame-into στις
 * στηρίξεις, ΟΧΙ monolithic corner-fill σαν θεμελίωση → beam-join = DEFER). **Frame-into
 * κολωνών (Revit):** αν κάθεται κολώνα σε άκρο, το άκρο τραβιέται στην **παρειά** της
 * (face-to-face) μέσω του ΚΟΙΝΟΥ `trimSegmentEndpointsToColumns` (ίδια μηχανή με τους
 * τοίχους· `GuideBinding.extend` → follow-move-safe). Μηδέν κολώνες → centerline στον άξονα.
 *
 * @see bim/foundations/foundation-from-grid.ts — enumerateGridStrips (SSoT segment enumerator)
 * @see hooks/drawing/beam-completion.ts — beam builder SSoT
 * @see bim/columns/column-face-trim.ts — kind-agnostic frame-into SSoT
 * @see bim/walls/wall-from-grid.ts — γραμμικό πρότυπο
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §8
 */

import type { BeamEntity } from '../types/beam-types';
import type { ColumnEntity } from '../types/column-types';
import type { GuideBinding } from '../hosting/guide-binding-types';
import {
  enumerateGridStrips,
  gridAxesFromReader,
  type AxisGuideReader,
} from '../foundations/foundation-from-grid';
import {
  completeBeamFromTwoClicks,
  type BeamParamOverrides,
} from '../../hooks/drawing/beam-completion';
import { trimSegmentEndpointsToColumns } from '../columns/column-face-trim';
import type { SceneUnits } from '../../utils/scene-units';

export interface BuildBeamGridResult {
  readonly ok: boolean;
  /** Όταν `ok=false`: λιγότεροι από 2 ορατοί άξονες ανά διεύθυνση. */
  readonly reason?: 'insufficient-guides';
  readonly beams: readonly BeamEntity[];
  /** Πλήθος segments που απορρίφθηκαν από τον validator (degenerate). */
  readonly ignoredCount: number;
}

/**
 * Build ΜΙΑ δεμένη δοκό σε segment. `null` αν ο validator απορρίψει τα params. Το
 * `guideBindings` tag-άρεται όπως οι τοίχοι/συνδετήριες (`{ ...entity, guideBindings }`).
 * Πάντα 'straight' (segments αξόνων = ευθείες). Αν κάθεται κολώνα σε άκρο, το άκρο
 * τραβιέται στην **παρειά** της (frame-into)· αλλιώς centerline στον άξονα.
 */
function buildBoundBeam(
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
  bindings: readonly GuideBinding[],
  layerId: string,
  overrides: BeamParamOverrides,
  sceneUnits: SceneUnits,
  columns: readonly ColumnEntity[],
): BeamEntity | null {
  const trimmed = trimSegmentEndpointsToColumns(start, end, bindings, columns, sceneUnits);
  const result = completeBeamFromTwoClicks(trimmed.start, trimmed.end, layerId, 'straight', overrides, sceneUnits);
  if (!result.ok) return null;
  return { ...result.entity, guideBindings: trimmed.bindings };
}

/**
 * Παράγει μία born-bound δοκό σε κάθε segment άξονα του κανάβου. Σύνολο =
 * nX·(nY-1) + nY·(nX-1) δοκοί (π.χ. 3×3 → 12). `layerId` = currentLevelId (ίδιο με
 * τον beam draw tool). `columns` (προαιρετικό): οι κολώνες της σκηνής → τα άκρα δοκαριών
 * που πέφτουν σε κολώνα τραβιούνται στην παρειά της (Revit frame-into)· follow-move δωρεάν
 * μέσω hosting strategy.
 */
export function buildBeamGridFromGuides(
  reader: AxisGuideReader,
  overrides: BeamParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
  columns: readonly ColumnEntity[] = [],
): BuildBeamGridResult {
  const axes = gridAxesFromReader(reader);
  if (!axes) {
    return { ok: false, reason: 'insufficient-guides', beams: [], ignoredCount: 0 };
  }

  const beams: BeamEntity[] = [];
  let ignoredCount = 0;
  enumerateGridStrips(axes, ({ start, end, bindings }) => {
    const beam = buildBoundBeam(start, end, bindings, layerId, overrides, sceneUnits, columns);
    if (beam) beams.push(beam);
    else ignoredCount++;
  });

  return { ok: true, beams, ignoredCount };
}
