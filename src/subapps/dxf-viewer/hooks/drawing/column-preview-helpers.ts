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
import type { PlacementGhostEntity } from '../../bim/placement/placement-overlay-fields';
import { DEFAULT_COLUMN_HEIGHT_MM, type ColumnParams } from '../../bim/types/column-types';
import {
  buildColumnEntity,
  buildDefaultColumnParams,
  resolveColumnHeadReferences,
  type ColumnParamOverrides,
  type SceneUnits,
} from './column-completion';
// ADR-503 preview ≡ commit — ο ΙΔΙΟΣ auto-sizer με το commit (τρέχει στο `drawing:entity-created`).
import { resolveStructuralCode } from '../../bim/structural/codes';
import { useStructuralSettingsStore } from '../../state/structural-settings-store';
import { suggestColumnSection } from '../../bim/structural/sizing/column-sizing';
import { isColumnAutoSized } from '../../bim/structural/sizing/column-size-patch';
import type { StructuralCodeProvider } from '../../bim/structural/codes/structural-code-types';
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
import { applyBimDrawingConstraint } from './bim-ortho-reference';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getDefaultLayerId } from '../../stores/LayerStore';


/**
 * ADR-503 preview ≡ commit — αντανάκλαση του proactive auto-sizer που τρέχει στο
 * `drawing:entity-created` (useProactiveMemberSizing → AutoSizeMembersCommand →
 * `buildColumnSizePatch`). Μια default ΤΕΤΡΑΓΩΝΗ 400×400 ορθογώνια κολόνα «μικραίνει»
 * two-way στην ελάχιστη επαρκή διατομή (EC8 250×250 για μεμονωμένη κολόνα): έτσι το
 * φάντασμα έδειχνε 400×400 ενώ η τοποθετημένη κατέληγε 250×250 (Giorgio 2026-07-02:
 * «το φάντασμα μεγαλύτερο από την κολόνα»). Reuse του ΙΔΙΟΥ SSoT (`suggestColumnSection`
 * + `isColumnAutoSized`) με το commit ⇒ ghost size == committed size by construction.
 * `femMoment` absent (χωρίς οργανισμό/φορτίο πριν την τοποθέτηση) → nominal e₀ fallback,
 * ίδιο με το πρώτο post-commit pass μιας μεμονωμένης κολόνας. Locked (`autoSized:false`,
 * π.χ. L corner-gap / adopt-rect) ή μη-ορθογώνια → `suggestColumnSection`/`isColumnAutoSized`
 * επιστρέφουν no-op → αμετάβλητο (ρητή διάσταση χρήστη). Pure — zero React/DOM.
 */
function autoSizeGhostColumnParams(
  params: ColumnParams,
  provider: StructuralCodeProvider,
): ColumnParams {
  if (!isColumnAutoSized(params)) return params;
  const suggested = suggestColumnSection(provider, params);
  if (!suggested) return params;
  if (params.width === suggested.widthMm && params.depth === suggested.depthMm) return params;
  return { ...params, width: suggested.widthMm, depth: suggested.depthMm, autoSized: true };
}

/**
 * ADR-564 §footprint-hud — προσαρτά στο column ghost τα δεδομένα που χρειάζεται ο footprint HUD
 * painter (`paintColumnHud`): footprint κορυφές + params (kind/width/depth/rotation/height). Ο
 * `drawing-hover-handler` το διαβάζει και ζωγραφίζει live πλάτος/βάθος ανά παρειά + ∠ γωνία + ύψος
 * κατά την τοποθέτηση (parity με τον τοίχο). Τα δεδομένα ζουν ΗΔΗ στο ghost (ColumnEntity) — απλή
 * αναφορά, μηδέν αντιγραφή γεωμετρίας. No-op σε degenerate ghost.
 */
function attachColumnHud(ghost: ExtendedSceneEntity | null): PlacementGhostEntity | null {
  if (!ghost) return ghost;
  const ce = ghost as unknown as {
    geometry?: { footprint?: { vertices?: readonly Point2D[] } };
    params?: ColumnParams;
  };
  const footprint = ce.geometry?.footprint?.vertices;
  const params = ce.params;
  if (!footprint || footprint.length === 0 || !params) return ghost;
  // ADR-663 §4 part 4 — το `columnHud` δηλώνεται πλέον στον SSoT (`PlacementOverlayFields`), οπότε
  // το augmented ghost τυπώνεται κανονικά· μηδέν cast (ADR-544 ολοκληρωμένο).
  return { ...ghost, columnHud: { footprint, params } };
}

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

  // ADR-503 preview ≡ commit — ενεργός κανονισμός (ίδιο SSoT με το `useProactiveMemberSizing`),
  // για να «μικρύνει» το φάντασμα στην ίδια ελάχιστη επαρκή διατομή που θα αυτο-διαστασιολογηθεί
  // η κολόνα μόλις τοποθετηθεί. Resolve μία φορά ανά frame.
  const sizingProvider = resolveStructuralCode(useStructuralSettingsStore.getState().codeId);

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
    // ADR-503 — αντανάκλαση του commit-time auto-sizer (400×400 → 250×250 minimum adequate).
    const sized = autoSizeGhostColumnParams(params, sizingProvider);
    const built = buildColumnEntity(sized, getDefaultLayerId(), sceneUnits);
    return built.ok ? built.entity : null;
  };

  // ADR-508 §column place+rotate — μετά το 1ο κλικ (awaitingRotation): η κολώνα μένει στην ΚΛΕΙΔΩΜΕΝΗ
  // θέση και ΠΕΡΙΣΤΡΕΦΕΤΑΙ live προς τον κέρσορα. Κρατά το πολικό/καρτεσιανό πλέγμα (ΕΝΑ SSoT assembly).
  const rot = getColumnRotationLock();
  if (rot) {
    return attachColumnHud(assemblePlacementRotationGhost({
      origin: rot.origin,
      anchor: rot.anchor,
      cursor: cursorPoint,
      targets,
      sceneUnits,
      polarOpts,
      ghostId: 'preview_column_ghost',
      buildEntity: buildColumnGhostEntity,
    }));
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
    // ADR-503 — ίδιο auto-size με τους υπόλοιπους κλάδους (κεκλιμένη ορθογώνια κολόνα).
    const sized = autoSizeGhostColumnParams(params, sizingProvider);
    const built = buildColumnEntity(sized, getDefaultLayerId(), sceneUnits);
    return built.ok ? attachColumnHud(toWysiwygPreviewEntity(built.entity, 'preview_column_ghost')) : null;
  }

  // ADR-398 §3.10 — awaitingPosition: sync-in-preview face-snap (ΕΝΑΣ εγκέφαλος, ΙΔΙΑ opts/targets/cursor
  // με το commit) → κοινή assembly (ghost + CL listening dims + polar/rect grid). ⚠️ effectiveCursor ΗΔΗ
  // snapped → ΧΩΡΙΣ findSnapPoint (no double-snap, ADR-514 §2).
  // ADR-363 §column-ortho — ΟΡΘΟ(F8)/POLAR(F10)/step(F9+Q) εφαρμόζονται ΜΕΤΑ το OSNAP ώστε το
  // directional lock να ΥΠΕΡΙΣΧΥΕΙ της έλξης (AutoCAD: με SNAP ON, το ΟΡΘΟ/βήμα κερδίζει — αλλιώς το
  // `resolveEffectivePreviewCursor` επέστρεφε πάντα το snap point και το ΟΡΘΟ/Q «δεν άκουγαν»). No-op
  // όταν όλα off ή δεν υπάρχει αναφορά (προηγούμενη κολόνα) → ίδια συμπεριφορά με πριν.
  const snappedCursor = effectiveCursorOverride ?? resolveEffectivePreviewCursor(cursorPoint);
  const effectiveCursor = applyBimDrawingConstraint('column', snappedCursor, worldPerPixel(getImmediateTransform().scale));
  const snap = resolveBimCursorSnap({
    toolKind: 'column',
    cursor: effectiveCursor,
    targets,
    sceneUnits,
    columnOpts: polarOpts,
    columnHead: resolveColumnHeadReferences(handle.kind, handle.overrides, sceneUnits),
    lShapeGhost: handle.kind === 'L-shape', // ADR-525 — ενεργοποίηση corner-gap auto-junction tier
  });
  return attachColumnHud(assemblePlacementGhost({
    snap,
    effectiveCursor,
    targets,
    sceneUnits,
    polarOpts,
    fallbackAnchor: handle.anchor,
    ghostId: 'preview_column_ghost',
    buildEntity: buildColumnGhostEntity,
  }));
}
