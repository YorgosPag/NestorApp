/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 BEFORE EDITING
 *
 * ADR-490 — structural warning highlight (halo + badge ⚠), ως analytical painter
 * (ADR-552 dispatch). Πηγή λογικής: ο πρώην `StructuralWarningOverlay.tsx` (verbatim paint).
 *
 * Επισημαίνει κάθε φέρον μέλος με στατικό σφάλμα/προειδοποίηση (π.χ. δοκάρι στον αέρα =
 * μηχανισμός): κόκκινο/amber halo + badge ⚠ στα σοβαρά. Derived (organism ADR-459 + FEM
 * ADR-481). **Always-on** (όχι toggle), self-gated μόνο σε `mode==='2d'`. Τελευταίο στη
 * σειρά dispatch = topmost.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-490-structural-warning-overlay.md
 */

import { useMemo, useSyncExternalStore } from 'react';
import { useViewMode3DStore } from '../../../bim-3d/stores/ViewMode3DStore';
import { useCurrentLevelScene } from '../../../systems/levels';
import { StructuralDiagnosticsStore } from '../../../bim/structural/organism/structural-diagnostics-store';
import { AnalysisDiagnosticsStore } from '../../../bim/structural/analytical/analysis-diagnostics-store';
import {
  collectEntityHighlights,
  type HighlightSeverity,
} from '../../../bim/structural/organism/diagnostic-highlight';
import {
  severityStyle,
  BADGE_FILL,
  BADGE_GLYPH,
} from '../../../bim/structural/diagnostic-severity-style';
import {
  resolveMemberFootprintVertices,
  polygonCentroid,
} from '../../../bim/structural/member-footprint-2d';
import { CoordinateTransforms } from '../../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Viewport, Point2D } from '../../../rendering/types/Types';
import type { AnalyticalPainter } from './analytical-painter';

/** Ένα επισημασμένο μέλος έτοιμο για render: footprint (world) + severity + κέντρο. */
interface WarningMark {
  readonly vertices: ReadonlyArray<Point2D>;
  readonly centroid: Point2D;
  readonly severity: HighlightSeverity;
}

/** Πάχος halo (screen px) + γεωμετρία badge — annotation (σταθερά px σε zoom). */
const HALO_WIDTH_PX = 3;
const BADGE_RADIUS_PX = 11;

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

/** Structural-warning analytical painter (`null` όταν ανενεργό/κενό). */
export function useStructuralWarningPainter(): AnalyticalPainter | null {
  // Leaf subscriptions (ADR-040): render mode + τα δύο low-freq diagnostics stores.
  const mode = useViewMode3DStore((s) => s.mode);
  const organismDiag = useSyncExternalStore(
    StructuralDiagnosticsStore.subscribe, StructuralDiagnosticsStore.getAll, StructuralDiagnosticsStore.getAll,
  );
  const analysisDiag = useSyncExternalStore(
    AnalysisDiagnosticsStore.subscribe, AnalysisDiagnosticsStore.getAll, AnalysisDiagnosticsStore.getAll,
  );
  const active = mode === '2d';

  // Active-floor scene — SSoT hook (ADR-557) ώστε μια αντικατάσταση σκηνής να
  // εντοπίζεται. Τα entities φέρουν το footprint geometry.
  const liveScene = useCurrentLevelScene();
  const scene = active ? liveScene : null;

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

  return useMemo<AnalyticalPainter | null>(() => {
    if (!active || marks.length === 0) return null;
    return (ctx, transform, viewport) => {
      ctx.save();
      ctx.setLineDash([]);
      // Πρώτα όλα τα halos, μετά τα badges (badges πάνω από τα περιγράμματα).
      for (const m of marks) strokeHalo(ctx, m.vertices, severityStyle(m.severity).halo, transform, viewport);
      for (const m of marks) {
        if (!severityStyle(m.severity).badge) continue;
        drawWarningBadge(ctx, CoordinateTransforms.worldToScreen(m.centroid, transform, viewport));
      }
      ctx.restore();
    };
  }, [active, marks]);
}
