/* eslint-disable design-system/no-hardcoded-colors */
/**
 * ⚠️ ARCHITECTURE-CRITICAL — ADR-040 micro-leaf (πρότυπο `SketchFreehandPreviewSubscriber`).
 * Το `useSyncExternalStore` ζει ΕΔΩ· το Shell (`CanvasLayerStack`) ΔΕΝ subscribe-άρει (CHECK 6C).
 *
 * ADR-680 — ζωντανή ένδειξη του εφήμερου «Μέτρημα Απόστασης» (DIST): πολυγραμμή + rubber-band
 * προς τον cursor + ανά-τμήμα μήκη + τρέχον ΣΥΝΟΛΟ. Καμία εγγραφή entity/DB — μόνο ζωγραφική
 * πάνω από το main canvas, από το in-memory `dist-ephemeral-store`.
 *
 * Perf: το outer subscribe-άρει ΜΟΝΟ στο `activeTool` (low-freq)· το 60fps realtime-cursor
 * subscription ζει στο inner `DistActiveLayer`, που mount-άρεται ΜΟΝΟ όσο το εργαλείο είναι ενεργό.
 *
 * @module subapps/dxf-viewer/components/dxf-layout/DistMeasureOverlayLeaf
 */
'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import type { SceneUnits } from '../../utils/scene-units';
import { useActiveTool, toolStateStore } from '../../stores/ToolStateStore';
import {
  subscribeRealtimeWorldCursor,
  getRealtimeWorldCursor,
} from '../../systems/cursor/ImmediatePositionStore';
import {
  subscribeDist,
  getDistSnapshot,
  clearDist,
  finishDistPath,
  undoLastDistPoint,
} from '../../systems/measure/dist-ephemeral-store';
import { computeDistReadout } from '../../systems/measure/dist-readout';
import { useEscapeHandler, ESC_PRIORITY } from '../../systems/escape-bus';

const DIST_TOOL = 'dist';
const INK = PANEL_LAYOUT.CAD_COLORS.CONSTRUCTION_LINE; // sky-blue = «βοηθητικό/εφήμερο»
const LABEL_BG = 'rgba(17,24,39,0.82)';
const LABEL_FG = PANEL_LAYOUT.CAD_COLORS.TEXT_INVERTED;

interface Props {
  transform: ViewTransform;
  viewport: Viewport;
  sceneUnits: SceneUnits;
  className?: string;
}

/**
 * Outer leaf: subscribes only to the (low-freq) active tool. Clears the ephemeral store
 * when the tool is deactivated (ESC → select, toggle-off, other tool), and mounts the
 * live layer only while «dist» is active.
 */
export const DistMeasureOverlayLeaf = React.memo(function DistMeasureOverlayLeaf(props: Props) {
  const activeTool = useActiveTool();

  useEffect(() => {
    if (activeTool !== DIST_TOOL) {
      const s = getDistSnapshot();
      if (s.active.length > 0 || s.committed.length > 0) clearDist();
    }
  }, [activeTool]);

  if (activeTool !== DIST_TOOL) return null;
  return <DistActiveLayer {...props} />;
});

/** Inner layer: mounted only while «dist» is active → the 60fps cursor sub is confined here. */
function DistActiveLayer({ transform, viewport, sceneUnits, className }: Props) {
  const { t } = useTranslation('dxf-viewer-panels');
  const snap = useSyncExternalStore(subscribeDist, getDistSnapshot);
  const cursor = useSyncExternalStore(subscribeRealtimeWorldCursor, getRealtimeWorldCursor, () => null);

  // Escape → κεντρικό escape-bus (ADR-364, SSoT): καθαρίζει τη μέτρηση ΜΕΝΟΝΤΑΣ σε mode (για νέα
  // μέτρηση)· δεύτερο ESC σε κενό βγαίνει στο select. Ο handler ζει μόνο όσο είναι mounted το DIST.
  useEscapeHandler({
    id: 'measure/dist',
    priority: ESC_PRIORITY.DRAW_TOOL,
    canHandle: () => true, // registered only while DIST is active (this layer is mounted)
    handle: () => {
      const s = getDistSnapshot();
      if (s.active.length > 0 || s.committed.length > 0) clearDist();
      else toolStateStore.selectTool('select');
      return true;
    },
  });

  // Enter/double-click → κλείσιμο τρέχουσας διαδρομής· Backspace → αναίρεση τελευταίου σημείου.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      if (e.key === 'Enter') { e.preventDefault(); finishDistPath(); }
      else if (e.key === 'Backspace') { e.preventDefault(); undoLastDistPoint(); }
    };
    const onDbl = () => finishDistPath();
    // Capture-phase: το Enter φτάνει στο DIST πριν τυχόν global handler σταματήσει το event.
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('dblclick', onDbl);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('dblclick', onDbl);
    };
  }, []);

  const project = (p: Point2D): Point2D => CoordinateTransforms.worldToScreen(p, transform, viewport);
  // Ζωντανή διαδρομή = ενεργά σημεία + ο cursor ως το κινούμενο τελευταίο vertex.
  const livePath = cursor && snap.active.length > 0 ? [...snap.active, cursor] : snap.active;
  const totalPrefix = t('cadDock.statusBar.distTotal');

  return (
    <svg className={className} overflow="visible">
      {snap.committed.map((path, i) => (
        <DistPath key={`c${i}`} points={path} sceneUnits={sceneUnits} project={project}
          totalPrefix={totalPrefix} dashed={false} />
      ))}
      {livePath.length >= 2 && (
        <DistPath points={livePath} sceneUnits={sceneUnits} project={project}
          totalPrefix={totalPrefix} dashed />
      )}
    </svg>
  );
}

function DistPath({ points, sceneUnits, project, totalPrefix, dashed }: {
  points: readonly Point2D[];
  sceneUnits: SceneUnits;
  project: (p: Point2D) => Point2D;
  totalPrefix: string;
  dashed: boolean;
}) {
  const screen = points.map(project);
  const readout = computeDistReadout(points, sceneUnits);
  const polyStr = screen.map((p) => `${p.x},${p.y}`).join(' ');
  const last = screen[screen.length - 1];

  return (
    <g>
      <polyline
        points={polyStr}
        fill="none"
        stroke={INK}
        strokeWidth={1.5}
        strokeDasharray={dashed ? '6 4' : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {screen.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={INK} />
      ))}
      {readout.segments.map((seg, i) => {
        const m = project(seg.mid);
        return <DistLabel key={i} x={m.x} y={m.y} text={seg.label} />;
      })}
      {readout.segments.length >= 2 && last && (
        <DistLabel x={last.x + 14} y={last.y - 14} text={`${totalPrefix} ${readout.totalLabel}`} emphatic />
      )}
    </g>
  );
}

function DistLabel({ x, y, text, emphatic }: { x: number; y: number; text: string; emphatic?: boolean }) {
  const w = text.length * (emphatic ? 7.5 : 6) + 10;
  const h = emphatic ? 18 : 15;
  return (
    <g>
      <rect
        x={x - w / 2} y={y - h / 2} width={w} height={h} rx={3}
        fill={LABEL_BG} stroke={INK} strokeWidth={emphatic ? 1 : 0.5}
      />
      <text
        x={x} y={y} textAnchor="middle" dominantBaseline="central"
        fontSize={emphatic ? 12 : 10} fontWeight={emphatic ? 700 : 600} fill={LABEL_FG}
      >
        {text}
      </text>
    </g>
  );
}
