'use client';

/**
 * @fileoverview **ΤΟ ΣΤΡΩΜΑ ΕΠΙΘΕΩΡΗΣΗΣ ΤΗΣ ΚΑΤΟΨΗΣ** — σταυρόνημα, βέλος κατηφόρας, η πλησιέστερη ισοϋψής φωτισμένη σε ΟΛΟ
 *   της το μήκος, η γραμμή προφίλ, η διαδρομή της σταγόνας (ADR-920 §14.10 Ε1 · Ε3).
 * @related ./TerrainMapSvg (ο γονέας — ΔΕΝ ξαναποδίδεται από hover) · ./TerrainInspectContext (τα φύλλα ρωτούν μόνο ό,τι τα αφορά) ·
 *   ./terrain-map-palette (`TERRAIN_INSPECT_CLASS`)
 * @module components/listing-detail/terrain/TerrainInspectLayer
 *
 * 🔑 **Πέρα από τους μεγάλους**: CalTopo / Mapbox / ArcGIS / Civil 3D δείχνουν τον αριθμό κάτω από τον δείκτη. Εδώ ανάβει και
 *   ΟΛΟΚΛΗΡΗ η ισοϋψής του σημείου, από τα `contours` του snapshot (όχι από τα σχεδιασμένα paths, που είναι συγχωνευμένα και,
 *   στο `minorShown: 'none'`, δεν έχουν ενδιάμεσες): ο αναγνώστης βλέπει «ως πού πάει αυτό το υψόμετρο» με μια ματιά.
 * 🔑 **Πέντε φύλλα, πέντε επιλογείς**: κάθε κομμάτι ξαναποδίδεται μόνο όταν αλλάξει η δική του απάντηση. `pointer-events: none`
 *   ώστε τα συμβάντα να φτάνουν πάντα στο SVG.
 * 📐 Μεγέθη σε μέτρα, αναλογικά του ύψους κειμένου (`labelHeightM`) — όπως κάθε σύμβολο του χάρτη· γραμμές σε css px.
 */

import { useMemo } from 'react';

import { flatSvgPoints, polylinePathData, svgPointOf } from '@/lib/terrain/publication/terrain-map-svg';

import { useTerrainInspect, useTerrainInspectStore } from './TerrainInspectContext';
import {
  TERRAIN_INSPECT_CLASS as INK, TERRAIN_INSPECT_STROKE_PX as PX, TERRAIN_LABEL_HALO_RATIO as HALO,
} from './terrain-map-palette';
import { NON_SCALING } from './terrain-map-symbols';
import { activeReading, type TerrainInspectState } from './terrain-inspect-store';

/** Τα κείμενα του στρώματος — ήδη μεταφρασμένα από τον καλούντα. */
export interface TerrainInspectLayerWords {
  /** «Ισοϋψής 99,5 m». */
  readonly contourLabelOf: (levelM: number) => string;
  readonly profileStart: string;
  readonly profileEnd: string;
}

const CROSS_RATIO = 1.2;
const RING_RATIO = 0.35;
const ARROW_RATIO = 2.4;
const ARROW_HEAD_RATIO = 0.6;
const DROP_RATIO = 0.45;
const LABEL_OFFSET_RATIO = 0.9;
/** Ένας κύκλος παύλας του νερού (`[stroke-dasharray:6_6]` = 12 μονάδες μήκους διαδρομής), σε ύψη κειμένου. */
const WATER_CYCLE_RATIO = 1.5;
const WATER_DASH_CYCLE = 12;

const selectActive = activeReading;
const selectContour = (s: TerrainInspectState): number => activeReading(s)?.nearestContour?.contour ?? -1;
const selectPinned = (s: TerrainInspectState) => s.pinned;
const selectFlow = (s: TerrainInspectState) => s.flow;
const selectProfileLine = (s: TerrainInspectState) => s.profileLine;

function ContourHighlight({ size, words }: { readonly size: number; readonly words: TerrainInspectLayerWords }) {
  const store = useTerrainInspectStore();
  const contour = useTerrainInspect(selectContour);
  const reading = useTerrainInspect(selectActive);
  const line = useMemo(() => {
    if (!store || contour < 0) return null;
    const c = store.index().snapshot.contours[contour];
    return c ? { d: polylinePathData(flatSvgPoints(c.points), c.closed), levelM: c.levelM } : null;
  }, [store, contour]);
  if (line === null || reading === null) return null;
  const at = svgPointOf(reading.x, reading.y);
  const offset = size * LABEL_OFFSET_RATIO;
  return (
    <g data-terrain-inspect="contour" data-level={line.levelM}>
      <path d={line.d} className={INK.casing} strokeWidth={PX.contourCasing} strokeLinejoin="round" {...NON_SCALING} />
      <path d={line.d} className={INK.contour} strokeWidth={PX.contour} strokeLinejoin="round" {...NON_SCALING} />
      <text x={at.x + offset} y={at.y - offset} fontSize={size} strokeWidth={size * HALO} className={INK.contourLabel}>
        {words.contourLabelOf(line.levelM)}
      </text>
    </g>
  );
}

/** Το βέλος «προς τα εκεί κατηφορίζει»: από το σημείο, προς το αζιμούθιο (0° = βορράς = −y στο SVG). */
function arrowPathData(x: number, y: number, azimuthDeg: number, size: number): string {
  const r = (azimuthDeg * Math.PI) / 180;
  const ux = Math.sin(r); const uy = -Math.cos(r);
  const len = size * ARROW_RATIO; const head = size * ARROW_HEAD_RATIO;
  const tx = x + ux * len; const ty = y + uy * len;
  const bx = tx - ux * head; const by = ty - uy * head;
  return `M${x} ${y} L${bx} ${by} M${tx} ${ty} L${bx - uy * head * 0.6} ${by + ux * head * 0.6} L${bx + uy * head * 0.6} ${by - ux * head * 0.6} Z`;
}

function Probe({ size }: { readonly size: number }) {
  const reading = useTerrainInspect(selectActive);
  if (reading === null) return null;
  const { x, y } = svgPointOf(reading.x, reading.y);
  const c = size * CROSS_RATIO;
  const cross = `M${x - c} ${y} L${x + c} ${y} M${x} ${y - c} L${x} ${y + c}`;
  const arrow = reading.downslopeAzimuthDeg === null ? null : arrowPathData(x, y, reading.downslopeAzimuthDeg, size);
  return (
    <g data-terrain-inspect="probe" strokeLinecap="round" strokeLinejoin="round">
      {arrow && <path d={arrow} className={INK.casing} strokeWidth={PX.inkCasing} {...NON_SCALING} />}
      {arrow && <path d={arrow} className={INK.inkFill} strokeWidth={PX.ink} {...NON_SCALING} />}
      <path d={cross} className={INK.casing} strokeWidth={PX.inkCasing} {...NON_SCALING} />
      <path d={cross} className={INK.ink} strokeWidth={PX.ink} {...NON_SCALING} />
      <circle cx={x} cy={y} r={size * RING_RATIO} className={INK.ink} strokeWidth={PX.ink} {...NON_SCALING} />
    </g>
  );
}

function PinnedMark({ size }: { readonly size: number }) {
  const pinned = useTerrainInspect(selectPinned);
  if (pinned === null) return null;
  const { x, y } = svgPointOf(pinned.x, pinned.y);
  return <circle cx={x} cy={y} r={size * DROP_RATIO} className={INK.pinned} strokeWidth={PX.ink} data-terrain-inspect="pinned" {...NON_SCALING} />;
}

function FlowOverlay({ size }: { readonly size: number }) {
  const flow = useTerrainInspect(selectFlow);
  const drawn = useMemo(() => {
    if (flow === null || flow.points.length < 2) return null;
    const points = flow.points.map((p) => svgPointOf(p.x, p.y));
    const cycles = Math.max(1, Math.round(flow.lengthM / (size * WATER_CYCLE_RATIO)));
    return { d: polylinePathData(points, false), end: points[points.length - 1], pathLength: cycles * WATER_DASH_CYCLE };
  }, [flow, size]);
  if (drawn === null) return null;
  return (
    <g data-terrain-inspect="flow" strokeLinecap="round" strokeLinejoin="round">
      <path d={drawn.d} className={INK.casing} strokeWidth={PX.waterCasing} {...NON_SCALING} />
      <path d={drawn.d} pathLength={drawn.pathLength} className={INK.water} strokeWidth={PX.water} {...NON_SCALING} />
      <circle cx={drawn.end.x} cy={drawn.end.y} r={size * DROP_RATIO} className={INK.waterDrop} strokeWidth={PX.ink} {...NON_SCALING} />
    </g>
  );
}

function ProfileOverlay({ size, words }: { readonly size: number; readonly words: TerrainInspectLayerWords }) {
  const line = useTerrainInspect(selectProfileLine);
  if (line === null) return null;
  const a = svgPointOf(line.a.x, line.a.y);
  const b = svgPointOf(line.b.x, line.b.y);
  const d = `M${a.x} ${a.y} L${b.x} ${b.y}`;
  const offset = size * LABEL_OFFSET_RATIO;
  return (
    <g data-terrain-inspect="profile" strokeLinecap="round">
      <path d={d} className={INK.casing} strokeWidth={PX.inkCasing} {...NON_SCALING} />
      <path d={d} className={INK.ink} strokeWidth={PX.ink} {...NON_SCALING} />
      <g fontSize={size} strokeWidth={size * HALO} textAnchor="middle" className={INK.profileLabel}>
        <text x={a.x} y={a.y - offset}>{words.profileStart}</text>
        <text x={b.x} y={b.y - offset}>{words.profileEnd}</text>
      </g>
    </g>
  );
}

export function TerrainInspectLayer({ labelHeightM, words }: { readonly labelHeightM: number; readonly words: TerrainInspectLayerWords }) {
  return (
    <g data-terrain-layer="inspect" pointerEvents="none">
      <ContourHighlight size={labelHeightM} words={words} />
      <FlowOverlay size={labelHeightM} />
      <ProfileOverlay size={labelHeightM} words={words} />
      <PinnedMark size={labelHeightM} />
      <Probe size={labelHeightM} />
    </g>
  );
}
