/**
 * ADR-531 Φ5b.2 (Tekton .TEK IMPORT — BIM structural) — mapper `TekWallRecord` → **native BIM**
 * `WallEntity` + hosted `OpeningEntity[]` (πόρτες/παράθυρα).
 *
 * Αντικαθιστά τον 2Δ-lines δρόμο (`tek-structural-to-scene::tekWallToEntities`): ο 3Δ τοίχος του
 * Τέκτονα γίνεται δική μας παραμετρική BIM οντότητα (editable/grips/properties), ΜΙΑ οντότητα που
 * ζωγραφίζει και 3Δ όγκο και 2Δ κατοψικό σύμβολο (απόφαση Giorgio 2026-07-10 — «μία οντότητα, δύο
 * όψεις», Revit-grade).
 *
 * Reuse (μηδέν geometry-math / builder duplication — μοτίβο `tek-stair-to-bim`):
 *   - matrix decode → SSoT `decodeWallXMatrix` / `decodeOpeningXMatrix` (`tek-geometry.ts`, inverse
 *     του export· round-trip-verified).
 *   - Y-flip + units → SSoT `tekMetersToScene`.
 *   - wall build → `buildDefaultWallParams` + `buildWallEntity`.
 *   - opening build → `completeOpeningFromHostClick` (project center→offset + build σε ΕΝΑ βήμα).
 *   - door/window → SSoT `isDoorStyle` (`tek-window-symbol`).
 *   - χρώμα → SSoT `tekColorToHex`.
 *
 * @module io/tek/tek-wall-to-bim
 */

import { type SceneUnits } from '../../utils/scene-units';
import {
  decodeWallXMatrix,
  decodeOpeningXMatrix,
  tekMetersToScene,
} from '../../export/core/tek/tek-geometry';
import { tekColorToHex } from './tek-color';
import { isDoorStyle } from './tek-window-symbol';
import {
  buildDefaultWallParams,
  buildWallEntity,
  type WallParamOverrides,
} from '../../hooks/drawing/wall-completion';
import {
  completeOpeningFromHostClick,
  type OpeningParamOverrides,
} from '../../hooks/drawing/opening-completion';
import type { WallEntity, WallParams } from '../../bim/types/wall-types';
import type { OpeningEntity, OpeningKind } from '../../bim/types/opening-types';
import type { TekWallRecord } from './tek-import-types';

/** Αποτέλεσμα mapping ενός `<wall>`: ο BIM τοίχος + τα κουφώματά του + τυχόν προειδοποιήσεις. */
export interface TekWallBimResult {
  /** `null` αν ο validator απέρριψε τον τοίχο (π.χ. μηδενικό μήκος) — ο caller τον παραλείπει. */
  readonly wall: WallEntity | null;
  readonly openings: readonly OpeningEntity[];
  readonly warnings: readonly string[];
}

/** Κάθε `<open>` κούφωμα → hosted `OpeningEntity` (ή warning αν απορριφθεί). */
function buildHostedOpenings(
  rec: TekWallRecord,
  hostWall: WallEntity,
  levelId: string,
  sceneUnits: SceneUnits,
  warnings: string[],
): OpeningEntity[] {
  const out: OpeningEntity[] = [];
  for (const o of rec.openings) {
    const { center, widthM } = decodeOpeningXMatrix(o.matrix);
    const centerScene = tekMetersToScene(center.x, center.y, sceneUnits);
    const kind: OpeningKind = isDoorStyle(o.style) ? 'door' : 'window';
    const heightMm = Math.max(0, o.topM - o.elevationM) * 1000;
    const overrides: OpeningParamOverrides = {
      kind,
      width: widthM * 1000,
      ...(heightMm > 0 ? { height: heightMm } : {}),
      sillHeight: o.elevationM * 1000,
    };
    const res = completeOpeningFromHostClick(hostWall, centerScene, levelId, overrides, sceneUnits);
    if (!res.ok) {
      warnings.push(`Κούφωμα .tek παραλείφθηκε: ${res.hardErrors.join('; ')}`);
      continue;
    }
    out.push(o.color ? { ...res.entity, color: tekColorToHex(o.color) } : res.entity);
  }
  return out;
}

/**
 * Map ενός `TekWallRecord` → BIM `WallEntity` + hosted `OpeningEntity[]`.
 *
 * Πάχος/ύψος → **mm** (WallParams σύμβαση), `elevation` → `baseOffset` (mm). `hostedOpeningIds`
 * mirror γεμίζεται ώστε ο `WallRenderer` να κόψει τις παρειές στα ανοίγματα (punchHostedOpenings).
 */
export function tekWallToBimEntities(
  rec: TekWallRecord,
  levelId: string,
  sceneUnits: SceneUnits = 'mm',
): TekWallBimResult {
  const warnings: string[] = [];
  const { start: startM, end: endM, thicknessM } = decodeWallXMatrix(rec.matrix);
  const start = tekMetersToScene(startM.x, startM.y, sceneUnits);
  const end = tekMetersToScene(endM.x, endM.y, sceneUnits);
  // Πάχος: v-scale του matrix· fallback στο <inner_width> αν degenerate (οριζόντιο δείγμα).
  const thicknessMm = (thicknessM > 1e-6 ? thicknessM : rec.innerWidthM) * 1000;
  const overrides: WallParamOverrides = {
    thickness: thicknessMm,
    ...(rec.heightM > 0 ? { height: rec.heightM * 1000 } : {}),
  };
  const params = buildDefaultWallParams(start, end, overrides, sceneUnits);
  const wallParams: WallParams = { ...params, baseOffset: rec.elevationM * 1000 };
  const result = buildWallEntity(wallParams, levelId, 'straight', sceneUnits);
  if (!result.ok) {
    warnings.push(`Τοίχος .tek παραλείφθηκε: ${result.hardErrors.join('; ')}`);
    return { wall: null, openings: [], warnings };
  }
  const wallColored: WallEntity = { ...result.entity, color: tekColorToHex(rec.color) };
  const openings = buildHostedOpenings(rec, wallColored, levelId, sceneUnits, warnings);
  const wall: WallEntity =
    openings.length > 0
      ? { ...wallColored, hostedOpeningIds: openings.map((o) => o.id) }
      : wallColored;
  return { wall, openings, warnings };
}
