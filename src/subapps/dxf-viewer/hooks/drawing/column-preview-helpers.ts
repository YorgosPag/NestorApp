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
 * **preview === commit (ADR-398 §3.10 sync-in-preview):** υπολογίζει το face-snap
 * ΣΥΓΧΡΟΝΑ εδώ (πιστό mirror τοίχου/δοκαριού — `makeWallGhostBeforeClick`), από:
 *   · στόχους → `columnPreviewStore.get()` (pre-collected κολόνες/δοκάρια/τοίχοι/πλάκες)·
 *   · cursor  → `resolveEffectivePreviewCursor` = `getImmediateSnap()` (snapped point που
 *               έγραψε ο scheduler: corner-projection / BIM χαρακτηριστικό / grid)·
 *   · resolver→ `resolveColumnFaceSnapFromTargets` (ΕΝΑ SSoT) → θέση + λαβή + status + faceFrame.
 * Το commit (`mouse-handler-up`) καλεί ΤΟΝ ΙΔΙΟ resolver με τους ΙΔΙΟΥΣ στόχους + ίδιο cursor
 * → preview ≡ commit εξ ορισμού (κανένα async store, καμία διπλή πηγή αλήθειας).
 *
 * kind/anchor/overrides διαβάζονται από το ΥΠΑΡΧΟΝ `columnToolBridgeStore` (user-editable state).
 * Pure: zero React/DOM, ΙΔΙΑ δεδομένα με το commit path.
 *
 * @see ./column-completion.ts — buildDefaultColumnParams / buildColumnEntity (commit builders)
 * @see ../../bim/columns/column-face-snap.ts — resolveColumnFaceSnapFromTargets (θέση/λαβή/status SSoT)
 * @see ../../bim/columns/column-preview-store.ts — pre-collected στόχοι (sync-in-preview)
 * @see ../../systems/cursor/mouse-handler-up.ts — click-path commit (ίδιος resolver + στόχοι)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.10
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
import type { ColumnGhostStatus } from '../../systems/cursor/ColumnPlacementGhostStatusStore';
import { columnPreviewStore } from '../../bim/columns/column-preview-store';
import { resolveColumnFaceSnapFromTargets } from '../../bim/columns/column-face-snap';
import { getColumnRotationLock } from '../../systems/cursor/ColumnRotationStore';
import { resolveColumnRotationDeg } from '../../bim/columns/column-rotation';
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

  // ADR-508 §column place+rotate — μετά το 1ο κλικ (awaitingRotation): η κολώνα μένει στην
  // ΚΛΕΙΔΩΜΕΝΗ θέση και ΠΕΡΙΣΤΡΕΦΕΤΑΙ live προς τον κέρσορα (raw → ελεύθερη γωνία). Καμία
  // overlap/dims εδώ (πέρα από την τοποθέτηση). 2ο κλικ commit-άρει με αυτή τη γωνία.
  const rot = getColumnRotationLock();
  if (rot) {
    const rotationDeg = resolveColumnRotationDeg(rot.origin, cursorPoint, worldPerPixel(getImmediateTransform().scale));
    const overrides: ColumnParamOverrides = {
      ...handle.overrides, kind: handle.kind, anchor: rot.anchor, rotation: rotationDeg,
    };
    const params = buildDefaultColumnParams(rot.origin, handle.kind, overrides, sceneUnits);
    const built = buildColumnEntity(params, defaultLayerId(), sceneUnits);
    return built.ok ? toWysiwygPreviewEntity(built.entity, 'preview_column_ghost', null) : null;
  }

  // ADR-398 §3.10 — sync-in-preview (πιστό mirror τοίχου/δοκαριού): υπολόγισε το face-snap
  // ΣΥΓΧΡΟΝΑ εδώ από τους pre-collected στόχους (`columnPreviewStore`) + τον snapped cursor
  // (`getImmediateSnap` μέσω `resolveEffectivePreviewCursor` — ό,τι έγραψε ο scheduler:
  // corner-projection / BIM χαρακτηριστικό / grid). Το commit (`mouse-handler-up`) καλεί ΤΟΝ
  // ΙΔΙΟ resolver με τους ΙΔΙΟΥΣ στόχους + ίδιο cursor → preview ≡ commit εξ ορισμού.
  const effectiveCursor = resolveEffectivePreviewCursor(cursorPoint);
  const faceSnap = resolveColumnFaceSnapFromTargets(effectiveCursor, columnPreviewStore.get(), sceneUnits);

  // θέση + λαβή + status απευθείας από το ΕΝΑ αποτέλεσμα (ΟΧΙ από 3 stores). Η §3.9 wall-axis
  // επιστρέφει ήδη anchor `center`· face-attach (§3.7) υπερισχύει του §3.1b center-on-beam-axis.
  const position: Point2D = faceSnap ? faceSnap.position : effectiveCursor;
  const status: ColumnGhostStatus = faceSnap?.status ?? 'neutral';
  const anchor: ColumnAnchor = faceSnap?.anchor ?? handle.anchor;

  const overrides: ColumnParamOverrides = { ...handle.overrides, kind: handle.kind, anchor };
  const params = buildDefaultColumnParams(position, handle.kind, overrides, sceneUnits);
  const built = buildColumnEntity(params, defaultLayerId(), sceneUnits);
  if (!built.ok) return null;

  // 🔴 overlap → red status schematic (PreviewRenderer draws outline + 30% fill,
  // mirror beam). 🟢 beam / neutral → πλήρες WYSIWYG amber (το έγκυρο visual).
  const isOverlap = status === 'overlap';
  const ghostStatusColor = isOverlap ? resolveGhostStatusColor('overlap') : null;
  // ADR-508 §dim — listening dimensions (ΙΔΙΟΣ κοινός κώδικας με τοίχο/δοκάρι): από το faceFrame
  // του ΙΔΙΟΥ face-snap. `ghostHalfWidth=0` → αποστάσεις προς το κέντρο (Revit centerline).
  const wpp = worldPerPixel(getImmediateTransform().scale);
  const faceDimensions = resolveGhostFaceDimensionsMeta(faceSnap?.faceFrame, isOverlap, sceneUnits, wpp);
  return toWysiwygPreviewEntity(built.entity, 'preview_column_ghost', ghostStatusColor, faceDimensions);
}
