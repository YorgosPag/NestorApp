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
 * 🎨 **Χρώματα Zillow, πάνω σε εικόνα** (Φ2στ-γ Γ3γ-1 · `tour-plan-overlay-palette.ts`): **κόκκινη** η τρέχουσα τελεία και ο
 *   κώνος της, **μπλε** (`chart-1`, ίδιο και στα δύο θέματα) οι άλλες, **κίτρινος** ο χώρος όπου είσαι (`TourPlanSpaces`). Ποτέ
 *   `primary`/`card`: στο σκοτεινό θέμα το `--primary` είναι ταυτόσημο με το `--card` (ADR-770) και η κάτοψη μένει λευκή.
 * 🗺️ **Με εικόνα κάτοψης** (Φ2στ-β): το κάδρο **είναι** η εικόνα (σε μέτρα όταν είναι βαθμονομημένη) και οι τελείες κάθονται
 *   στο pixel όπου τις έβαλε ο άνθρωπος· χωρίς εικόνα, το κάδρο χωρά τις τελείες (Φ1).
 * 🔍 **Μεγέθυνση** (Φ2στ-γ Γ2 · §4.14 σημείο 5): στενότερο `viewBox` (`tour-plan-zoom.ts`), ποτέ CSS `scale` — τα σύμβολα
 *   ορίζονται σε **px** και γίνονται μέτρα με το `planMetresPerPixel` της **μετρημένης** επιφάνειας ⇒ ίδιο μέγεθος
 *   σε κάθε ζουμ **και** σε κάθε επιφάνεια — κάρτα ή ανάπτυξη (Zillow · Google Maps). Η θέαση ζει στο `tour-plan-zoom-store.ts`, **κοινή** για κάρτα και ανάπτυξη.
 */

import { type KeyboardEvent, useSyncExternalStore } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { radToDeg } from '@/lib/geometry/angle';
import { horizontalFov, viewBearing } from '@/lib/spatial-tour/viewer/tour-viewer-bearing';
import type { TourViewerGraph, ViewerLevelEntry, ViewerStop } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { conePath, toPlanSvg, type PlacedStop, type PlanFrame } from '@/lib/spatial-tour/viewer/tour-viewer-plan';
import { planMetresPerPixel, planViewBox } from '@/lib/spatial-tour/viewer/tour-plan-zoom';
import type { ElementSize } from '@/hooks/media/useElementSize';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_VIEWER_KEYS } from './tour-viewer-labels';
import type { TourCameraStore } from './tour-camera-store';
import { PLAN_CONE_CLASS, PLAN_DOT_CLASS } from './tour-plan-overlay-palette';
import { TourPlanSpaces } from './TourPlanSpaces';
import { usePlanView, type TourPlanZoomStore } from './tour-plan-zoom-store';
import { usePlanZoomGestures, type PlanWheelMode } from './usePlanZoomGestures';
import { useStopNames } from './useStopNames';

/**
 * Μεγέθη συμβόλων σε **css px** — πολλαπλασιάζονται με τα μέτρα ανά pixel της επιφάνειας (`planMetresPerPixel`), άρα η
 * τελεία είναι ίδια στην κάρτα, στην ανάπτυξη και σε κάθε ζουμ. Βαθμονομημένα ώστε η κάρτα των 320 px να μοιάζει με πριν.
 */
const NODE_RADIUS_PX = 6;
/** Η τρέχουσα τελεία είναι **και** μεγαλύτερη — το «εδώ» δεν λέγεται μόνο με χρώμα (CHECK 3.41). */
const HERE_RADIUS_PX = 7.5;
const NODE_STROKE_PX = 1.5;
const LINK_STROKE_PX = 1.5;
const CONE_RADIUS_PX = 28;
const CONE_STROKE_PX = 1;
/**
 * 🔴 **Ποτέ το περίγραμμα εστίασης του browser σε σχήμα SVG**: το πάχος του μετριέται στις μονάδες του `viewBox`, δηλαδή
 * σε **μέτρα** — μετρήθηκε ζωντανά (2026-09-28) ως μαύρος δακτύλιος ~4 m πάνω στην κάτοψη, στην τελεία που μόλις πατήθηκε
 * (η «εδώ» δεν είχε `outline-none`). Η εστίαση φαίνεται με το χρώμα της γραμμής, που κλιμακώνεται σωστά (WCAG 2.4.7).
 */
const NODE_FOCUS_CLASS = 'cursor-pointer outline-none focus-visible:stroke-ring';

interface ConeProps {
  readonly camera: TourCameraStore;
  readonly at: ViewerStop;
  readonly scale: number;
}

function TourPlanCone({ camera, at, scale }: ConeProps) {
  const { view, aspect } = useSyncExternalStore(camera.subscribe, camera.get, camera.get);
  if (at.node.position === null) return null;
  const { x, y } = toPlanSvg(at.node.position);
  const bearing = radToDeg(viewBearing(at.stop.headingRad, view.yaw));
  return (
    <path d={conePath(horizontalFov(view.fov, aspect) / 2, CONE_RADIUS_PX * scale)} transform={`translate(${x} ${y}) rotate(${bearing})`}
      className={PLAN_CONE_CLASS} strokeWidth={CONE_STROKE_PX * scale} aria-hidden />
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
  /** Το κάδρο του ορόφου (`levelPlanFrame`) — το ίδιο πάνω στο οποίο υπολογίζει και η μπάρα μεγέθυνσης. */
  readonly frame: PlanFrame;
  readonly stops: readonly PlacedStop[];
  /** Το μετρημένο μέγεθος της επιφάνειας (css px) — από αυτό γίνονται μέτρα τα σύμβολα. `0 × 0` = όχι ακόμη. */
  readonly surface: ElementSize;
  readonly zoomStore: TourPlanZoomStore;
  /** `modifier` = στήλη (Ctrl/⌘ + τροχός) · `always` = ανάπτυξη (σκέτος τροχός). */
  readonly wheelMode: PlanWheelMode;
}

interface LinksProps {
  readonly graph: TourViewerGraph;
  readonly stops: readonly PlacedStop[];
  readonly scale: number;
}

function PlanLinks({ graph, stops, scale }: LinksProps) {
  const onLevel = new Map(stops.map((s) => [s.entry.node.id, s]));
  const lines = stops.flatMap((from) => (graph.adjacency.get(from.entry.node.id) ?? []).flatMap((toId) => {
    const to = onLevel.get(toId);
    return to !== undefined && toId > from.entry.node.id ? [{ from, to }] : [];
  }));
  return (
    <g className="stroke-muted-foreground" strokeWidth={LINK_STROKE_PX * scale} aria-hidden>
      {lines.map(({ from, to }) => {
        const a = toPlanSvg(from.point);
        const b = toPlanSvg(to.point);
        return <line key={`${from.entry.node.id}-${to.entry.node.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
    </g>
  );
}

interface DotsProps {
  readonly stops: readonly PlacedStop[];
  readonly currentNodeId: string | null;
  readonly onGo: (nodeId: string) => void;
  readonly nameOf: (nodeId: string) => string;
  readonly scale: number;
}

function PlanDots({ stops, currentNodeId, onGo, nameOf, scale }: DotsProps) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const activate = (e: KeyboardEvent, nodeId: string) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onGo(nodeId);
  };
  return stops.map(({ entry: s, point }) => {
    const { x, y } = toPlanSvg(point);
    const here = s.node.id === currentNodeId;
    return (
      <circle key={s.node.id} cx={x} cy={y} r={(here ? HERE_RADIUS_PX : NODE_RADIUS_PX) * scale} role="button" tabIndex={0}
        aria-label={t(here ? TOUR_VIEWER_KEYS.youAreHere : TOUR_VIEWER_KEYS.goTo, { name: nameOf(s.node.id) })}
        aria-current={here ? 'location' : undefined}
        onClick={() => onGo(s.node.id)} onKeyDown={(e) => activate(e, s.node.id)}
        className={cn(NODE_FOCUS_CLASS, here ? PLAN_DOT_CLASS.here : PLAN_DOT_CLASS.other)}
        strokeWidth={NODE_STROKE_PX * scale} />
    );
  });
}

export function TourPlanMap(props: TourPlanMapProps) {
  const { graph, level, currentNodeId, camera, onGo, planImageUrl, frame, stops, surface, zoomStore, wheelMode } = props;
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const nameOf = useStopNames(graph);
  const view = usePlanView(zoomStore, level.id);
  const gestures = usePlanZoomGestures({ store: zoomStore, levelId: level.id, frame, wheelMode });
  const box = planViewBox(frame, view);
  /** Μέτρα ανά css pixel — κάθε μέγεθος συμβόλου σε px γίνεται μέτρα κάτοψης με αυτό. */
  const scale = planMetresPerPixel(box, surface);
  const current = currentNodeId === null ? undefined : graph.stops.get(currentNodeId);
  const zoomed = view.zoom > 1;
  return (
    <svg ref={gestures} viewBox={`${box.minX} ${box.minY} ${box.width} ${box.height}`} role="group" aria-label={t(TOUR_VIEWER_KEYS.plan)}
      className={cn('h-full w-full select-none', zoomed ? 'cursor-grab touch-none data-[panning=true]:cursor-grabbing' : 'touch-pan-y')}>
      {planImageUrl !== null && level.plan !== null && (
        <image href={planImageUrl} x={frame.minX} y={frame.minY} width={frame.width} height={frame.height} preserveAspectRatio="none" aria-hidden />
      )}
      {planImageUrl !== null && (
        <TourPlanSpaces level={level} stops={stops} currentNodeId={currentNodeId} nameOf={nameOf} areas={graph.spaceAreas} scale={scale} />
      )}
      <PlanLinks graph={graph} stops={stops} scale={scale} />
      {current !== undefined && current.levelId === level.id && <TourPlanCone camera={camera} at={current} scale={scale} />}
      <PlanDots stops={stops} currentNodeId={currentNodeId} onGo={onGo} nameOf={nameOf} scale={scale} />
    </svg>
  );
}
