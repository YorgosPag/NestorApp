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

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { DxfEntityUnion, DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../rendering/core/immediate-transform-frame';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
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

export function HomeRunWiresOverlay({
  scene,
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

  // ADR-040 zero-lag (2026-06-10): the wires used to repaint on the React `transform`
  // prop, which lags the canvas during pan (the canvas pans via the 60 fps IMMEDIATE
  // transform, not React state) — the whole wire visibly trailed the cursor. The draw
  // now reads `getImmediateTransform()` inside a LOW-priority `UnifiedFrameScheduler`
  // frame (same zero-lag mechanism as the DXF canvas + clash overlay). All volatile
  // draw inputs are funnelled through a ref so the scheduler callback reads the latest.
  const drawStateRef = useRef({
    scene, viewport, systems, visible, gripDragPreview, selectedSystemIds, waypointHover, colorBySystem,
  });
  drawStateRef.current = {
    scene, viewport, systems, visible, gripDragPreview, selectedSystemIds, waypointHover, colorBySystem,
  };

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const {
      scene: s, viewport: vp, systems: sys, visible: vis,
      gripDragPreview: drag, selectedSystemIds: selectedIds, waypointHover: hover, colorBySystem: colorOn,
    } = drawStateRef.current;

    // 🏢 SSoT sizing (ADR-040) — DPR-aware backing store via the shared primitive (before:
    // `width={viewport.width}` JSX attribute, NO dpr → blurry + inconsistent buffer with siblings).
    // ctx is DPR-scaled → the MepWireRenderer draws stay in CSS/world coords unchanged.
    const ctx = CanvasUtils.sizeCanvasToViewport(canvas, vp);
    if (!ctx) return;
    ctx.clearRect(0, 0, vp.width, vp.height);

    // ADR-408 Φ7 perf guard: skip the (non-trivial) routing recompute + draw when the
    // overlay canvas has no usable size (idle 0×0 viewport / collapsed shell).
    if (vp.width <= 0 || vp.height <= 0) return;
    if (!vis || !s || sys.length === 0) return;

    // Zero-lag: project through the IMMEDIATE transform, read at draw time (not the prop).
    const t = getImmediateTransform();
    const resolve = buildResolver(s, drag);
    const paths = computeCircuitWirePaths(sys, resolve);
    if (paths.length === 0) return;
    // Hovering the active circuit's wire lights up the whole run (mirror of the
    // 2D DXF entity hover): pass the hovered systemId so its path strokes a halo.
    drawCircuitWires(ctx, paths, t, vp, hover?.systemId ?? null, colorOn);

    // ADR-408 Φ7 FU#3 + Revit multi-select — editable grips appear on EVERY selected wire
    // (window/crossing can select several circuits). Drawn on top of the wires so the user
    // can grab existing vertices or insert a new one. The hover/insert affordance is scoped
    // to the circuit actually hovered (its own systemId), so only that wire reacts.
    if (selectedIds.size > 0) {
      for (const sy of sys) {
        if (!selectedIds.has(sy.id) || !isElectricalSystemParams(sy.params)) continue;
        const segments = computeCircuitHostSegments([sy], resolve);
        const path = paths.find((p) => p.systemId === sy.id);
        drawWaypointHandles(
          ctx,
          segments,
          sy.params.wireWaypoints,
          colorOn ? (path?.colorHex ?? '#1e88e5') : DEFAULT_WIRE_COLOR,
          hover?.systemId === sy.id ? hover : null,
          t,
          vp,
        );
      }
    }
  }, []);

  // Repaint on content change (systems / scene / viewport / visibility / hover / live
  // host drag — `gripDragPreview` changes each drag frame so the wire tracks the host).
  useEffect(() => {
    repaint();
  }, [scene, viewport, systems, visible, gripDragPreview, selectedSystemIds, waypointHover, colorBySystem, repaint]);

  // Zero-lag pan/zoom: reproject in the LOW-priority scheduler frame (after the DXF
  // canvas), gated on the immediate transform changing — frame-synced, no React churn.
  // SSoT: the same helper the clash + proposal-ghost overlays use.
  useEffect(() => {
    return subscribeImmediateTransformFrame('home-run-wires', 'Home-Run Wires', repaint);
  }, [repaint]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="mep-wires"
      className="pointer-events-none absolute inset-0 w-full h-full z-[11]"
      aria-hidden="true"
    />
  );
}
