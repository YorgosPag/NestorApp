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
 * ΣΥΓΧΡΟΝΑ εδώ (πιστό mirror τοίχου/δοκαριού), από τους pre-collected στόχους + τον
 * snapped cursor, μέσω του ΕΝΟΣ εγκεφάλου `resolveBimCursorSnap` (toolKind:'column').
 *
 * **ADR-514 Φ6d — κοινή assembly:** η συναρμολόγηση του ghost + CL listening dims +
 * polar/rect grid ζει πλέον σε ΕΝΑ entity-agnostic SSoT (`placement-ghost-assembly`)
 * που μοιράζονται κολώνα ΚΑΙ πέδιλο. Εδώ μένει μόνο το column-specific glue:
 * polar opts (διαστάσεις κολώνας), ο builder, και ο column-only slanted (TopLean) κλάδος.
 *
 * kind/anchor/overrides διαβάζονται από το ΥΠΑΡΧΟΝ `columnToolBridgeStore` (user-editable state).
 * Pure: zero React/DOM, ΙΔΙΑ δεδομένα με το commit path.
 *
 * @see ./column-completion.ts — buildDefaultColumnParams / buildColumnEntity (commit builders)
 * @see ../../bim/placement/placement-ghost-assembly.ts — κοινή assembly (ghost + CL dims + grid)
 * @see ../../bim/placement/bim-cursor-snap.ts — resolveBimCursorSnap (ADR-514 unified entry)
 * @see ../../systems/cursor/mouse-handler-up.ts — click-path commit (ίδιος resolver + στόχοι)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.10
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from './drawing-types';
import { DEFAULT_COLUMN_HEIGHT_MM } from '../../bim/types/column-types';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  resolveColumnHeadReferences,
  type ColumnParamOverrides,
  type SceneUnits,
} from './column-completion';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { buildColumnPolarSnapOptions } from '../../bim/columns/column-polar-opts';
import { getColumnRotationLock } from '../../systems/cursor/ColumnRotationStore';
import {
  assemblePlacementGhost,
  assemblePlacementRotationGhost,
  type PlacementGhostEntityBuilder,
} from '../../bim/placement/placement-ghost-assembly';
// ADR-404 Φ5 §slanted — live tilt preview (2ο κλικ: βάση→κορυφή) — column-only, εκτός κοινής assembly.
import { getColumnTopLeanLock } from '../../systems/cursor/ColumnTopLeanStore';
import { resolveTopLeanTilt } from '../../bim/columns/column-tilt-from-points';
import { resolveStoreyHeightMm } from '../../systems/levels/storey-creation-defaults';
import { toWysiwygPreviewEntity, resolveEffectivePreviewCursor } from './wysiwyg-preview-shared';
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
 * @param effectiveCursorOverride ADR-544 — ΗΔΗ-snapped cursor από το **3D** placement (το 3D snap
 *   ζει εκτός του 2D `ImmediateSnapStore`, οπότε το `resolveEffectivePreviewCursor` εκεί θα διάβαζε
 *   stale 2D snap). Όταν δίνεται, παρακάμπτει το `getImmediateSnap()` → οι διαστάσεις/πλέγμα
 *   υπολογίζονται στο σωστό 3D σημείο. 2D: παραλείπεται → ίδια συμπεριφορά με πριν.
 */
export function generateColumnPreview(
  cursorPoint: Readonly<Point2D>,
  sceneUnits: SceneUnits = 'mm',
  effectiveCursorOverride?: Readonly<Point2D>,
): ExtendedSceneEntity | null {
  const handle = columnToolBridgeStore.get();
  if (!handle?.isActive) return null;

  // ADR-398 §3.13 — Polar/Rect Magnet opts (zoom + Shift fractions + edge clearance), ίδια με το commit.
  // §3.19 — `handle.kind` → circle radius (tangent candidates μόνο σε κυκλική).
  const polarOpts = buildColumnPolarSnapOptions(handle.overrides, sceneUnits, handle.kind);
  const targets = sceneSnapTargetsStore.get();

  // entity-specific builder — ΙΔΙΟΙ builders με το commit (preview ≡ commit). λοξή ακμή → flush rotation·
  // ελεύθερη → null (ribbon/Tab rotation από τα overrides).
  const buildColumnGhostEntity: PlacementGhostEntityBuilder = (position, anchor, rotation, sizing) => {
    const overrides: ColumnParamOverrides = {
      ...handle.overrides,
      kind: handle.kind,
      anchor,
      ...(rotation !== null ? { rotation } : {}),
      // ADR-525 — L corner-gap auto-junction: ρητές διαστάσεις σκελών (autoSized:false → user-wins).
      ...(sizing ? {
        width: sizing.widthMm,
        depth: sizing.depthMm,
        lshape: { armWidth: sizing.armWidthMm, armLength: sizing.armLengthMm, flipY: sizing.flipY },
        autoSized: false,
      } : {}),
    };
    const params = buildDefaultColumnParams(position, handle.kind, overrides, sceneUnits);
    const built = buildColumnEntity(params, defaultLayerId(), sceneUnits);
    return built.ok ? built.entity : null;
  };

  // ADR-508 §column place+rotate — μετά το 1ο κλικ (awaitingRotation): η κολώνα μένει στην ΚΛΕΙΔΩΜΕΝΗ
  // θέση και ΠΕΡΙΣΤΡΕΦΕΤΑΙ live προς τον κέρσορα. Κρατά το πολικό/καρτεσιανό πλέγμα (ΕΝΑ SSoT assembly).
  const rot = getColumnRotationLock();
  if (rot) {
    return assemblePlacementRotationGhost({
      origin: rot.origin,
      anchor: rot.anchor,
      cursor: cursorPoint,
      targets,
      sceneUnits,
      polarOpts,
      ghostId: 'preview_column_ghost',
      buildEntity: buildColumnGhostEntity,
    });
  }

  // ADR-404 Φ5 §slanted — μετά το 1ο κλικ (awaitingTopLean): η κολώνα μένει στη ΣΤΑΘΕΡΗ βάση και ΓΕΡΝΕΙ
  // live προς τον κέρσορα. **column-only** (το πέδιλο δεν γέρνει) → εκτός κοινής assembly.
  const lean = getColumnTopLeanLock();
  if (lean) {
    const wpp = worldPerPixel(getImmediateTransform().scale);
    const heightMm = resolveStoreyHeightMm(handle.overrides.height, DEFAULT_COLUMN_HEIGHT_MM);
    const tilt = resolveTopLeanTilt(lean.basePoint, cursorPoint, heightMm, sceneUnits, wpp);
    const overrides: ColumnParamOverrides = {
      ...handle.overrides, kind: handle.kind, anchor: lean.anchor, rotation: lean.rotationDeg, tilt,
    };
    const params = buildDefaultColumnParams(lean.basePoint, handle.kind, overrides, sceneUnits);
    const built = buildColumnEntity(params, defaultLayerId(), sceneUnits);
    return built.ok ? toWysiwygPreviewEntity(built.entity, 'preview_column_ghost', null) : null;
  }

  // ADR-398 §3.10 — awaitingPosition: sync-in-preview face-snap (ΕΝΑΣ εγκέφαλος, ΙΔΙΑ opts/targets/cursor
  // με το commit) → κοινή assembly (ghost + CL listening dims + polar/rect grid). ⚠️ effectiveCursor ΗΔΗ
  // snapped → ΧΩΡΙΣ findSnapPoint (no double-snap, ADR-514 §2).
  const effectiveCursor = effectiveCursorOverride ?? resolveEffectivePreviewCursor(cursorPoint);
  const snap = resolveBimCursorSnap({
    toolKind: 'column',
    cursor: effectiveCursor,
    targets,
    sceneUnits,
    columnOpts: polarOpts,
    columnHead: resolveColumnHeadReferences(handle.kind, handle.overrides, sceneUnits),
    lShapeGhost: handle.kind === 'L-shape', // ADR-525 — ενεργοποίηση corner-gap auto-junction tier
  });
  return assemblePlacementGhost({
    snap,
    effectiveCursor,
    targets,
    sceneUnits,
    polarOpts,
    fallbackAnchor: handle.anchor,
    ghostId: 'preview_column_ghost',
    buildEntity: buildColumnGhostEntity,
  });
}
