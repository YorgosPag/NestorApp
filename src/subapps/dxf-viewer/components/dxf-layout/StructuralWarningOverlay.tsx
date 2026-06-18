'use client';

/**
 * ⚠  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-490 — Structural warning overlay (Revit/Robot «unstable member» highlight).
 *
 * Read-only overlay canvas που επισημαίνει στην κάτοψη κάθε φέρον μέλος με στατικό
 * **σφάλμα/προειδοποίηση** (π.χ. δοκάρι στον αέρα = μηχανισμός): κόκκινο/amber halo
 * γύρω από το footprint + badge ⚠ στα σοβαρά error. Τα δεδομένα είναι **derived** από
 * τα ΥΠΑΡΧΟΝΤΑ diagnostics (organism ADR-459 + FEM ADR-481) — μηδέν νέα λογική.
 *
 * **Always-on (όχι toggle):** τα στατικά σφάλματα δεν κρύβονται πίσω από διακόπτη
 * (Robot/SAP: unstable members always red). Self-gated μόνο σε `mode==='2d'`.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ — `ViewMode3DStore` (mode) + τα δύο low-freq
 * diagnostics stores (γράφονται μόνο σε structural αλλαγή/ανάλυση) + active-floor scene.
 * Ο shell `CanvasLayerStack` δεν αποκτά νέο subscription (CHECK 6C safe). Ξεχωριστό
 * canvas + `pointer-events-none` → καμία επίδραση σε selection/hit-test/cache. Η αιτία +
 * οι ενέργειες ζουν ήδη στο property panel (`EntityWarningsSection`) με επιλογή του μέλους.
 *
 * @see ../../bim/structural/organism/diagnostic-highlight.ts — collectEntityHighlights (SSoT)
 * @see ../../bim/structural/diagnostic-severity-style.ts — severity → χρώμα (SSoT)
 * @see ../../bim/structural/member-footprint-2d.ts — footprint polygon (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-490-structural-warning-overlay.md
 */

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { StructuralDiagnosticsStore } from '../../bim/structural/organism/structural-diagnostics-store';
import { AnalysisDiagnosticsStore } from '../../bim/structural/analytical/analysis-diagnostics-store';
import {
  collectEntityHighlights,
  type HighlightSeverity,
} from '../../bim/structural/organism/diagnostic-highlight';
import {
  severityStyle,
  BADGE_FILL,
  BADGE_GLYPH,
} from '../../bim/structural/diagnostic-severity-style';
import {
  resolveMemberFootprintVertices,
  polygonCentroid,
} from '../../bim/structural/member-footprint-2d';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';

/** Ένα επισημασμένο μέλος έτοιμο για render: footprint (world) + severity + κέντρο. */
interface WarningMark {
  readonly vertices: ReadonlyArray<Point2D>;
  readonly centroid: Point2D;
  readonly severity: HighlightSeverity;
}

/** Πάχος halo (screen px) + γεωμετρία badge — annotation (σταθερά px σε zoom). */
const HALO_WIDTH_PX = 3;
const BADGE_RADIUS_PX = 11;

export interface StructuralWarningOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

/** Περίγραμμα (halo) του footprint σε screen px. */
function strokeHalo(
  ctx: CanvasRenderingContext2D,
  vertices: ReadonlyArray<Point2D>,
  color: string,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  if (vertices.length < 3) return;
  ctx.beginPath();
  const first = CoordinateTransforms.worldToScreen(vertices[0]!, transform, viewport);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < vertices.length; i++) {
    const s = CoordinateTransforms.worldToScreen(vertices[i]!, transform, viewport);
    ctx.lineTo(s.x, s.y);
  }
  ctx.closePath();
  ctx.lineWidth = HALO_WIDTH_PX;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Badge ⚠ (κόκκινο τρίγωνο + λευκό θαυμαστικό) στο κέντρο — vector, μηδέν text/i18n. */
function drawWarningBadge(ctx: CanvasRenderingContext2D, center: Point2D): void {
  const r = BADGE_RADIUS_PX;
  const { x, y } = center;
  // Ισόπλευρο τρίγωνο (κορυφή πάνω).
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.92, y + r * 0.72);
  ctx.lineTo(x - r * 0.92, y + r * 0.72);
  ctx.closePath();
  ctx.fillStyle = BADGE_FILL;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = BADGE_GLYPH;
  ctx.stroke();
  // Θαυμαστικό (στέλεχος + κουκκίδα).
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.35);
  ctx.lineTo(x, y + r * 0.2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = BADGE_GLYPH;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y + r * 0.45, 1.4, 0, Math.PI * 2);
  ctx.fillStyle = BADGE_GLYPH;
  ctx.fill();
}

export function StructuralWarningOverlay({ transform, viewport }: StructuralWarningOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Leaf subscriptions (ADR-040): render mode + τα δύο low-freq diagnostics stores.
  const mode = useViewMode3DStore((s) => s.mode);
  const organismDiag = useSyncExternalStore(
    StructuralDiagnosticsStore.subscribe, StructuralDiagnosticsStore.getAll, StructuralDiagnosticsStore.getAll,
  );
  const analysisDiag = useSyncExternalStore(
    AnalysisDiagnosticsStore.subscribe, AnalysisDiagnosticsStore.getAll, AnalysisDiagnosticsStore.getAll,
  );
  const active = mode === '2d';

  // Active-floor scene — read DIRECTLY (mirror utilization/HeatLoad) ώστε μια αντικατάσταση
  // σκηνής να εντοπίζεται. Τα entities φέρουν το footprint geometry.
  const levelsCtx = useLevelsOptional();
  const currentLevelId = levelsCtx?.currentLevelId ?? null;
  const getLevelScene = levelsCtx?.getLevelScene;
  const scene = active && currentLevelId && getLevelScene ? getLevelScene(currentLevelId) : null;

  const marks = useMemo<readonly WarningMark[]>(() => {
    if (!active || !scene) return [];
    const highlights = collectEntityHighlights(organismDiag, analysisDiag);
    if (highlights.size === 0) return [];
    const out: WarningMark[] = [];
    for (const e of scene.entities) {
      const hl = highlights.get(e.id);
      if (!hl) continue;
      const vertices = resolveMemberFootprintVertices(e);
      if (!vertices) continue;
      out.push({ vertices, centroid: polygonCentroid(vertices), severity: hl.severity });
    }
    return out;
  }, [active, scene, organismDiag, analysisDiag]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = getDevicePixelRatio();
    const w = Math.max(1, Math.round(viewport.width * dpr));
    const h = Math.max(1, Math.round(viewport.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (!active || marks.length === 0) return;

    ctx.save();
    ctx.setLineDash([]);
    // Πρώτα όλα τα halos, μετά τα badges (badges πάνω από τα περιγράμματα).
    for (const m of marks) strokeHalo(ctx, m.vertices, severityStyle(m.severity).halo, transform, viewport);
    for (const m of marks) {
      if (!severityStyle(m.severity).badge) continue;
      drawWarningBadge(ctx, CoordinateTransforms.worldToScreen(m.centroid, transform, viewport));
    }
    ctx.restore();
  }, [active, marks, transform, viewport]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="structural-warnings"
      className="pointer-events-none absolute inset-0 h-full w-full z-10"
      aria-hidden="true"
    />
  );
}
