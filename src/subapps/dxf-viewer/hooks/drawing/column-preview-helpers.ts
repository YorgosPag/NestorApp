/**
 * @module column-preview-helpers
 * @description Pure helper for the column tool real-time **WYSIWYG** preview.
 * Mirror of `beam-preview-helpers.ts` (ADR-398 §Smart beam ghost) adapted to a
 * single-click (point) member.
 *
 * WYSIWYG ghost (ADR-398 §3.8): η rubber-band επιστρέφει ΠΛΗΡΕΣ `ColumnEntity`
 * (μέσω του SSoT `buildDefaultColumnParams` + `buildColumnEntity` — ίδιοι builders
 * με το commit) flagged `wysiwygPreview`, οπότε ο PreviewCanvas το ζωγραφίζει μέσω
 * του ΠΡΑΓΜΑΤΙΚΟΥ `ColumnRenderer` (category fill / material hatch / lineweight)
 * αντί για τα 9 schematic anchor-ghosts. Το ghost ΕΙΝΑΙ η τελική κολώνα.
 *
 * **preview === commit (byte-for-byte):** διαβάζει ΑΚΡΙΒΩΣ τα ίδια imperative SSoT
 * που γράφει το §3.7 move/click path:
 *   · θέση  → `getImmediateSnap()` (snapped face/corner point — ό,τι κάνει commit
 *             το `mouse-handler-up`)·
 *   · λαβή  → `getColumnFaceAnchor()` ?? (`getColumnGhostStatus()==='beam'` ? center
 *             : ribbon/Tab anchor) — ΙΔΙΑ precedence με `commitColumnFromState`·
 *   · status→ `getColumnGhostStatus()` (🔴 overlap → red schematic, mirror beam·
 *             🟢/neutral → πλήρες WYSIWYG, όπως το έγκυρο δοκάρι).
 *
 * kind/anchor/overrides διαβάζονται από το ΥΠΑΡΧΟΝ `columnToolBridgeStore` (μηδέν
 * νέο preview-store — το bridge κρατά ήδη το user-editable state). Pure: zero
 * React/DOM, ΙΔΙΑ δεδομένα με το commit path.
 *
 * @see ./column-completion.ts — buildDefaultColumnParams / buildColumnEntity (commit builders)
 * @see ../../bim/columns/column-face-snap.ts — §3.7 face-snap (θέση/λαβή/status SSoT)
 * @see ../../systems/cursor/snap-scheduler.ts — move-path writer (ImmediateSnap + face anchor)
 * @see ../../systems/cursor/mouse-handler-up.ts — click-path commit (ίδιο snapped point)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from './drawing-types';
import type { ColumnAnchor } from '../../bim/types/column-types';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  type ColumnParamOverrides,
  type SceneUnits,
} from './column-completion';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import {
  getColumnFaceAnchor,
  getColumnGhostStatus,
  getColumnFaceFrame,
} from '../../systems/cursor/ColumnPlacementGhostStatusStore';
import { resolveGhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import {
  resolveEffectivePreviewCursor,
  toWysiwygPreviewEntity,
  resolveGhostFaceDimensionsMeta,
} from './wysiwyg-preview-shared';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { DXF_DEFAULT_LAYER } from '../../config/layer-config';
import { getLayer } from '../../stores/LayerStore';

const defaultLayerId = (): string => getLayer(DXF_DEFAULT_LAYER)?.id ?? '';

/**
 * Build the column WYSIWYG preview entity for the current cursor frame. Returns a
 * full `ColumnEntity` flagged `wysiwygPreview` (rendered through the real
 * `ColumnRenderer`), or `null` when the column tool is inactive / the would-be
 * column fails validation (so the preview simply clears that frame — mirror beam).
 *
 * @param cursorPoint raw cursor world position (fallback when no snap is armed).
 * @param sceneUnits  active scene units (mm→scene conversion inside the builder).
 */
export function generateColumnPreview(
  cursorPoint: Readonly<Point2D>,
  sceneUnits: SceneUnits = 'mm',
): ExtendedSceneEntity | null {
  const handle = columnToolBridgeStore.get();
  if (!handle?.isActive) return null;

  // Snapped point (face-snap position / corner-projected / raw) — ΤΟ ΙΔΙΟ σημείο
  // που κάνει commit το `mouse-handler-up` (το `snap-scheduler` το γράφει μέσω
  // `setImmediateSnap` στο ίδιο move). Κοινό SSoT με δοκάρι/τοίχο.
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);

  // Anchor precedence ≡ `commitColumnFromState` (preview === commit):
  //   1. face-snap auto λαβή (flush στην παρειά)· 2. 🟢 beam → center (κέντρο ≡
  //   άξονας)· 3. ο επιλεγμένος (ribbon/Tab) anchor.
  const status = getColumnGhostStatus();
  const faceAnchor = getColumnFaceAnchor();
  const anchor: ColumnAnchor = faceAnchor ?? (status === 'beam' ? 'center' : handle.anchor);

  const overrides: ColumnParamOverrides = { ...handle.overrides, kind: handle.kind, anchor };
  const params = buildDefaultColumnParams(effectiveCursor, handle.kind, overrides, sceneUnits);
  const built = buildColumnEntity(params, defaultLayerId(), sceneUnits);
  if (!built.ok) return null;

  // 🔴 overlap → red status schematic (PreviewRenderer draws outline + 30% fill,
  // mirror beam). 🟢 beam / neutral → πλήρες WYSIWYG amber (το έγκυρο visual).
  const isOverlap = status === 'overlap';
  const ghostStatusColor = isOverlap ? resolveGhostStatusColor('overlap') : null;
  // ADR-508 §dim — listening dimensions (ΙΔΙΟΣ κοινός κώδικας με τοίχο/δοκάρι): από το faceFrame
  // που έγραψε ο column face-snap. `ghostHalfWidth=0` → αποστάσεις προς το κέντρο (Revit centerline).
  const wpp = worldPerPixel(getImmediateTransform().scale);
  const faceDimensions = resolveGhostFaceDimensionsMeta(getColumnFaceFrame() ?? undefined, isOverlap, sceneUnits, wpp);
  return toWysiwygPreviewEntity(built.entity, 'preview_column_ghost', ghostStatusColor, faceDimensions);
}
