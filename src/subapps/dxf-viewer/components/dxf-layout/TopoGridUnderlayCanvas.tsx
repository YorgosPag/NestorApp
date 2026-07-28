/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-656 M11 — TopoGridUnderlayCanvas: the LIVE ΕΓΣΑ87 coordinate graticule (screen consumer).
 *
 * Clones the `GridUnderlayCanvas` shell (effect-based repaint, no RAF, DPR-aware backing store)
 * but draws the SURVEY coordinate grid, not the F7 drawing-aid grid: crosses at the ROUND ΕΓΣΑ87
 * values (from the ONE pure `topo-grid-model`) plus Easting/Northing numbering pinned to the frame
 * edges (top for Eastings, right for Northings — clear of the bottom/left rulers). Everything
 * reflows on pan/zoom because the effect re-runs on `transform`.
 *
 * ADR-040: this component takes `transform`/`viewport` as PROPS and does NOT subscribe to any
 * high-freq store — the parent micro-leaf owns the (low-freq) grid-visibility subscription.
 */

'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { CoordinateTransforms as CT } from '../../rendering/core/CoordinateTransforms';
// ADR-726 Φ2 — sizing + πύλη + clear ζουν στο ΕΝΑ primitive· εδώ δηλώνεται μόνο «painter ή null».
import {
  paintOverlayDispatchFrame,
  type OverlayDispatchPainter,
} from './overlay-dispatch/overlay-dispatch-frame';
import { buildTopoGrid, pickSurveyGridStepMm, type WorldRectMm } from '../../systems/topography/topo-grid-model';
import { formatGridCoordinate } from '../../systems/topography/topo-grid-entities';
import {
  getGeoReference, subscribeGeoReference,
} from '../../systems/geo-referencing/geo-reference-store';
import {
  getTopoDisplayProjector, projectWorldPoint, projectWorldPoints, unprojectRectToWorld,
} from '../../systems/topography/topo-display-frame';
import {
  TOPO_GRID_COLOR, TOPO_GRID_LABEL_COLOR, TOPO_GRID_CROSS_SCREEN_PX, TOPO_GRID_LABEL_FONT,
} from '../../systems/topography/topo-grid-config';
import type { ViewTransform } from '../../rendering/types/Types';

export interface TopoGridUnderlayCanvasProps {
  /** Live view transform (prop, not a store subscription — ADR-040). */
  transform: ViewTransform;
  viewport: { width: number; height: number };
  /** Whether the graticule is shown (owned by the micro-leaf's low-freq store subscription). */
  visible: boolean;
  className?: string;
}

/** Padding (px) from the frame edge to the coordinate numbering. */
const LABEL_EDGE_PAD = 4;

/**
 * The **DISPLAY** rectangle currently visible, derived from the two opposite screen corners.
 *
 * ⚠️ ADR-650 §M10f — αυτό ΔΕΝ είναι WORLD: το `screenToWorld` κάνει screen→**σκηνή**, και η σκηνή
 * είναι το display frame του κτιρίου. Σε γεωαναφερμένο έργο τα δύο απέχουν ~4·10⁸ mm. Το ότι
 * λεγόταν «world» ήταν ακριβώς η αιτία που ο κάναβος τύπωνε τοπικές συντεταγμένες με ετικέτα
 * ΕΓΣΑ: το `buildTopoGrid` ρωτιόταν σε λάθος σύστημα.
 */
function visibleDisplayRect(transform: ViewTransform, viewport: { width: number; height: number }): WorldRectMm {
  const a = CT.screenToWorld({ x: 0, y: 0 }, transform, viewport);
  const b = CT.screenToWorld({ x: viewport.width, y: viewport.height }, transform, viewport);
  return {
    minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y),
  };
}

/** Draw a small «+» at every round grid intersection (τα `crosses` έρχονται ήδη σε display frame). */
function drawCrosses(
  ctx: CanvasRenderingContext2D, crosses: readonly { x: number; y: number }[],
  transform: ViewTransform, viewport: { width: number; height: number },
): void {
  const a = TOPO_GRID_CROSS_SCREEN_PX;
  ctx.strokeStyle = TOPO_GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const c of crosses) {
    const s = CT.worldToScreen(c, transform, viewport);
    ctx.moveTo(s.x - a, s.y); ctx.lineTo(s.x + a, s.y);
    ctx.moveTo(s.x, s.y - a); ctx.lineTo(s.x, s.y + a);
  }
  ctx.stroke();
}

/**
 * Easting numbering along the top edge; Northing numbering along the right edge.
 *
 * Το άγκιστρο κάθε ετικέτας είναι το σημείο της γραμμής ΕΓΣΑ στο **κέντρο** του ορατού world
 * ορθογωνίου, προβαλλόμενο. Χωρίς στροφή αυτό είναι ακριβές (η γραμμή είναι κατακόρυφη στην
 * οθόνη, άρα ένα x αρκεί)· με στροφή η γραμμή είναι λοξή και η ετικέτα δείχνει το σημείο της
 * στο μέσο της οθόνης — η ΤΙΜΗ μένει σωστή σε κάθε περίπτωση, που είναι το ζητούμενο.
 */
function drawEdgeLabels(
  ctx: CanvasRenderingContext2D, world: WorldRectMm, grid: { eastings: readonly number[]; northings: readonly number[] },
  projector: ReturnType<typeof getTopoDisplayProjector>,
  transform: ViewTransform, viewport: { width: number; height: number },
): void {
  const midY = (world.minY + world.maxY) / 2;
  const midX = (world.minX + world.maxX) / 2;
  ctx.fillStyle = TOPO_GRID_LABEL_COLOR;
  ctx.font = TOPO_GRID_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const e of grid.eastings) {
    const s = CT.worldToScreen(projectWorldPoint({ x: e, y: midY }, projector), transform, viewport);
    ctx.fillText(formatGridCoordinate(e), s.x, LABEL_EDGE_PAD);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const n of grid.northings) {
    const s = CT.worldToScreen(projectWorldPoint({ x: midX, y: n }, projector), transform, viewport);
    ctx.fillText(formatGridCoordinate(n), viewport.width - LABEL_EDGE_PAD, s.y);
  }
}

export function TopoGridUnderlayCanvas({
  transform, viewport, visible, className,
}: TopoGridUnderlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ADR-040: LOW-frequency store (η γεωαναφορά αλλάζει με ενέργεια χρήστη, όχι ανά frame) — δεν
  // παραβιάζει τον κανόνα των micro-leaves· χωρίς αυτό ο κάναβος θα έμενε στο παλιό σύστημα μέχρι
  // το επόμενο pan.
  const geoRef = useSyncExternalStore(subscribeGeoReference, getGeoReference, getGeoReference);

  // Repaint only when the transform / viewport / visibility change (no continuous RAF).
  //
  // DPR-aware backing store via the SAME primitive as the sibling canvases (ADR-040) — το κάνει
  // πλέον το ΕΝΑ `paintOverlayDispatchFrame`, πριν την πύλη, σε κάθε κλήση.
  //
  // ADR-726 Φ2 — με τον graticule κρυμμένο (η συνήθης κατάσταση εκτός τοπογραφίας) ο καμβάς δεν
  // αγγίζεται καθόλου, αντί για ένα clearRect ανά καρέ που ακύρωνε ολόκληρο compositor layer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const active = visible && viewport.width > 0 && viewport.height > 0;
    const painter: OverlayDispatchPainter | null = active
      ? (ctx, t, vp) => {
          // ADR-650 §M10f — τρία συστήματα, με τη σειρά: οθόνη → display (screenToWorld) → WORLD
          // ΕΓΣΑ (unproject) όπου ΜΟΝΟ εκεί έχει νόημα η ερώτηση «ποιες στρογγυλές γραμμές ΕΓΣΑ
          // πέφτουν μέσα;» → πίσω σε display (project) για να σχεδιαστούν. Το βήμα (`scale`) είναι
          // αναλλοίωτο: ο rigid μετασχηματισμός δεν έχει κλίμακα.
          const projector = getTopoDisplayProjector();
          const world = unprojectRectToWorld(visibleDisplayRect(t, vp), projector);
          const stepMm = pickSurveyGridStepMm(t.scale);
          const grid = buildTopoGrid(world, stepMm);
          drawCrosses(ctx, projectWorldPoints(grid.crosses, projector), t, vp);
          drawEdgeLabels(ctx, world, grid, projector, t, vp);
        }
      : null;

    paintOverlayDispatchFrame(canvas, [painter], transform, viewport);
    // `geoRef` δεν διαβάζεται εδώ αλλά μέσα στον projector — μένει dependency ώστε η αλλαγή
    // γεωαναφοράς να ξαναζωγραφίζει (ADR-656 M11).
  }, [transform, viewport, visible, geoRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
