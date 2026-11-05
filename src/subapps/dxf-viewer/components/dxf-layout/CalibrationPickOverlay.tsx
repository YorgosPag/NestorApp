'use client';

/**
 * ⚠️ ARCHITECTURE-CRITICAL — ADR-040 micro-leaf (πρότυπο `BasePointPickMarkerOverlay` / `DistMeasureOverlayLeaf`).
 *
 * ADR-929 Φ5.2 (ADR-340) — τα σημεία βαθμονόμησης του υποβάθρου πάνω στον καμβά: A, B (και C, D),
 * γραμμή ανά ολοκληρωμένη αναφορά, και «λαστιχένια» γραμμή από το τελευταίο σημείο προς τον δρομέα όσο
 * ζητείται το επόμενο. Επιπλέον η υπόδειξη στη γραμμή κατάστασης και το Esc (κεντρικό escape bus).
 *
 * 🔴 Πριν τη Φ5.2 τα σημάδια ζωγραφίζονταν σε pixel **οθόνης** μέσα στον καμβά της ζώνης Α — ένα pan/zoom
 * τα άφηνε πίσω. Τώρα τα σημεία είναι σε συντεταγμένες σκηνής και προβάλλονται τη στιγμή της απόδοσης.
 *
 * Perf (ADR-040): ο εξωτερικός ακούει ΜΟΝΟ τη (σπάνια) συνεδρία· ο μετασχηματισμός ζει στο inner, που
 * mount-άρεται μόνο όσο υπάρχει συνεδρία· ο 60fps δρομέας ζει στο `RubberBand`, που mount-άρεται μόνο όσο
 * ζητείται σημείο. Read-only, `pointer-events-none` — το κλικ το παίρνει ο κεντρικός αγωγός
 * (`hooks/canvas/canvas-click-calibration.ts`).
 */

import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Point2D, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import { getRealtimeWorldCursor, subscribeRealtimeWorldCursor } from '../../systems/cursor/ImmediatePositionStore';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useEscapeHandler } from '../../systems/escape-bus/useEscapeHandler';
import { ESC_PRIORITY } from '../../systems/escape-bus/escape-priority';
import { toolHintOverrideStore } from '../../hooks/toolHintOverrideStore';
import {
  CALIBRATION_POINT_LABELS,
  nextCalibrationPointLabel,
  selectCalibrationSession,
  useFloorplanBackgroundStore,
  type CalibrationSession,
} from '../../floorplan-background/stores/floorplanBackgroundStore';

interface Props {
  readonly viewport: Viewport;
}

const INK = PANEL_LAYOUT.CAD_COLORS.CONSTRUCTION_LINE;
const HALO = PANEL_LAYOUT.CAD_COLORS.DRAWING_BLACK;
const CROSS_PX = 9;
const RING_PX = 5;
const LABEL_OFFSET_PX = 12;

const getServerCursor = (): null => null;

export function CalibrationPickOverlay({ viewport }: Props) {
  const session = useFloorplanBackgroundStore(selectCalibrationSession);
  if (!session) return null;
  return <CalibrationPickLayer session={session} viewport={viewport} />;
}

function CalibrationPickLayer({ session, viewport }: { session: CalibrationSession; viewport: Viewport }) {
  const transform = useTransformValue();
  const pending = nextCalibrationPointLabel(session) !== null;
  useCalibrationPickMode(session);
  const project = (p: Point2D): Point2D => CoordinateTransforms.worldToScreen(p, transform, viewport);
  const screen = session.points.map(project);
  const last = screen[screen.length - 1];
  const awaitingPair = pending && screen.length % 2 === 1 && last !== undefined;
  return (
    <svg className="absolute inset-0 size-full pointer-events-none z-20" xmlns="http://www.w3.org/2000/svg">
      {pairsOf(screen).map(([a, b], i) => (
        <ReferenceLine key={CALIBRATION_POINT_LABELS[2 * i]} a={a} b={b} dashed={false} />
      ))}
      {awaitingPair && <RubberBand from={last} project={project} />}
      {screen.map((p, i) => (
        <PointMarker key={CALIBRATION_POINT_LABELS[i]} p={p} label={CALIBRATION_POINT_LABELS[i]} />
      ))}
    </svg>
  );
}

/** Ολοκληρωμένα ζεύγη (A–B, C–D) σε σειρά. */
function pairsOf(points: readonly Point2D[]): Array<readonly [Point2D, Point2D]> {
  const pairs: Array<readonly [Point2D, Point2D]> = [];
  for (let i = 0; i + 1 < points.length; i += 2) pairs.push([points[i], points[i + 1]]);
  return pairs;
}

/** Υπόδειξη στη γραμμή κατάστασης + Esc, ΜΟΝΟ όσο ζητείται σημείο (όταν μιλά ο διάλογος, σωπαίνει). */
function useCalibrationPickMode(session: CalibrationSession): void {
  const { t } = useTranslation(['dxf-viewer-panels']);
  const label = nextCalibrationPointLabel(session);
  const hint = label
    ? t('panels.floorplanBackground.calibration.pickHint', { label, index: session.points.length + 1, total: session.target })
    : null;
  useEffect(() => {
    if (!hint) return;
    toolHintOverrideStore.setOverride(hint);
    return () => toolHintOverrideStore.setOverride(null);
  }, [hint]);
  useEscapeHandler(
    label
      ? {
          id: 'floorplan-background-calibration-pick',
          priority: ESC_PRIORITY.MODAL_DIALOG,
          canHandle: () => true,
          handle: () => {
            useFloorplanBackgroundStore.getState().stepBackCalibration();
            return true;
          },
        }
      : null,
  );
}

function RubberBand({ from, project }: { from: Point2D; project: (p: Point2D) => Point2D }) {
  // Ο realtime channel είναι το ΤΕΛΙΚΟ snapped σημείο — εκεί θα πέσει το κλικ.
  const cursor = useSyncExternalStore(subscribeRealtimeWorldCursor, getRealtimeWorldCursor, getServerCursor);
  if (!cursor) return null;
  return <ReferenceLine a={from} b={project(cursor)} dashed />;
}

function ReferenceLine({ a, b, dashed }: { a: Point2D; b: Point2D; dashed: boolean }) {
  return (
    <g>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={HALO} strokeWidth={4} opacity={0.45} />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={INK} strokeWidth={1.5} strokeDasharray={dashed ? '6 4' : undefined} />
    </g>
  );
}

function PointMarker({ p, label }: { p: Point2D; label: string }) {
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={RING_PX} fill="none" stroke={HALO} strokeWidth={4} opacity={0.45} />
      <circle cx={p.x} cy={p.y} r={RING_PX} fill="none" stroke={INK} strokeWidth={2} />
      <line x1={p.x - CROSS_PX} y1={p.y} x2={p.x + CROSS_PX} y2={p.y} stroke={INK} strokeWidth={1.5} />
      <line x1={p.x} y1={p.y - CROSS_PX} x2={p.x} y2={p.y + CROSS_PX} stroke={INK} strokeWidth={1.5} />
      <text
        x={p.x + LABEL_OFFSET_PX}
        y={p.y - LABEL_OFFSET_PX}
        fill={INK}
        stroke={HALO}
        strokeWidth={3}
        paintOrder="stroke"
        fontSize={13}
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  );
}

