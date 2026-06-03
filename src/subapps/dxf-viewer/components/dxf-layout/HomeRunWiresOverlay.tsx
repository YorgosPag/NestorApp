'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-408 Φ7 — Home-run circuit wires 2D annotation micro-leaf.
 *
 * Dedicated always-on overlay canvas that strokes the **derived** wiring of every
 * electrical circuit of the current floor (panel → daisy-chained fixtures, with a
 * home-run arrow at the panel). Geometry is NOT persisted: it is recomputed each
 * paint from the live host transforms via the SSoT `computeCircuitWirePaths`, so
 * it follows moved/rotated panels and fixtures for free.
 *
 * ADR-040 micro-leaf: subscribes ONLY here (mep-system store + objectStyles
 * visibility slice). The shell `CanvasLayerStack` / `CanvasSection` gain NO new
 * `useSyncExternalStore` (CHECK 6C safe). Repaints on scene/transform/systems/
 * visibility change — anchored to world coords, so pan/zoom repaint.
 *
 * @see ../../bim/mep-systems/mep-wire-routing (computeCircuitWirePaths — routing SSoT)
 * @see ../../bim/renderers/MepWireRenderer (drawCircuitWires — draw)
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { DxfEntityUnion, DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import {
  computeCircuitWirePaths,
  computeCircuitHostSegments,
  type ResolveWireHost,
} from '../../bim/mep-systems/mep-wire-routing';
import { resolverFromHosts, type WireHostXform } from '../../bim/mep-systems/mep-wire-resolver';
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

export interface HomeRunWiresOverlayProps {
  readonly scene: DxfScene | null;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  /** Τρέχων BIM όροφος — μέρος του repaint key (αλλαγή ορόφου ⇒ νέο scene). */
  readonly currentLevelId: string | null;
  /**
   * ADR-408 Φ7 P2 — live grip drag snapshot (null when idle). When the dragged
   * entity is a fixture/panel, its circuit wire follows the drag live: the
   * resolver reads the previewed host transform instead of the committed one.
   */
  readonly gripDragPreview: DxfGripDragPreview | null;
}

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
  const hosts = new Map<string, WireHostXform>();
  for (const e of scene.entities) {
    if (e.type !== 'mep-fixture' && e.type !== 'electrical-panel') continue;
    let params = e.params;
    if (dragPreview && dragPreview.entityId === e.id) {
      const previewed = applyEntityPreview(e as unknown as DxfEntityUnion, toEntityPreviewTransform(dragPreview));
      // `applyEntityPreview` returns the same ref for a zero/identity drag → keep committed.
      if (previewed !== (e as unknown as DxfEntityUnion)) {
        params = (previewed as unknown as { params: typeof e.params }).params;
      }
    }
    hosts.set(e.id, {
      x: params.position.x,
      y: params.position.y,
      rotation: params.rotation,
      connectors: params.connectors ?? [],
    });
  }
  return resolverFromHosts(hosts);
}

export function HomeRunWiresOverlay({
  scene,
  transform,
  viewport,
  gripDragPreview,
}: HomeRunWiresOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscriptions (ADR-040): live systems + V/G visibility slice.
  const systems = useMepSystemStore((s) => s.systems);
  const objectStyles = useDrawingScaleStore((s) => s.objectStyles);
  const disciplineVisibility = useDrawingScaleStore((s) => s.disciplineVisibility);
  // ADR-408 Φ7 — colour-by-system master toggle (leaf subscription). OFF ⇒ wires +
  // handles fall back to DEFAULT_WIRE_COLOR (2D/3D parity).
  const colorBySystem = useDrawingScaleStore((s) => s.colorBySystem);
  // ADR-408 Φ7 FU#3 — editable waypoints: which circuit is active (shows handles)
  // + the cursor hover affordance (highlight node / insert ghost). Both are leaf
  // subscriptions — orchestrators stay untouched (CHECK 6C safe).
  const activeSystemId = useMepCircuitEditorStore((s) => s.activeSystemId);
  const waypointHover = useSyncExternalStore(subscribeWireWaypointHover, getWireWaypointHover);
  const visible = resolveIsEntityVisible(
    { category: 'mep-wire' },
    { objectStyles, disciplineVisibility },
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ADR-408 Φ7 perf guard: skip the (non-trivial) routing recompute + draw when
    // the overlay canvas has no usable size. Without this, an idle 0×0 viewport
    // (layout not yet settled / collapsed shell) makes every parent re-render run
    // `computeCircuitWirePaths` + `drawCircuitWires`, and `worldToScreen` floods the
    // console with "Invalid viewport dimensions" — burning CPU for zero pixels.
    if (viewport.width <= 0 || viewport.height <= 0) return;

    if (!visible || !scene || systems.length === 0) return;
    const resolve = buildResolver(scene, gripDragPreview);
    const paths = computeCircuitWirePaths(systems, resolve);
    if (paths.length === 0) return;
    // Hovering the active circuit's wire lights up the whole run (mirror of the
    // 2D DXF entity hover): pass the hovered systemId so its path strokes a halo.
    drawCircuitWires(ctx, paths, transform, viewport, waypointHover?.systemId ?? null, colorBySystem);

    // ADR-408 Φ7 FU#3 — editable handles for the active circuit only (Revit: grips
    // appear on the selected wire). Drawn on top of the wire so the user can grab
    // existing vertices or insert a new one on a segment.
    const active = activeSystemId ? systems.find((s) => s.id === activeSystemId) ?? null : null;
    if (active && isElectricalSystemParams(active.params)) {
      const segments = computeCircuitHostSegments([active], resolve);
      const path = paths.find((p) => p.systemId === active.id);
      drawWaypointHandles(
        ctx,
        segments,
        active.params.wireWaypoints,
        colorBySystem ? (path?.colorHex ?? '#1e88e5') : DEFAULT_WIRE_COLOR,
        waypointHover,
        transform,
        viewport,
      );
    }
    // ADR-408 Φ7 P2 — `gripDragPreview` in deps ⇒ repaint each drag frame so the
    // wire tracks the previewed host (the snapshot changes on every mousemove).
  }, [scene, transform, viewport, systems, visible, gripDragPreview, activeSystemId, waypointHover, colorBySystem]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="mep-wires"
      width={viewport.width}
      height={viewport.height}
      className="pointer-events-none absolute inset-0 z-[11]"
      aria-hidden="true"
    />
  );
}
