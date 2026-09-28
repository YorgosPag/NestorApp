'use client';

/**
 * @fileoverview **ΤΟ MINI-MAP** — κάτοψη βόρεια-πάνω, κόμβοι, σύνδεσμοι, «είστε εδώ» + κώνος θέασης (ADR-884 Φ1 · §4.8 ·
 * Φ2στ-β · §4.13).
 * @related `lib/spatial-tour/viewer/tour-viewer-plan.ts` (όλη η γεωμετρία) · `tour-camera-store.ts` ·
 *   `tour-panorama-source.ts` (`planImageUrl` — μόνο η πηγή ξέρει τη ρίζα των μέσων)
 * @module components/spatial-tour/viewer/TourPlanMap
 *
 * 🔑 **Ο κώνος είναι φύλλο** (`TourPlanCone`): ο **μόνος** React συνδρομητής της θέασης — ζωγραφίζει ένα `<path>` ανά καρέ·
 *   η κάτοψη, οι κόμβοι και οι σύνδεσμοι **δεν** ξαναζωγραφίζονται όταν ο επισκέπτης κοιτάζει γύρω (πνεύμα ADR-040).
 * 🔑 Κάθε κόμβος είναι **κουμπί** (`role="button"`, Tab, Enter/Space) — ίδιος δρόμος με τα κουμπιά του πανοράματος.
 * 🎨 Το «είστε εδώ» είναι `chart-1` (ADR-710 θέση 1 = το μπλε της μάρκας, **ίδιο και στα δύο θέματα**) — ΟΧΙ `primary`:
 *   στο σκοτεινό θέμα το `--primary` είναι ταυτόσημο με το `--card` (ADR-770), δηλαδή ο κώνος θα ήταν αόρατος.
 * 🗺️ **Με εικόνα κάτοψης** (Φ2στ-β): το κάδρο **είναι** η εικόνα (σε μέτρα όταν είναι βαθμονομημένη) και οι τελείες κάθονται
 *   στο pixel όπου τις έβαλε ο άνθρωπος· χωρίς εικόνα, το κάδρο χωρά τις τελείες (Φ1).
 */

import { type KeyboardEvent, useSyncExternalStore } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { radToDeg } from '@/lib/geometry/angle';
import { horizontalFov, viewBearing } from '@/lib/spatial-tour/viewer/tour-viewer-bearing';
import type { TourViewerGraph, ViewerLevelEntry, ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { PLAN_CONE_RADIUS_M, conePath, imagePlanFrame, planFrame, toPlanSvg, type PlanFrame } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import type { TourPoint } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import type { TourCameraStore } from './tour-camera-store';
import { useStopNames } from './useStopNames';

/** Μεγέθη σε μέτρα κάτοψης — το SVG κλιμακώνεται, οι αναλογίες μένουν. */
const NODE_RADIUS_M = 0.28;

function TourPlanCone({ camera, at }: { readonly camera: TourCameraStore; readonly at: ViewerStop }) {
  const { view, aspect } = useSyncExternalStore(camera.subscribe, camera.get, camera.get);
  if (at.node.position === null) return null;
  const { x, y } = toPlanSvg(at.node.position);
  const bearing = radToDeg(viewBearing(at.stop.headingRad, view.yaw));
  return (
    <path d={conePath(horizontalFov(view.fov, aspect) / 2, PLAN_CONE_RADIUS_M)} transform={`translate(${x} ${y}) rotate(${bearing})`}
      className="fill-chart-1/30 stroke-chart-1" strokeWidth={0.04} aria-hidden />
  );
}

export interface TourPlanMapProps {
  readonly graph: TourViewerGraph;
  readonly level: ViewerLevelEntry;
  readonly currentNodeId: string | null;
  readonly camera: TourCameraStore;
  readonly onGo: (nodeId: string) => void;
  /** Η εικόνα της κάτοψης του ορόφου (από την πηγή) — `null` ⇒ μόνο τελείες. */
  readonly planImageUrl: string | null;
}

interface PlacedStop {
  readonly entry: ViewerStop;
  readonly point: TourPoint;
}

function positioned(graph: TourViewerGraph, level: ViewerLevelEntry): PlacedStop[] {
  return level.nodeIds.flatMap((id) => {
    const entry = graph.stops.get(id);
    const point = entry?.node.position ?? null;
    return entry !== undefined && point !== null ? [{ entry, point }] : [];
  });
}

function PlanLinks({ graph, stops }: { readonly graph: TourViewerGraph; readonly stops: readonly PlacedStop[] }) {
  const onLevel = new Map(stops.map((s) => [s.entry.node.id, s]));
  const lines = stops.flatMap((from) => (graph.adjacency.get(from.entry.node.id) ?? []).flatMap((toId) => {
    const to = onLevel.get(toId);
    return to !== undefined && toId > from.entry.node.id ? [{ from, to }] : [];
  }));
  return (
    <g className="stroke-muted-foreground" strokeWidth={0.06} aria-hidden>
      {lines.map(({ from, to }) => {
        const a = toPlanSvg(from.point);
        const b = toPlanSvg(to.point);
        return <line key={`${from.entry.node.id}-${to.entry.node.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
    </g>
  );
}

/** Το κάδρο: η εικόνα της κάτοψης όταν υπάρχει, αλλιώς όσο χρειάζεται για τις τελείες. */
function frameOf(level: ViewerLevelEntry, stops: readonly PlacedStop[], planImageUrl: string | null): PlanFrame | null {
  if (level.plan !== null && planImageUrl !== null) return imagePlanFrame(level.plan.image, level.plan.metresPerPixel);
  return planFrame(stops.map((s) => s.point));
}

export function TourPlanMap({ graph, level, currentNodeId, camera, onGo, planImageUrl }: TourPlanMapProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const nameOf = useStopNames(graph);
  const stops = positioned(graph, level);
  const frame = frameOf(level, stops, planImageUrl);
  if (frame === null) return null;
  const current = currentNodeId === null ? undefined : graph.stops.get(currentNodeId);
  const activate = (e: KeyboardEvent, nodeId: string) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onGo(nodeId);
  };
  return (
    <svg viewBox={`${frame.minX} ${frame.minY} ${frame.width} ${frame.height}`} role="group" aria-label={t(TOUR_VIEWER_KEYS.plan)}
      className="h-full w-full">
      {planImageUrl !== null && level.plan !== null && (
        <image href={planImageUrl} x={0} y={0} width={frame.width} height={frame.height} preserveAspectRatio="none" aria-hidden />
      )}
      <PlanLinks graph={graph} stops={stops} />
      {current !== undefined && current.levelId === level.id && <TourPlanCone camera={camera} at={current} />}
      {stops.map(({ entry: s, point }) => {
        const { x, y } = toPlanSvg(point);
        const here = s.node.id === currentNodeId;
        return (
          <circle key={s.node.id} cx={x} cy={y} r={NODE_RADIUS_M} role="button" tabIndex={0}
            aria-label={t(here ? TOUR_VIEWER_KEYS.youAreHere : TOUR_VIEWER_KEYS.goTo, { name: nameOf(s.node.id) })}
            aria-current={here ? 'location' : undefined}
            onClick={() => onGo(s.node.id)} onKeyDown={(e) => activate(e, s.node.id)}
            className={here ? 'cursor-pointer fill-chart-1 stroke-background' : 'cursor-pointer fill-card stroke-foreground focus-visible:outline-none focus-visible:stroke-ring'}
            strokeWidth={0.06} />
        );
      })}
    </svg>
  );
}
