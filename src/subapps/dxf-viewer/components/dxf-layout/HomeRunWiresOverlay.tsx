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

import { useEffect, useRef } from 'react';
import type { DxfEntityUnion, DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import {
  computeCircuitWirePaths,
  type ResolveWireHost,
  type WireHostPoint,
} from '../../bim/mep-systems/mep-wire-routing';
import { connectorWorldPosition, type MepConnector } from '../../bim/types/mep-connector-types';
import { drawCircuitWires } from '../../bim/renderers/MepWireRenderer';
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

interface WireHostXform {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly connectors: readonly MepConnector[];
}

/**
 * Build the host-resolver from the render scene's connector hosts (fixtures +
 * panels). Returns the connector's world plan point; `zMm` is irrelevant in 2D.
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
  return (entityId, connectorId): WireHostPoint | null => {
    const host = hosts.get(entityId);
    if (!host) return null;
    const conn = host.connectors.find((c) => c.connectorId === connectorId) ?? host.connectors[0];
    const pos = conn
      ? connectorWorldPosition(conn, { x: host.x, y: host.y, z: 0 }, host.rotation)
      : { x: host.x, y: host.y, z: 0 };
    return { x: pos.x, y: pos.y, zMm: 0 };
  };
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

    if (!visible || !scene || systems.length === 0) return;
    const paths = computeCircuitWirePaths(systems, buildResolver(scene, gripDragPreview));
    if (paths.length === 0) return;
    drawCircuitWires(ctx, paths, transform, viewport);
    // ADR-408 Φ7 P2 — `gripDragPreview` in deps ⇒ repaint each drag frame so the
    // wire tracks the previewed host (the snapshot changes on every mousemove).
  }, [scene, transform, viewport, systems, visible, gripDragPreview]);

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
