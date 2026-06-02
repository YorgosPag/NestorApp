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
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
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

export interface HomeRunWiresOverlayProps {
  readonly scene: DxfScene | null;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  /** Τρέχων BIM όροφος — μέρος του repaint key (αλλαγή ορόφου ⇒ νέο scene). */
  readonly currentLevelId: string | null;
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
 */
function buildResolver(scene: DxfScene): ResolveWireHost {
  const hosts = new Map<string, WireHostXform>();
  for (const e of scene.entities) {
    if (e.type !== 'mep-fixture' && e.type !== 'electrical-panel') continue;
    hosts.set(e.id, {
      x: e.params.position.x,
      y: e.params.position.y,
      rotation: e.params.rotation,
      connectors: e.params.connectors ?? [],
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
    const paths = computeCircuitWirePaths(systems, buildResolver(scene));
    if (paths.length === 0) return;
    drawCircuitWires(ctx, paths, transform, viewport);
  }, [scene, transform, viewport, systems, visible]);

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
