/**
 * @module block-preview-helpers
 * @description Pure helper for the Block Library single-click placement tool real-time
 * **WYSIWYG** preview (ADR-652 §M1 place-block-from-library). Mirror of `column-preview-helpers.ts`
 * / `foundation-preview-helpers.ts` (ADR-514 Φ6d) adapted to a free single-click member — the block
 * placement tool has NO face-snap resolver (no `BimCursorSnap` toolKind for blocks, ADR-600 free-point
 * placement) — so the ghost follows the raw cursor and only borrows the ΚΟΙΝΑ neighbor-clearance dims
 * + footprint HUD painters that column/foundation already use, ΟΧΙ the shared `assemblePlacementGhost`
 * (that one requires a resolved `ColumnFaceSnap`).
 *
 * WYSIWYG ghost: the entity IS the final `BlockEntity` (`buildGhostBlockEntity` — same transient
 * builder as the footprint helper, ADR-040 zero clone/id-gen per frame), flagged `wysiwygPreview` so
 * `PreviewCanvas` draws it through the real block renderer instead of a schematic outline.
 *
 * **preview === commit**: `buildBlockPlacementParams` (ΚΟΙΝΟΣ SSoT, `place-block-from-library.ts`) is
 * the ΙΔΙΟΣ mapper the commit path (`useBlockLibraryTool.buildParams`) uses — cursor+ribbon overrides
 * → placement params, μηδέν διπλότυπο (N.18).
 *
 * Two phases (mirror column/foundation, ADR-514 Φ6d §column place+rotate):
 *   · awaitingRotation (μετά το 1ο κλικ, `PlacementRotationStore` — ΚΟΙΝΟ lock με κολόνα/πέδιλο):
 *     το block μένει στην ΚΛΕΙΔΩΜΕΝΗ θέση και ΠΕΡΙΣΤΡΕΦΕΤΑΙ live προς τον κέρσορα. Το τόξο/πορτοκαλί
 *     γραμμή τα ζωγραφίζει το κοινό overlay από το ΙΔΙΟ lock — τίποτα εδώ.
 *   · awaitingPosition (πριν το 1ο κλικ): ελεύθερο ghost που ακολουθεί τον κέρσορα ως κέντρο +
 *     neighbor-clearance dims (Revit temporary dims, `resolveClearanceDimsForGhost`) + footprint HUD
 *     (πάντα ορθογώνιο AABB — `computeBlockFootprint`).
 *
 * «Ποιο block» έρχεται από το `block-library-selection-store` (palette → tool SSoT)· τα placement
 * overrides (rotation/scale) από το `blockLibraryToolBridgeStore` (tool → ribbon SSoT). Pure: zero
 * React/DOM, ΙΔΙΑ δεδομένα με το commit path.
 *
 * @see ../../bim/block-library/place-block-from-library.ts — buildBlockPlacementParams / buildGhostBlockEntity
 * @see ../../bim/block-library/block-library-footprint.ts — computeBlockFootprint
 * @see ../../bim/framing/clearance-dims.ts — resolveClearanceDimsForGhost
 * @see ./column-preview-helpers.ts · ./foundation-preview-helpers.ts — mirror
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from './drawing-types';
import type { PlacementGhostEntity } from '../../bim/placement/placement-overlay-fields';
import type { SceneUnits } from '../../utils/scene-units';
import type { FootprintHudDescriptor } from '../../canvas-v2/preview-canvas/column-hud-paint';
import { getSelectedBlockName } from '../../bim/block-library/block-library-selection-store';
import { getSessionBlockDef } from '../../bim/block-library/block-library-registry';
import {
  buildBlockPlacementParams,
  buildGhostBlockEntity,
} from '../../bim/block-library/place-block-from-library';
import { computeBlockFootprint } from '../../bim/block-library/block-library-footprint';
import { blockLibraryToolBridgeStore } from '../../ui/ribbon/hooks/bridge/block-library-tool-bridge-store';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { resolveClearanceDimsForGhost } from '../../bim/framing/clearance-dims';
import { getPlacementRotationLock } from '../../systems/cursor/PlacementRotationStore';
import { resolveColumnRotationDeg } from '../../bim/columns/column-rotation';
import { toWysiwygPreviewEntity } from './wysiwyg-preview-shared';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';

const GHOST_ID = 'block-library-ghost';

/**
 * ADR-652 §M7 footprint-hud — προσαρτά στο block ghost τα δεδομένα του ΚΟΙΝΟΥ footprint HUD painter
 * (`paintFootprintHud`, ίδιος με κολόνα/πέδιλο): footprint κορυφές (πάντα ορθογώνιο AABB — το block
 * footprint είναι πάντα ο transformed bounding box, `computeBlockFootprint`) + ελάχιστος
 * `FootprintHudDescriptor` (`kind:'rectangular'` + γωνία τοποθέτησης). Το block δεν έχει δικό του
 * «βάθος/ύψος» spec (mirror: το πέδιλο δείχνει «βάθος X», η κολώνα «ύψος X») → κενή ετικέτα (N.11:
 * κανένα hardcoded string). No-op σε degenerate footprint (block χωρίς μετρήσιμη γεωμετρία).
 */
function attachBlockFootprintHud(
  ghost: PlacementGhostEntity,
  footprint: readonly Point2D[],
  rotationDeg: number,
): PlacementGhostEntity {
  if (footprint.length === 0) return ghost;
  const descriptor: FootprintHudDescriptor = { kind: 'rectangular', rotationDeg };
  return { ...ghost, footprintHud: { footprint, descriptor, heightSpecLabel: '' } };
}

/**
 * Build the Block Library WYSIWYG preview entity for the current cursor frame. Returns a full
 * `BlockEntity` flagged `wysiwygPreview` (rendered through the real block renderer), or `null` when
 * no block is selected / no session def resolves (ghost simply clears that frame — mirror column).
 *
 * @param cursorPoint raw cursor world position (the free ghost follows it as its centre).
 * @param sceneUnits  active scene units — passed through for signature parity with the commit path;
 *   blocks are self-consistent in scene units (no mm→scene conversion, see `useBlockLibraryTool`).
 */
export function generateBlockLibraryPreview(
  cursorPoint: Readonly<Point2D>,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  const blockName = getSelectedBlockName();
  if (!blockName) return null;
  const def = getSessionBlockDef(blockName);
  if (!def) return null;

  const overrides = blockLibraryToolBridgeStore.get()?.overrides ?? {};
  const wpp = worldPerPixel(getImmediateTransform().scale);
  const targets = sceneSnapTargetsStore.get();

  // ADR-514 Φ6d §place+rotate — μετά το 1ο κλικ (awaitingRotation, ΚΟΙΝΟ lock με κολόνα/πέδιλο): το
  // block μένει στην ΚΛΕΙΔΩΜΕΝΗ θέση και ΠΕΡΙΣΤΡΕΦΕΤΑΙ live προς τον κέρσορα. Το τόξο/πορτοκαλί γραμμή
  // τα ζωγραφίζουν τα κοινά overlays (drawing-hover-handler) από το ΙΔΙΟ lock — μηδέν εδώ.
  const rot = getPlacementRotationLock();
  if (rot) {
    const deg = resolveColumnRotationDeg(rot.origin, cursorPoint, wpp);
    const params = buildBlockPlacementParams(rot.origin, { ...overrides, rotation: deg }, sceneUnits);
    return toWysiwygPreviewEntity(buildGhostBlockEntity(def, params), GHOST_ID);
  }

  // awaitingPosition — ελεύθερο ghost (χωρίς face-snap, ADR-600 free-point placement) που ακολουθεί
  // τον κέρσορα ως κέντρο + neighbor-clearance dims (Revit temporary dims, preview ≡ commit builder).
  const params = buildBlockPlacementParams(cursorPoint, overrides, sceneUnits);
  const entity = buildGhostBlockEntity(def, params);
  const footprint: Point2D[] = computeBlockFootprint(def, params).map((p) => ({ x: p.x, y: p.y }));
  const faceDimensions = footprint.length > 0
    ? resolveClearanceDimsForGhost(footprint, targets, sceneUnits, wpp)
    : null;
  const ghost = toWysiwygPreviewEntity(entity, GHOST_ID, { faceDimensions });
  return attachBlockFootprintHud(ghost, footprint, params.rotation ?? 0);
}
