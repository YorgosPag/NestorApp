/**
 * Mouse Up — Marquee / Point-click selection processing
 * Extracted from mouse-handler-up.ts (ADR-065 SRP split, file-size <500).
 * Pure helpers: window/crossing marquee, region/crop intercepts, lasso fallback,
 * single point hit-test. No React state — driven by a MarqueeContext snapshot.
 */

import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { isRegionBoxSelectTool } from '../tools/region-tool-ids';
import { UniversalMarqueeSelector } from '../selection/UniversalMarqueeSelection';
import { EventBus } from '../events/EventBus';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import type { CentralizedMouseHandlersProps } from './mouse-handler-types';
import type { ViewTransform } from '../../rendering/types/Types';
// ADR-358 Phase 9D-5b-ii Sub-D — Entity type bridge for performSelection narrow.
import type { Entity, SceneModel } from '../../types/entities';
// ADR-408 — circuits are derived (not scene entities), so the marquee selector can't see
// them; hit-test the same wire polylines the overlay draws for window/crossing selection.
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import { resolveCircuitWirePaths } from '../../bim/mep-systems/mep-wire-scene';
import { selectCircuitsInMarquee } from '../../bim/mep-systems/mep-wire-hit';
// ADR-501 Slice 2 — grip marquee arming: a window over visible grips arms them
// (orange) instead of selecting new entities (AutoCAD/Revit "hot grips").
import { ArmableGripsStore } from '../grip/ArmableGripsStore';
import { runGripMarqueeArm } from '../grip/grip-marquee-arm';
// ADR-358 Q19 Φ3b — 2D «click-into»: 2nd click on the sole-selected stair → tread sub-select.
import { handleStairClickInto2D } from '../../bim/stairs/stair-click-into-2d';
import { handleTableLinkClick2D } from '../../bim/table/table-link-interaction-2d';
// ADR-659 — ArchiCAD repeated-click overlap disambiguation (2nd click same point → cycle).
import { resolveRepeatedClickCycle } from '../selection/resolve-repeated-click-cycle';

export interface MarqueeContext {
  cursor: ReturnType<typeof import('./CursorSystem').useCursor>;
  /**
   * ADR-040 Φάση XXII.B — **δεν είναι prop**, και γι' αυτό δεν δηλώνεται σαν prop.
   *
   * Το `transform` αφαιρέθηκε από το `CentralizedMouseHandlersProps` (ως prop έμενε φρέσκο
   * μόνο όσο το DxfCanvas ξανα-render-άρονταν ανά καρέ)· ο καλών το διαβάζει πλέον από το
   * SSoT **τη στιγμή του συμβάντος** (`getImmediateTransform()` στο `mouse-handler-up`).
   * Η indexed-access δήλωση που ζούσε εδώ έδειχνε σε πεδίο που **δεν υπάρχει** — έμενε ως
   * τύπος σφάλματος, δηλαδή το συμβόλαιο του context ήταν άγραφο ακριβώς στο πεδίο που
   * καθορίζει **κάθε** μετατροπή οθόνης→κόσμου αυτού του module.
   */
  transform: ViewTransform;
  viewport: CentralizedMouseHandlersProps['viewport'];
  canvasRef: CentralizedMouseHandlersProps['canvasRef'];
  colorLayers: CentralizedMouseHandlersProps['colorLayers'];
  scene: CentralizedMouseHandlersProps['scene'];
  hitTestCallback: CentralizedMouseHandlersProps['hitTestCallback'];
  onEntitySelect: CentralizedMouseHandlersProps['onEntitySelect'];
  onCanvasClick: CentralizedMouseHandlersProps['onCanvasClick'];
  onLayerSelected: CentralizedMouseHandlersProps['onLayerSelected'];
  onMultiLayerSelected: CentralizedMouseHandlersProps['onMultiLayerSelected'];
  onEntitiesSelected: CentralizedMouseHandlersProps['onEntitiesSelected'];
  onUnifiedMarqueeResult: CentralizedMouseHandlersProps['onUnifiedMarqueeResult'];
  activeTool: CentralizedMouseHandlersProps['activeTool'];
  overlayMode: CentralizedMouseHandlersProps['overlayMode'];
}

/**
 * 🔴 N.18 (CHECK 3.28) — **Η ΜΙΑ κλήση του επιλογέα πλαισίου.**
 *
 * Υπήρχε **δύο** φορές σε αυτό το αρχείο, με τα ίδια έξι ορίσματα και μόνη διαφορά ένα σχόλιο:
 * μία για το box-select των region εργαλείων και μία για την κανονική επιλογή. Ο token-based
 * ανιχνευτής τις έπιανε ως clone **13 γραμμών** — και είχε δίκιο: δύο αντίγραφα της ίδιας
 * παραμετροποίησης αποκλίνουν στην πρώτη αλλαγή ανοχής ή στο πρώτο νέο πεδίο επιλογών, και
 * τότε το «ίδιο» πλαίσιο θα επέλεγε **άλλα** αντικείμενα ανάλογα με το εργαλείο.
 *
 * ⚠️ Το `ctx.cursor.position` / `selectionStart` διαβάζονται **εδώ**, τη στιγμή της κλήσης: ο
 * καλών έχει ήδη επαληθεύσει ότι υπάρχουν (ο έλεγχος ζει στο `mouse-handler-up`, πριν καν
 * κληθεί αυτό το module).
 */
function runMarqueeSelection(
  ctx: MarqueeContext,
  rect: Parameters<typeof UniversalMarqueeSelector.performSelection>[3],
): ReturnType<typeof UniversalMarqueeSelector.performSelection> {
  const { cursor, transform, colorLayers, scene } = ctx;
  return UniversalMarqueeSelector.performSelection(
    cursor.selectionStart!,
    cursor.position!,
    transform,
    rect,
    {
      colorLayers: colorLayers ?? [],
      // ADR-358 Phase 9D-5b-ii Sub-D — bridge cast: `SceneModel.entities: DxfEntityUnion[]` vs
      // `Entity[]` expected by performSelection. Resolved at schema flip Phase 9D-5b-iii.
      entities: (scene?.entities ?? []) as unknown as Entity[],
      tolerance: TOLERANCE_CONFIG.HIT_TEST_FALLBACK,
      enableDebugLogs: false,
      onLayerSelected: undefined,
      currentPosition: cursor.position!,
    },
  );
}

export function processMarqueeSelection(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
) {
  // Boy Scout (N.0.2): τα `hitTestCallback` / `onEntitySelect` / `overlayMode` ήταν ήδη νεκρά
  // εδώ (ταξιδεύουν μέσα στο `ctx` προς το `processPointClick`), και το `colorLayers` έγινε
  // νεκρό με την εξαγωγή του `runMarqueeSelection`. Καμία αλλαγή συμπεριφοράς.
  const { cursor, transform, canvasRef, scene, onCanvasClick,
    onLayerSelected, onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
    activeTool } = ctx;

  const canvas = canvasRef?.current ?? null;
  const marqueeSnap = getPointerSnapshotFromElement(canvas);

  // ADR-501 Slice 2 — grip marquee: when grips are visible (a selection exists) and
  // the box catches ≥1 armable grip, arm those grips (orange) and CONSUME the
  // marquee — do NOT select entities. Only in grip mode (select/layering); with no
  // grip inside, falls through to the unchanged entity-marquee (no regression).
  if ((activeTool === 'select' || activeTool === 'layering') && marqueeSnap) {
    const armed = runGripMarqueeArm(
      cursor.selectionStart!,
      cursor.position!,
      transform,
      { width: marqueeSnap.rect.width, height: marqueeSnap.rect.height },
      e.shiftKey,
      ArmableGripsStore.getSnapshot(),
    );
    if (armed) return;
  }

  // ADR-363 Phase 1K Mode C / «Τοίχος από περίγραμμα» — box-select: intercept the
  // marquee → run window/crossing selection to collect entities → hand their ids to
  // the wall tool via EventBus (in-region detects enclosed rectangles; outer-perimeter
  // analyses the faces → leg walls). MUST NOT mutate selection (mirrors crop-window).
  if (isRegionBoxSelectTool(activeTool) && marqueeSnap) {
    const regionResult = runMarqueeSelection(ctx, marqueeSnap.rect);
    const entityIds = regionResult.breakdown?.entityIds ?? [];
    if (entityIds.length > 0) {
      EventBus.emit('bim:wall-region-box-select', { entityIds });
    }
    return;
  }

  // Crop-window: intercept marquee → emit world-space rect, skip normal selection
  if (activeTool === 'crop-window' && marqueeSnap) {
    const worldStart = screenToWorldWithSnapshot(cursor.selectionStart!, transform, marqueeSnap);
    const worldEnd = screenToWorldWithSnapshot(cursor.position!, transform, marqueeSnap);
    EventBus.emit('crop:marquee-rect', {
      xMin: Math.min(worldStart.x, worldEnd.x),
      yMin: Math.min(worldStart.y, worldEnd.y),
      xMax: Math.max(worldStart.x, worldEnd.x),
      yMax: Math.max(worldStart.y, worldEnd.y),
    });
    return;
  }

  const hasMultiCallback = !!onMultiLayerSelected;
  const hasSingleCallback = !!onLayerSelected;
  const hasEntityCallback = !!onEntitiesSelected;
  const hasUnifiedCallback = !!onUnifiedMarqueeResult;

  if (!marqueeSnap || !(hasUnifiedCallback || hasMultiCallback || hasSingleCallback || hasEntityCallback)) return;

  const selectionResult = runMarqueeSelection(ctx, marqueeSnap.rect);

  // Small selection = point click, large empty selection = deselect.
  const selectionWidth = Math.abs(cursor.position!.x - cursor.selectionStart!.x);
  const selectionHeight = Math.abs(cursor.position!.y - cursor.selectionStart!.y);
  const MIN_MARQUEE_SIZE = 5;
  const isSmallSelection = selectionWidth < MIN_MARQUEE_SIZE && selectionHeight < MIN_MARQUEE_SIZE;

  // ADR-408 — window/crossing over circuit home-run wires. Only for real drag boxes: a
  // click-sized box is a wire CLICK, owned by the wire-click pointer FSM, not the marquee.
  // Uses the result's own world bounds + window/crossing verdict (zero recomputation).
  let circuitIds: string[] = [];
  if (!isSmallSelection) {
    // ADR-358 bridge cast (same as the entities narrow above) — DxfScene ⇄ SceneModel.
    const paths = resolveCircuitWirePaths(scene as unknown as SceneModel, useMepSystemStore.getState().systems);
    if (paths.length > 0) {
      circuitIds = selectCircuitsInMarquee(
        selectionResult.selectionBounds,
        selectionResult.selectionType === 'crossing',
        paths,
      );
    }
  }

  if (selectionResult.selectedIds.length > 0 || circuitIds.length > 0) {
    const breakdown = selectionResult.breakdown;
    const layerAndOverlayIds = [...(breakdown?.layerIds ?? []), ...(breakdown?.overlayIds ?? [])];
    const entityIds = breakdown?.entityIds ?? [];

    if (hasUnifiedCallback) {
      onUnifiedMarqueeResult!({ layerIds: layerAndOverlayIds, entityIds, circuitIds, subtract: e.shiftKey });
    } else {
      if (layerAndOverlayIds.length > 0) {
        if (hasMultiCallback) onMultiLayerSelected!(layerAndOverlayIds);
        else if (hasSingleCallback) layerAndOverlayIds.forEach(id => onLayerSelected!(id, cursor.position!));
      }
      if (entityIds.length > 0 && hasEntityCallback) onEntitiesSelected!(entityIds);
    }
  } else {
    if (isSmallSelection) {
      processPointClick(e, ctx);
    } else if (onCanvasClick) {
      const emptySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (!emptySnap) return;
      const emptyScreenPos = getScreenPosFromEvent(e, emptySnap);
      const worldPt = screenToWorldWithSnapshot(emptyScreenPos, transform, emptySnap);
      onCanvasClick(worldPt, e.shiftKey);
    }
  }
}

export function processPointClick(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
) {
  const { transform, colorLayers, hitTestCallback, onEntitySelect, onCanvasClick,
    onLayerSelected, onMultiLayerSelected, scene, activeTool, overlayMode } = ctx;

  const hitTestSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
  if (!hitTestSnap) return;
  const freshScreenPos = getScreenPosFromEvent(e, hitTestSnap);
  const worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, hitTestSnap);

  // Step 1: Check overlay polygons (point-in-polygon)
  let hitLayerId: string | null = null;
  if (colorLayers && colorLayers.length > 0) {
    for (const layer of colorLayers) {
      if (!layer.polygons || layer.polygons.length === 0) continue;
      for (const polygon of layer.polygons) {
        if (!polygon.vertices || polygon.vertices.length < 3) continue;
        const vertices = polygon.vertices;
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
          const xi = vertices[i].x, yi = vertices[i].y;
          const xj = vertices[j].x, yj = vertices[j].y;
          if (((yi > worldPoint.y) !== (yj > worldPoint.y)) &&
              (worldPoint.x < (xj - xi) * (worldPoint.y - yi) / (yj - yi) + xi)) {
            inside = !inside;
          }
        }
        if (inside) { hitLayerId = layer.id; break; }
      }
      if (hitLayerId) break;
    }
  }

  if (hitLayerId) {
    if (onMultiLayerSelected) onMultiLayerSelected([hitLayerId]);
    else if (onLayerSelected) onLayerSelected(hitLayerId, freshScreenPos);
  } else if (hitTestCallback && onEntitySelect) {
    const isDrawing = isInDrawingMode(activeTool, overlayMode);
    if (!isDrawing) {
      const hitResult = hitTestCallback(scene, freshScreenPos, transform, hitTestSnap.viewport);
      if (hitResult) onEntitySelect(hitResult, e.shiftKey || e.ctrlKey || e.metaKey);
    }
    if (onCanvasClick) onCanvasClick(worldPoint, e.shiftKey);
  } else if (onCanvasClick) {
    onCanvasClick(worldPoint, e.shiftKey);
  }
}

/**
 * Το **σκέτο κλικ** χωρίς πλαίσιο: τι επιλέγει, και πότε ξεκινά πλαίσιο δύο κλικ.
 *
 * Εξήχθη από το `mouse-handler-up` (N.7.1 — το αρχείο είχε φτάσει στις **491/500**) και ζει
 * **εδώ**, όχι σε νέο αδελφό: η κεφαλίδα αυτού του module δηλώνει ήδη το «*single point
 * hit-test*» στο πεδίο ευθύνης του, και το μπλοκ είναι κυριολεκτικά ο **άλλος κλάδος** του
 * `if (marquee)` που ζει από πάνω — ίδιο συμβάν, ίδιο συμβόλαιο, ίδιο `MarqueeContext`. Ένα
 * τρίτο αρχείο θα ήταν διπλότυπο ευθύνης (N.18), όχι διαχωρισμός.
 *
 * ⚠️ Το `return` εδώ σημαίνει «**η χειρονομία καταναλώθηκε**» — ήταν έξοδος του ίδιου του
 * χειριστή, και είναι ισοδύναμο επειδή το μπλοκ ήταν η **τελευταία** εντολή του.
 *
 * @param wasPanning το pan κατέχει τη χειρονομία — δεν ξεκινά πλαίσιο στο τέλος του
 */
export function processSinglePointPick(
  e: React.MouseEvent<HTMLCanvasElement>,
  ctx: MarqueeContext,
  { wasPanning }: { readonly wasPanning: boolean },
): void {
  const { cursor, transform, canvasRef, scene, hitTestCallback,
    onEntitySelect, onEntitiesSelected, activeTool, overlayMode } = ctx;
  if (!cursor.position || !hitTestCallback) return;
  if (isInDrawingMode(activeTool, overlayMode)) return;

  const hitSnap = getPointerSnapshotFromElement(canvasRef?.current ?? null);
  if (!hitSnap) return;
  const hitResult = hitTestCallback(scene, cursor.position, transform, hitSnap.viewport);
  const additive = e.shiftKey || e.ctrlKey || e.metaKey;
  // ADR-358 Q19 Φ3b — «click-into»: a 2nd plain click on the sole-selected stair, over a
  // tread, enters that sub-element (host stays selected) and CONSUMES the click. Any other
  // click clears a stale sub-selection. Mirror of the 3D `handleClick` gesture.
  const worldClick = screenToWorldWithSnapshot(getScreenPosFromEvent(e, hitSnap), transform, hitSnap);
  // 🔴 ADR-751 — Ctrl+κλικ πάνω σε e-mail / ιστοσελίδα / τηλέφωνο μέσα σε κελί πίνακα ανοίγει
  // τον προορισμό και ΚΑΤΑΝΑΛΩΝΕΙ το κλικ. Μπαίνει **πριν** από κάθε άλλη διαδρομή επειδή
  // είναι η πιο **ρητή** πρόθεση που μπορεί να εκφράσει ο χρήστης εδώ (modifier + ακριβές
  // κείμενο). Διαβάζει `e.ctrlKey` και όχι το `additive` της επόμενης γραμμής: το `additive`
  // περιλαμβάνει Shift και ⌘, που σημαίνουν πολλαπλή επιλογή και πρέπει να συνεχίσουν να τη
  // σημαίνουν. Επιστρέφει `true` **μόνο** όταν υπάρχει πράγματι σύνδεσμος κάτω από τον δείκτη.
  if (handleTableLinkClick2D(hitResult, e.ctrlKey, worldClick, scene?.entities as unknown as readonly Entity[] | undefined)) {
    return;
  }
  if (handleStairClickInto2D(hitResult, additive, worldClick, scene?.entities as unknown as readonly Entity[] | undefined)) {
    return;
  }
  // ADR-659 — repeated-click overlap disambiguation: when the click lands on a stack
  // (≥2 under cursor), a 2nd click on the SAME point cycles to the next candidate (opens
  // the popover + canvas pre-highlight). The 1st click just arms and falls through to the
  // normal top-1 selection below (fast path untouched). Skipped on empty space / additive.
  // hitResult is the top-1 entity id (string) or null — NOT an object. A truthy id means
  // an entity sits under the cursor; the resolver re-runs hitTestAll to read the full stack.
  if (hitResult && !additive && onEntitiesSelected) {
    const consumed = resolveRepeatedClickCycle({
      screenPos: cursor.position,
      clientX: e.clientX,
      clientY: e.clientY,
      transform,
      viewport: hitSnap.viewport,
      additive,
      selectEntityById: (id) => onEntitiesSelected([id]),
      // Bug fix (2026-07-17) — entity lookup so the popover can show a semantic
      // label (slab role/thickness/elevation) instead of the raw entity-type +
      // internal level id.
      resolveEntity: (id) => scene?.entities?.find((en) => en.id === id) as Entity | undefined,
    });
    if (consumed) return;
  }
  if (onEntitySelect) onEntitySelect(hitResult, additive);
  // No entity + select tool + clean left-click → start two-click selection (AutoCAD: click→move→click)
  if (!hitResult && activeTool === 'select' && e.button === 0 && !wasPanning && !additive) {
    cursor.startSelection(getScreenPosFromEvent(e, hitSnap));
  }
}
