/**
 * ADR-513 — «Δαχτυλίδι Εντολών» (Radial Command Ring): in-canvas dynamic input στη σχεδίαση
 * τοίχου, με τη μηχανική του **AutoCAD NavWheel (SteeringWheels)** — «δάχτυλο μέσα σε δαχτυλίδι»:
 *
 *  · Δύο ομόκεντροι κύκλοι: **εσωτερικός ορατός** (4 πλήρεις pie-wedges, ΧΩΡΙΣ τρύπα, με labels)
 *    + **εξωτερικός αόρατος** (deadzone). Ο κέρσορας κινείται **ελεύθερα** μέσα· το δαχτυλίδι ΔΕΝ
 *    ακολουθεί. Σπρώχνεται ΜΟΝΟ όταν ο κέρσορας φτάσει στην περιφέρεια του εξωτερικού (`pushWheelCenter`).
 *  · Κέρσορας στον **εσωτερικό** → πλήκτρα **ορατά**, hover **φωτίζει** + γίνεται **βελάκι**.
 *    Στο **«κουλούρι»** (annulus) → πλήκτρα **κρυφά** (δεν σπρώχνεται).
 *  · **Κλικ** σε πλήκτρο → ανοίγει **μικρό διακριτικό input**· type+Enter = καταχώρηση, μετά συνεχίζεις.
 *    Τα πεδία **ΔΕΝ** φαίνονται συνεχώς. Κλικ έξω από τα πλήκτρα (annulus) = commit τοίχου (περνά στον καμβά).
 *
 * **FULL SSoT — μηδέν νέο store:** commit μέσω `DynamicInputLockStore` (Μήκος/Γωνία) +
 * `wallToolBridgeStore.setParamOverrides` (Πάχος/Ύψος) + `evalExpr` (math). `applyLengthAngleLock`
 * κάνει preview≡commit. Γεωμετρία/deadzone → `radial-ring-logic.ts` (pure, testable).
 * Isolated micro-leaf (ADR-040): render μόνο σε awaitingEnd (gate στο `DynamicInputSubscriber`).
 */

'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { portalComponents } from '@/styles/design-tokens';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { type DisplayUnit, fromDisplay, formatDisplayValue } from '../../../config/units';
import { useDisplayUnit } from '../../../hooks/common/useDisplayUnit';
import { type SceneUnits, mmToSceneUnits } from '../../../utils/scene-units';
import type { Point2D } from '../../../rendering/types/Types';
import { setCrosshairSuppressed } from '../../cursor/CrosshairSuppressionStore';
import { useEscapeHandler, ESC_PRIORITY } from '../../escape-bus';
import { wallPreviewStore, useWallPreview } from '../../../bim/walls/wall-preview-store';
import { wallToolBridgeStore } from '../../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
import { resolveWallThicknessMm, type WallParamOverrides } from '../../../hooks/drawing/wall-completion';
import { resolveStoreyHeightMm } from '../../../systems/levels/storey-creation-defaults';
import { DEFAULT_WALL_HEIGHT_MM } from '../../../bim/types/wall-types';
import { DynamicInputLockStore } from '../DynamicInputLockStore';
import { evalExpr } from '../numeric-expression';
import {
  type RingFieldKey,
  type CursorZone,
  RING_TAB_ORDER,
  RING_INNER_R,
  RING_OPACITY,
  RING_HOVER_OPACITY,
  WEDGE_ANGLES,
  polarPoint,
  pieSectorPath,
  wedgeAtAngle,
  cursorZone,
  advanceWheelCenter,
  isRingFieldLocked,
  lengthDisplayToSceneLock,
  normalizeAngleDeg,
} from '../radial-ring-logic';

export interface RadialCommandRingProps {
  /** Scene-units του ενεργού level (mm→scene conversion για το lock μήκους). */
  readonly sceneUnits: SceneUnits;
  /** Draw-time getter του canvas element — για να γίνεται **βελάκι** ο κέρσορας πάνω στα πλήκτρα
   *  (ο καμβάς έχει inline `cursor:crosshair`, οπότε πρέπει να αλλάξει στο ίδιο το element). */
  readonly getCanvasEl?: () => HTMLCanvasElement | null;
}

const LABEL_KEY: Record<RingFieldKey, string> = {
  length: 'ringLength', angle: 'ringAngle', thickness: 'ringThickness', height: 'ringHeight',
};

/** Τρέχοντα overrides (bridge → preview fallback). */
function currentOverrides(): WallParamOverrides {
  return wallToolBridgeStore.get()?.overrides ?? wallPreviewStore.get().overrides;
}

/**
 * Αρχική τιμή popup (re-open δείχνει την κλειδωμένη τιμή — «κλειδώνουν οι τιμές»):
 *   · Πάχος/Ύψος ← overrides· · Μήκος/Γωνία ← τρέχον lock (αν κλειδωμένο), αλλιώς κενό.
 */
function seedValue(
  key: RingFieldKey,
  unit: DisplayUnit,
  sceneUnits: SceneUnits,
  lock: { length: number | null; angle: number | null },
): string {
  const ov = currentOverrides();
  if (key === 'thickness') return formatDisplayValue(resolveWallThicknessMm(ov), unit);
  if (key === 'height') return formatDisplayValue(resolveStoreyHeightMm(ov.height, DEFAULT_WALL_HEIGHT_MM), unit);
  if (key === 'length') return lock.length !== null ? formatDisplayValue(lock.length / mmToSceneUnits(sceneUnits), unit) : '';
  return lock.angle !== null ? lock.angle.toFixed(2) : ''; // angle
}

export function RadialCommandRing({ sceneUnits, getCanvasEl }: RadialCommandRingProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { displayUnit } = useDisplayUnit();
  const colors = useSemanticColors();

  const lock = useSyncExternalStore(DynamicInputLockStore.subscribe, DynamicInputLockStore.getSnapshot, DynamicInputLockStore.getSnapshot);
  const preview = useWallPreview();
  const startKey = preview.startPoint ? `${preview.startPoint.x},${preview.startPoint.y}` : '';

  const centerRef = useRef<Point2D | null>(null);
  const prevCursorRef = useRef<Point2D | null>(null);
  const cursorRef = useRef<Point2D | null>(null);
  const zoneRef = useRef<CursorZone>('inside');
  const popupRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [center, setCenter] = useState<Point2D | null>(null);
  const [zone, setZone] = useState<CursorZone>('inside');
  const [hovered, setHovered] = useState<RingFieldKey | null>(null);
  const [openField, setOpenField] = useState<RingFieldKey | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ADR-513 — η θέση οδηγείται από WINDOW mousemove (clientX/Y, `position: fixed`): ΔΕΝ παγώνει
  // ποτέ, ακόμη κι όταν ο κέρσορας είναι πάνω στα `pointer-events-auto` πλήκτρα (το mousemove του
  // καμβά σταματά εκεί· το window listener όχι). Λύνει hover-stuck + half-speed + στιγμιαίο κόλλημα.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = { x: e.clientX, y: e.clientY };
      cursorRef.current = p;
      setCursor(p);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Νέος τοίχος → re-init κέντρο δαχτυλιδιού στον τρέχοντα κέρσορα, κλείσε popup.
  useEffect(() => {
    const c = cursorRef.current;
    if (c) {
      centerRef.current = { x: c.x, y: c.y };
      prevCursorRef.current = { x: c.x, y: c.y };
      setCenter({ x: c.x, y: c.y });
    }
    setOpenField(null);
  }, [startKey]);

  // Deadzone «δάχτυλο-σε-δαχτυλίδι»: inside → half-speed follow· annulus → ακίνητο· outside → push.
  // + κρύψε το σταυρόνημα όταν inside (γίνεται βελάκι πάνω στα πλήκτρα).
  useEffect(() => {
    if (!cursor) return;
    let c = centerRef.current;
    if (!c) {
      c = { x: cursor.x, y: cursor.y };
      centerRef.current = c;
      prevCursorRef.current = { x: cursor.x, y: cursor.y };
      setCenter(c);
      return;
    }
    const prev = prevCursorRef.current ?? cursor;
    const d = Math.hypot(cursor.x - c.x, cursor.y - c.y);
    const z = cursorZone(d);
    const next = advanceWheelCenter(c, prev, cursor, z);
    if (next.x !== c.x || next.y !== c.y) { centerRef.current = next; setCenter(next); }
    zoneRef.current = z;
    setZone(z);
    setHovered(z === 'inside'
      ? wedgeAtAngle((Math.atan2(cursor.y - c.y, cursor.x - c.x) * 180) / Math.PI)
      : null);
    setCrosshairSuppressed(z === 'inside');
    // Πάνω στα πλήκτρα: βελάκι αντί crosshair στο ΙΔΙΟ canvas element (inline cursor:crosshair).
    // Re-assert ανά κίνηση ώστε να «κερδίζει» ακόμη κι αν ο καμβάς ξανα-render-άρει.
    const canvasEl = getCanvasEl?.();
    if (canvasEl) canvasEl.style.cursor = z === 'inside' ? 'default' : 'crosshair';
    prevCursorRef.current = { x: cursor.x, y: cursor.y };
  }, [cursor, getCanvasEl]);

  // Καθάρισε crosshair-suppression + επανάφερε crosshair όταν φεύγει το δαχτυλίδι (tool end / phase).
  useEffect(() => () => {
    setCrosshairSuppressed(false);
    const el = getCanvasEl?.();
    if (el) el.style.cursor = 'crosshair';
  }, [getCanvasEl]);

  const openWedge = useCallback((key: RingFieldKey) => {
    setOpenField(key);
    setDraft(seedValue(key, displayUnit, sceneUnits, DynamicInputLockStore.getLocked()));
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  }, [displayUnit, sceneUnits]);

  // ADR-513 — Όσο ο κέρσορας είναι ΠΑΝΩ στα πλήκτρα (inside) τα wedges είναι `pointer-events-none`
  // (ώστε ο ΤΟΙΧΟΣ να ΣΥΝΕΧΙΖΕΙ να επεκτείνεται — ο καμβάς δέχεται mousemove). Άρα το κλικ στο
  // πλήκτρο το πιάνουμε εδώ (window capture): ανοίγουμε το πεδίο ΚΑΙ μπλοκάρουμε το commit τοίχου.
  // ⚠️ Το commit τοίχου γίνεται στο **mouseup** (React onMouseUp στον καμβά) — γι' αυτό μπλοκάρουμε
  // ΚΑΙ τα τρία (mousedown/mouseup/click) σε capture phase, ώστε το event να μη φτάσει στον React root.
  // Κλικ έξω από τα πλήκτρα (annulus) → περνά κανονικά στον καμβά = commit.
  useEffect(() => {
    const intercept = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return; // popup input: άφησέ το
      const c = centerRef.current;
      const cur = cursorRef.current;
      if (!c || !cur) return;
      const d = Math.hypot(cur.x - c.x, cur.y - c.y);
      if (cursorZone(d) !== 'inside') return; // annulus/outside → άφησε το commit
      if (e.type === 'mousedown') {
        openWedge(wedgeAtAngle((Math.atan2(cur.y - c.y, cur.x - c.x) * 180) / Math.PI));
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    window.addEventListener('mousedown', intercept, true);
    window.addEventListener('mouseup', intercept, true);
    window.addEventListener('click', intercept, true);
    return () => {
      window.removeEventListener('mousedown', intercept, true);
      window.removeEventListener('mouseup', intercept, true);
      window.removeEventListener('click', intercept, true);
    };
  }, [openWedge]);

  const commitOpen = useCallback(() => {
    if (!openField) return;
    const num = evalExpr(draft);
    if (num !== null) {
      if (openField === 'length') {
        DynamicInputLockStore.lockLength(lengthDisplayToSceneLock(num, displayUnit, sceneUnits));
      } else if (openField === 'angle') {
        DynamicInputLockStore.lockAngle(normalizeAngleDeg(num));
      } else {
        const handle = wallToolBridgeStore.get();
        handle?.setParamOverrides({ ...handle.overrides, [openField]: fromDisplay(num, displayUnit) });
      }
    }
    setOpenField(null);
  }, [openField, draft, displayUnit, sceneUnits]);

  const onPopupKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitOpen(); }
  }, [commitOpen]);

  // ADR-364 — Escape μέσω του κεντρικού EscapeCommandBus (SSoT· ΟΧΙ inline e.key listener).
  // Το popup πεδίο είναι dynamic-input στυλ: `allowWhenEditable` ώστε να «κερδίζει» το ESC όσο
  // το input έχει focus, στο ίδιο slot DYNAMIC_INPUT (P900) με το useDynamicInputKeyboard.
  useEscapeHandler({
    id: 'radial-command-ring-popup',
    priority: ESC_PRIORITY.DYNAMIC_INPUT,
    allowWhenEditable: true,
    canHandle: () => openField !== null,
    handle: () => { setOpenField(null); return true; },
  });

  if (!center || !cursor) return null;

  const showWedges = zone === 'inside' || openField !== null;
  const box = 2 * RING_INNER_R;
  const cc = RING_INNER_R; // SVG κέντρο (= κέντρο δαχτυλιδιού)
  const popupAnchor = openField ? polarPoint(cc, cc, RING_INNER_R * 0.62, WEDGE_ANGLES[openField].centerDeg) : null;

  // section = pointer-events-none → τα κλικ εκτός πλήκτρων (annulus) πάνε στον καμβά = commit τοίχου.
  // `position: fixed` + clientX/Y → ευθυγραμμισμένο με τον φυσικό κέρσορα, ανεξάρτητο από το frozen
  // canvas-feed (το window mousemove το οδηγεί).
  return (
    <section
      aria-label={t('tools.wall.ringLabel')}
      className={`fixed -translate-x-1/2 -translate-y-1/2 ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${colors.text.WHITE}`}
      style={boxStyle(center.x, center.y, box)}
    >
      {showWedges && (
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}>
          {RING_TAB_ORDER.map((key) => {
            const { a0, a1 } = WEDGE_ANGLES[key];
            const ov = currentOverrides();
            const lockedActive = isRingFieldLocked(key, lock)
              || (key === 'thickness' && ov.thickness !== undefined)
              || (key === 'height' && ov.height !== undefined);
            const active = hovered === key || openField === key || lockedActive;
            return (
              <path
                key={key}
                d={pieSectorPath(cc, cc, RING_INNER_R, a0, a1)}
                fill="currentColor"
                fillOpacity={active ? RING_HOVER_OPACITY : RING_OPACITY}
                stroke="currentColor"
                strokeOpacity={0.5}
                strokeWidth={0.75}
                className={PANEL_LAYOUT.POINTER_EVENTS.NONE}
              />
            );
          })}
          {RING_TAB_ORDER.map((key) => {
            const a = polarPoint(cc, cc, RING_INNER_R * 0.6, WEDGE_ANGLES[key].centerDeg);
            return (
              <text
                key={key}
                x={a.x}
                y={a.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill="currentColor"
                className={PANEL_LAYOUT.POINTER_EVENTS.NONE}
              >
                {t(`tools.wall.${LABEL_KEY[key]}`)}
              </text>
            );
          })}
        </svg>
      )}

      {openField && popupAnchor && (
        <div
          ref={popupRef}
          className={`absolute -translate-x-1/2 -translate-y-1/2 ${PANEL_LAYOUT.POINTER_EVENTS.AUTO}`}
          style={anchorStyle(popupAnchor.x, popupAnchor.y)}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onPopupKeyDown}
            aria-label={t(`tools.wall.${LABEL_KEY[openField]}`)}
            className={`w-16 text-center ${colors.text.WHITE} ${colors.bg.accent} ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded`}
          />
        </div>
      )}
    </section>
  );
}

/** Inline cursor-follow box (px· ίδια εξαίρεση με `DynamicInputContainer`). Κεντραρισμένο στο δαχτυλίδι. */
function boxStyle(x: number, y: number, box: number): React.CSSProperties {
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${box}px`,
    height: `${box}px`,
    zIndex: portalComponents.overlay.controls.zIndex() + 90,
  };
}

/** Θέση popup-input στο anchor του wedge (px εντός του box). */
function anchorStyle(x: number, y: number): React.CSSProperties {
  return { left: `${x}px`, top: `${y}px` };
}
