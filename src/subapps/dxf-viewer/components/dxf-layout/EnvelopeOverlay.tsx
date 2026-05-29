'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-396 Phase P4 — Envelope (ETICS) 2D overlay micro-leaf.
 *
 * Dedicated always-on overlay canvas που ζωγραφίζει το ενιαίο συνεχές εξωτερικό
 * περίγραμμα μόνωσης + insulation hatch band του τρέχοντος ορόφου. **Παράγωγο
 * floor-overlay** (ADR-396 §3 DISPLAY) — ΟΧΙ registered renderer στο
 * `EntityRendererComposite`.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ (envelope-spec-store + objectStyles
 * visibility slice). Ο shell `CanvasLayerStack` / `CanvasSection` ΔΕΝ αποκτούν νέο
 * `useSyncExternalStore` (CHECK 6C safe). Repaint σε αλλαγή scene/transform/spec/
 * visibility — anchored στο world bbox, άρα pan/zoom ξαναζωγραφίζουν.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3, §7 (P4)
 * @see ../../bim/geometry/envelope-perimeter (computeEnvelopePerimeter)
 * @see ../../bim/renderers/EnvelopeRenderer (plan + draw)
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { computeEnvelopePerimeter } from '../../bim/geometry/envelope-perimeter';
import { EnvelopeRenderer, buildEnvelopeRenderPlan } from '../../bim/renderers/EnvelopeRenderer';
import {
  getEnvelopeSpec,
  subscribeEnvelopeSpec,
} from '../../bim/stores/envelope-spec-store';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
import { resolveIsEntityVisible } from '../../bim/visibility/visibility-resolver';

export interface EnvelopeOverlayProps {
  readonly scene: DxfScene | null;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  /** Τρέχων BIM όροφος — κλειδί του per-level spec store. */
  readonly currentLevelId: string | null;
}

export function EnvelopeOverlay({
  scene,
  transform,
  viewport,
  currentLevelId,
}: EnvelopeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscriptions (ADR-040): per-level spec + V/G visibility slice.
  const spec = useSyncExternalStore(
    subscribeEnvelopeSpec,
    () => getEnvelopeSpec(currentLevelId),
    () => null,
  );
  const objectStyles = useDrawingScaleStore((s) => s.objectStyles);
  const visible = resolveIsEntityVisible({ category: 'envelope' }, { objectStyles });

  // ADR-396 P6: ΟΧΙ auto-seed. Το envelope εμφανίζεται ΜΟΝΟ όταν ο χρήστης
  // τρέξει το command «Εφαρμογή Θερμοπρόσοψης» (ThermalEnvelopeHost → setEnvelopeSpec).
  // Το `spec` είναι null μέχρι τότε → το render path κάνει early-return.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!visible || !spec || !scene) return;
    // DxfWall (direct entity, ADR-363 §1B) έχει kind+params → structurally satisfies
    // WallForEnvelope. Filter μέσω του type discriminator (το `isWallEntity` είναι
    // typed για το Entity union, όχι για το DxfEntityUnion του render scene).
    const walls = scene.entities.filter(
      (e): e is Extract<DxfEntityUnion, { type: 'wall' }> => e.type === 'wall',
    );
    if (walls.length === 0) return;

    const { chains } = computeEnvelopePerimeter(walls, spec.thickness_m, scene.units);
    if (chains.length === 0) return;

    const renderer = new EnvelopeRenderer(ctx);
    for (const chain of chains) {
      const plan = buildEnvelopeRenderPlan(chain, spec.materialId);
      if (plan) renderer.render(plan, transform, viewport);
    }
  }, [scene, transform, viewport, spec, visible]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="envelope"
      width={viewport.width}
      height={viewport.height}
      className="pointer-events-none absolute inset-0 z-[11]"
      aria-hidden="true"
    />
  );
}
