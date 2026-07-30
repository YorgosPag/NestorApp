'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-408 Φ7 — Home-run circuit wires 2D painter hook.
 *
 * Strokes the **derived** wiring of every electrical circuit of the current floor
 * (panel → daisy-chained fixtures, with a home-run arrow at the panel). Geometry is
 * NOT persisted: it is recomputed on each content change from the live host
 * transforms via the SSoT `computeCircuitWirePaths`, so it follows moved/rotated
 * panels and fixtures for free.
 *
 * ADR-732 Batch 1 — no longer owns a `<canvas>`: returns «painter ή null» to the
 * shared zone-Β canvas (`Overlay2DDispatchCanvas`). The subscriptions (mep-system
 * store + objectStyles visibility slice) stay leaf-level (ADR-040, CHECK 6C safe) —
 * they live in the hook instead of the former component.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md (ζώνη Β)
 * @see ../../bim/mep-systems/mep-wire-routing (computeCircuitWirePaths — routing SSoT)
 * @see ../../bim/renderers/MepWireRenderer (drawCircuitWires — draw)
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { DxfEntityUnion, DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-726 Φ2 — sizing + πύλη + clear ζουν στο primitive του κοινού καμβά· εδώ μόνο «painter ή null».
import type { OverlayDispatchPainter } from './overlay-dispatch/overlay-dispatch-frame';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import {
  computeCircuitWirePaths,
  computeCircuitHostSegments,
  type ResolveWireHost,
} from '../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts, type WireHostXform } from '../../bim/mep-systems/mep-wire-resolver';
import { collectWireHosts } from '../../bim/mep-systems/mep-wire-scene';
import type { Entity } from '../../types/entities';
import { drawCircuitWires, drawWaypointHandles, DEFAULT_WIRE_COLOR } from '../../bim/renderers/MepWireRenderer';
import { useMepCircuitEditorStore } from '../../bim/mep-systems/mep-circuit-editor-store';
import { isElectricalSystemParams } from '../../bim/types/mep-system-types';
import {
  getWireWaypointHover,
  subscribeWireWaypointHover,
} from '../../bim/mep-systems/mep-wire-waypoint-ui-store';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';
// ADR-408 Φ7 P2 — live drag follow: the dragged host's wire endpoint reads the
// PREVIEWED entity (same SSoT the ghost uses), so the wire tracks the cursor.
import type { DxfGripDragPreview } from '../../hooks/grip-computation';
import { applyEntityPreview } from '../../rendering/ghost';
import { toEntityPreviewTransform } from '../../hooks/tools/grip-drag-preview-transform';

/**
 * Build the host-resolver from the render scene's connector hosts (fixtures +
 * panels). Collects each host's transform into a map, then delegates the
 * connector→world math to the shared `resolverFromHosts` SSoT (`mep-wire-resolver`).
 *
 * ADR-408 Φ7 P2 — when `dragPreview` targets a fixture/panel host, that host is
 * resolved from the PREVIEWED entity (`applyEntityPreview`, the same SSoT the live
 * ghost uses), so the wire endpoint follows the drag (move / rotation / corner)
 * frame-by-frame while the committed scene still holds the old transform.
 */
export function buildResolver(scene: DxfScene, dragPreview: DxfGripDragPreview | null): ResolveWireHost {
  // SSoT host collection (shared with click-select / marquee / auto-design bridges).
  const hosts = collectWireHosts(scene.entities as unknown as Entity[]);
  // ADR-408 Φ7 P2 — live drag follow: re-resolve ONLY the dragged host from the PREVIEWED
  // entity (same SSoT the ghost uses) so its wire endpoint tracks the cursor frame-by-frame.
  if (dragPreview) {
    const e = scene.entities.find((x) => x.id === dragPreview.entityId);
    if (e && (e.type === 'mep-fixture' || e.type === 'electrical-panel')) {
      const previewed = applyEntityPreview(e as unknown as DxfEntityUnion, toEntityPreviewTransform(dragPreview));
      // `applyEntityPreview` returns the same ref for a zero/identity drag → keep committed.
      if (previewed !== (e as unknown as DxfEntityUnion)) {
        const p = (previewed as unknown as { params: { position: { x: number; y: number }; rotation: number; mountingElevationMm?: number; connectors?: WireHostXform['connectors'] } }).params;
        hosts.set(e.id, {
          x: p.position.x,
          y: p.position.y,
          rotation: p.rotation,
          zMm: p.mountingElevationMm ?? 0,
          connectors: p.connectors ?? [],
        });
      }
    }
  }
  return resolverFromHosts(hosts);
}

/**
 * Ό,τι ορίζει **ΤΙ** ζωγραφίζεται· το `transform`/`viewport` της ζωγραφικής τα δίνει το primitive
 * ανά καρέ. Οι τύποι παράγονται από τα SSoT (`computeCircuitWirePaths` / `getWireWaypointHover`)
 * αντί να ξανα-δηλωθούν εδώ — μηδέν κάτοπτρο τύπων που μπορεί να ξεσυγχρονιστεί.
 */
interface WirePaintInputs {
  readonly scene: DxfScene | null;
  readonly systems: Parameters<typeof computeCircuitWirePaths>[0];
  readonly visible: boolean;
  readonly gripDragPreview: DxfGripDragPreview | null;
  readonly selectedSystemIds: ReadonlySet<string>;
  readonly waypointHover: ReturnType<typeof getWireWaypointHover>;
  readonly colorBySystem: boolean;
}

/**
 * ADR-726 Φ2 — «τι θα ζωγραφιστεί» ως **μία** απόφαση: ένας painter, ή `null` όταν δεν υπάρχει
 * ούτε μία διαδρομή καλωδίου. Η δρομολόγηση (`computeCircuitWirePaths`) τρέχει **πριν** αγγιχτεί
 * ο καμβάς, ώστε και η περίπτωση «συστήματα υπάρχουν αλλά καμία διαδρομή» να μην ακυρώνει layer.
 */
function buildHomeRunWirePainter(input: WirePaintInputs): OverlayDispatchPainter | null {
  const {
    scene, systems, visible, gripDragPreview, selectedSystemIds, waypointHover, colorBySystem,
  } = input;
  if (!visible || !scene || systems.length === 0) return null;

  const resolve = buildResolver(scene, gripDragPreview);
  const paths = computeCircuitWirePaths(systems, resolve);
  if (paths.length === 0) return null;

  return (ctx, t, vp) => {
    // Hovering the active circuit's wire lights up the whole run (mirror of the
    // 2D DXF entity hover): pass the hovered systemId so its path strokes a halo.
    drawCircuitWires(ctx, paths, t, vp, waypointHover?.systemId ?? null, colorBySystem);
    if (selectedSystemIds.size === 0) return;

    // ADR-408 Φ7 FU#3 + Revit multi-select — editable grips appear on EVERY selected wire
    // (window/crossing can select several circuits). Drawn on top of the wires so the user
    // can grab existing vertices or insert a new one. The hover/insert affordance is scoped
    // to the circuit actually hovered (its own systemId), so only that wire reacts.
    for (const sy of systems) {
      if (!selectedSystemIds.has(sy.id) || !isElectricalSystemParams(sy.params)) continue;
      const segments = computeCircuitHostSegments([sy], resolve);
      const path = paths.find((p) => p.systemId === sy.id);
      drawWaypointHandles(
        ctx,
        segments,
        sy.params.wireWaypoints,
        colorBySystem ? (path?.colorHex ?? '#1e88e5') : DEFAULT_WIRE_COLOR,
        waypointHover?.systemId === sy.id ? waypointHover : null,
        t,
        vp,
      );
    }
  };
}

/**
 * ADR-732 Batch 1 — «painter ή null» για τον κοινό καμβά της ζώνης Β.
 *
 * @param gripDragPreview ADR-408 Φ7 P2 — live grip drag snapshot (null when idle). When
 *   the dragged entity is a fixture/panel, its circuit wire follows the drag live: the
 *   resolver reads the previewed host transform instead of the committed one (the
 *   painter identity changes per drag frame → the shared canvas repaints, όπως πριν).
 */
export function useHomeRunWiresPainter(
  scene: DxfScene | null,
  gripDragPreview: DxfGripDragPreview | null,
): OverlayDispatchPainter | null {
  // Leaf subscriptions (ADR-040): live systems + V/G visibility slice.
  const systems = useMepSystemStore((s) => s.systems);
  const objectStyles = useDrawingScaleStore((s) => s.objectStyles);
  const disciplineVisibility = useDrawingScaleStore((s) => s.disciplineVisibility);
  // ADR-408 Φ7 — colour-by-system master toggle (leaf subscription). OFF ⇒ wires +
  // handles fall back to DEFAULT_WIRE_COLOR (2D/3D parity).
  const colorBySystem = useDrawingScaleStore((s) => s.colorBySystem);
  // ADR-408 Φ7 FU#3 + Revit window/crossing multi-select: the set of selected circuits
  // (every member shows editable grips; the primary owns the editing affordances) + the
  // cursor hover affordance (highlight node / insert ghost). Both are leaf subscriptions —
  // orchestrators stay untouched (CHECK 6C safe).
  const selectedSystemIds = useMepCircuitEditorStore((s) => s.selectedSystemIds);
  const waypointHover = useSyncExternalStore(subscribeWireWaypointHover, getWireWaypointHover);
  const visible = resolveIsEntityVisible(
    { category: 'mep-wire' },
    { objectStyles, disciplineVisibility },
  );

  // Reference-stable painter: η δρομολόγηση (`computeCircuitWirePaths`) τρέχει σε αλλαγή
  // περιεχομένου — ΟΧΙ ανά καρέ pan/zoom όπως στο πρώην per-frame build (ίδιο αποτέλεσμα,
  // φθηνότερο). Το transform το δίνει το primitive του κοινού καμβά σε κάθε καρέ.
  return useMemo(
    () => buildHomeRunWirePainter({
      scene, systems, visible, gripDragPreview, selectedSystemIds, waypointHover, colorBySystem,
    }),
    [scene, systems, visible, gripDragPreview, selectedSystemIds, waypointHover, colorBySystem],
  );
}
