/**
 * ADR-513 — «Δαχτυλίδι Εντολών» (Radial Command Ring): in-canvas dynamic input με τη μηχανική
 * του **AutoCAD NavWheel (SteeringWheels)** — «δάχτυλο μέσα σε δαχτυλίδι». **Tool-agnostic**:
 * οδηγείται από ένα `RingConfig` (ποια πεδία, σε ποια θέση, πώς γράφονται) ώστε ΕΝΑ component
 * να εξυπηρετεί ΤΟΙΧΟ (Μήκος/Γωνία/Πάχος/Ύψος) ΚΑΙ ΓΡΑΜΜΗ (Μήκος/Γωνία/Τύπος γραμμής).
 *
 *  · Δύο ομόκεντροι κύκλοι: **εσωτερικός ορατός** (pie-wedges, με labels) + **εξωτερικός αόρατος**
 *    (deadzone). Ο κέρσορας κινείται **ελεύθερα** μέσα· το δαχτυλίδι ΔΕΝ ακολουθεί — σπρώχνεται ΜΟΝΟ
 *    στην περιφέρεια του εξωτερικού (`pushWheelCenter`).
 *  · **Κλικ** σε wedge → μικρό popup: `numeric` πεδίο → input+Enter· `select` πεδίο (π.χ. Τύπος
 *    γραμμής) → drop-down λίστα → επιλογή = commit. Κλικ έξω από τα wedges (annulus) = commit στον καμβά.
 *
 * **FULL SSoT — μηδέν νέο store:** Μήκος/Γωνία → `DynamicInputLockStore` (μέσω config builders)·
 * τα tool-specific (Πάχος/Ύψος → wall bridge· Τύπος → `QuickStyleStore`) ζουν στο `RingConfig`.
 * `applyLengthAngleLock` κάνει preview≡commit (γραμμή + τοίχος). Γεωμετρία/deadzone →
 * `radial-ring-logic.ts` (pure, testable). Isolated micro-leaf (ADR-040): render μόνο σε awaitingEnd.
 *
 * @see ../ring-config.ts · ../wall-ring-config.ts · ../line-ring-config.ts
 */

'use client';

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { portalComponents } from '@/styles/design-tokens';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useDisplayUnit } from '../../../hooks/common/useDisplayUnit';
import type { SceneUnits } from '../../../utils/scene-units';
import type { Point2D } from '../../../rendering/types/Types';
import { setCrosshairSuppressed } from '../../cursor/CrosshairSuppressionStore';
import { useEscapeHandler, ESC_PRIORITY } from '../../escape-bus';
import { evalExpr } from '../numeric-expression';
import type { RingConfig, RingFieldDef, RingUnitContext } from '../ring-config';
import {
  type RingWedgePosition,
  type CursorZone,
  RING_INNER_R,
  RING_OPACITY,
  RING_HOVER_OPACITY,
  WEDGE_POSITION_ANGLES,
  polarPoint,
  pieSectorPath,
  wedgePositionAtAngle,
  cursorZone,
  advanceWheelCenter,
} from '../radial-ring-logic';

export interface RadialCommandRingProps {
  /** Διάταξη πεδίων ανά εργαλείο (τοίχος / γραμμή). */
  readonly config: RingConfig;
  /** Scene-units του ενεργού level (mm→scene conversion για το lock μήκους). */
  readonly sceneUnits: SceneUnits;
  /** Κλειδί επανα-αρχικοποίησης: αλλάζει σε νέο segment (αρχή τοίχου / 1ο σημείο γραμμής). */
  readonly startKey: string;
  /** Draw-time getter του canvas element — βελάκι cursor πάνω στα wedges + synthetic mousemove. */
  readonly getCanvasEl?: () => HTMLCanvasElement | null;
}

export function RadialCommandRing({
  config,
  sceneUnits,
  startKey,
  getCanvasEl,
}: RadialCommandRingProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { displayUnit } = useDisplayUnit();
  const colors = useSemanticColors();

  // Re-render σε κάθε αλλαγή των stores που τρέφουν highlight/seed (lock / overrides / linetype).
  // Χαμηλή συχνότητα (αλλάζουν σε ενέργεια χρήστη, όχι ανά frame) — ο high-freq κέρσορας πάει από window mousemove.
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => config.subscribe(forceRender), [config]);

  const unitCtx: RingUnitContext = useMemo(() => ({ displayUnit, sceneUnits }), [displayUnit, sceneUnits]);

  const fieldByPosition = useMemo(() => {
    const m = new Map<RingWedgePosition, RingFieldDef>();
    for (const f of config.fields) m.set(f.position, f);
    return m;
  }, [config]);
  const fieldByKey = useMemo(() => {
    const m = new Map<string, RingFieldDef>();
    for (const f of config.fields) m.set(f.key, f);
    return m;
  }, [config]);

  const centerRef = useRef<Point2D | null>(null);
  const prevCursorRef = useRef<Point2D | null>(null);
  const cursorRef = useRef<Point2D | null>(null);
  const zoneRef = useRef<CursorZone>('inside');
  const popupRef = useRef<HTMLDivElement>(null);
  const canvasCursorRef = useRef<string | null>(null);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [center, setCenter] = useState<Point2D | null>(null);
  const [zone, setZone] = useState<CursorZone>('inside');
  const [hovered, setHovered] = useState<RingWedgePosition | null>(null);
  const [openField, setOpenField] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Η θέση οδηγείται από WINDOW mousemove (clientX/Y, `position: fixed`): ΔΕΝ παγώνει ποτέ, ακόμη
  // κι όταν ο κέρσορας είναι πάνω στα `pointer-events-auto` πλήκτρα (το mousemove του καμβά σταματά εκεί).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = { x: e.clientX, y: e.clientY };
      cursorRef.current = p;
      setCursor(p);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Νέο segment → re-init κέντρο δαχτυλιδιού στον τρέχοντα κέρσορα, κλείσε popup.
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
      ? wedgePositionAtAngle((Math.atan2(cursor.y - c.y, cursor.x - c.x) * 180) / Math.PI)
      : null);
    setCrosshairSuppressed(z === 'inside');
    // Πάνω στα wedges: βελάκι. ΑΛΛΟΥ: επανάφερε ΑΚΡΙΒΩΣ το αρχικό cursor (capture-once).
    const canvasEl = getCanvasEl?.();
    if (canvasEl) {
      if (z === 'inside') {
        if (canvasCursorRef.current === null) canvasCursorRef.current = canvasEl.style.cursor;
        canvasEl.style.cursor = 'default';
      } else if (canvasCursorRef.current !== null) {
        canvasEl.style.cursor = canvasCursorRef.current;
        canvasCursorRef.current = null;
      }
    }
    prevCursorRef.current = { x: cursor.x, y: cursor.y };
  }, [cursor, getCanvasEl]);

  // Καθάρισε crosshair-suppression + επανάφερε το αρχικό cursor όταν φεύγει το δαχτυλίδι.
  useEffect(() => () => {
    setCrosshairSuppressed(false);
    const el = getCanvasEl?.();
    if (el && canvasCursorRef.current !== null) {
      el.style.cursor = canvasCursorRef.current;
      canvasCursorRef.current = null;
    }
  }, [getCanvasEl]);

  /** Synthetic mousemove στον καμβά → άμεσο rebuild του ghost μετά από lock/override/τύπο. */
  const pokeCanvas = useCallback(() => {
    const canvasEl = getCanvasEl?.();
    const cur = cursorRef.current;
    if (canvasEl && cur) {
      canvasEl.dispatchEvent(new MouseEvent('mousemove', { clientX: cur.x, clientY: cur.y, bubbles: true }));
    }
  }, [getCanvasEl]);

  const openWedge = useCallback((position: RingWedgePosition) => {
    const field = fieldByPosition.get(position);
    if (!field) return; // κενή θέση (π.χ. κάτω wedge της γραμμής) → no-op
    setOpenField(field.key);
    if (field.kind === 'numeric') {
      setDraft(field.seed(unitCtx));
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [fieldByPosition, unitCtx]);

  // Όσο ο κέρσορας είναι ΠΑΝΩ στα wedges (inside) είναι `pointer-events-none` (ώστε ο καμβάς να
  // συνεχίζει να δέχεται mousemove). Άρα το κλικ σε wedge το πιάνουμε εδώ (window capture) ΚΑΙ
  // μπλοκάρουμε το commit. Κλικ έξω από τα wedges (annulus) → περνά κανονικά = commit.
  useEffect(() => {
    const intercept = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return; // popup: άφησέ το
      const c = centerRef.current;
      const cur = cursorRef.current;
      if (!c || !cur) return;
      const d = Math.hypot(cur.x - c.x, cur.y - c.y);
      if (cursorZone(d) !== 'inside') return; // annulus/outside → άφησε το commit
      if (e.type === 'mousedown') {
        openWedge(wedgePositionAtAngle((Math.atan2(cur.y - c.y, cur.x - c.x) * 180) / Math.PI));
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

  const commitNumericOpen = useCallback(() => {
    if (!openField) return;
    const field = fieldByKey.get(openField);
    if (field?.kind !== 'numeric' || !field.commitNumeric) { setOpenField(null); return; }
    // Δέξου ΚΑΙ κόμμα ΚΑΙ τελεία ως δεκαδικό (0,25 ≡ 0.25) — όπως το `DynamicInputField`.
    const num = evalExpr(draft.replace(/,/g, '.'));
    if (num !== null) {
      field.commitNumeric(num, unitCtx);
      pokeCanvas();
    }
    setOpenField(null);
  }, [openField, fieldByKey, draft, unitCtx, pokeCanvas]);

  const commitSelectOpen = useCallback((value: string) => {
    if (!openField) return;
    const field = fieldByKey.get(openField);
    if (field?.kind === 'select' && field.commitSelect) {
      field.commitSelect(value);
      pokeCanvas();
    }
    setOpenField(null);
  }, [openField, fieldByKey, pokeCanvas]);

  const onPopupKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); commitNumericOpen(); }
  }, [commitNumericOpen]);

  // ADR-364 — Escape μέσω του κεντρικού EscapeCommandBus (SSoT), ίδιο slot DYNAMIC_INPUT (P900).
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
  const openFieldDef = openField ? fieldByKey.get(openField) ?? null : null;
  const popupAnchor = openFieldDef
    ? polarPoint(cc, cc, RING_INNER_R * 0.62, WEDGE_POSITION_ANGLES[openFieldDef.position].centerDeg)
    : null;

  return (
    <section
      aria-label={t(config.ariaLabelKey)}
      className={`fixed -translate-x-1/2 -translate-y-1/2 ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${colors.text.WHITE}`}
      style={boxStyle(center.x, center.y, box)}
    >
      {showWedges && (
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}>
          {config.fields.map((field) => {
            const { a0, a1 } = WEDGE_POSITION_ANGLES[field.position];
            const active = hovered === field.position || openField === field.key || field.isLocked();
            return (
              <path
                key={field.key}
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
          {config.fields.map((field) => {
            const a = polarPoint(cc, cc, RING_INNER_R * 0.6, WEDGE_POSITION_ANGLES[field.position].centerDeg);
            return (
              <text
                key={field.key}
                x={a.x}
                y={a.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill="currentColor"
                className={PANEL_LAYOUT.POINTER_EVENTS.NONE}
              >
                {t(field.labelKey)}
              </text>
            );
          })}
        </svg>
      )}

      {openFieldDef && popupAnchor && (
        <div
          ref={popupRef}
          className={`absolute -translate-x-1/2 -translate-y-1/2 ${PANEL_LAYOUT.POINTER_EVENTS.AUTO}`}
          style={anchorStyle(popupAnchor.x, popupAnchor.y)}
        >
          {openFieldDef.kind === 'numeric' ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onPopupKeyDown}
              aria-label={t(openFieldDef.labelKey)}
              className={`w-16 text-center ${colors.text.WHITE} ${colors.bg.accent} ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded`}
            />
          ) : (
            <ul
              role="listbox"
              aria-label={t(openFieldDef.labelKey)}
              className={`w-28 max-h-48 overflow-auto ${colors.text.WHITE} ${colors.bg.accent} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded`}
            >
              {openFieldDef.options?.().map((opt) => {
                const selected = opt.value === openFieldDef.seed(unitCtx);
                return (
                  <li key={opt.value} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => commitSelectOpen(opt.value)}
                      className={`w-full text-left hover:opacity-80 ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${selected ? 'font-semibold' : ''}`}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Inline cursor-follow box (px). Κεντραρισμένο στο δαχτυλίδι. */
function boxStyle(x: number, y: number, box: number): React.CSSProperties {
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${box}px`,
    height: `${box}px`,
    zIndex: portalComponents.overlay.controls.zIndex() + 90,
  };
}

/** Θέση popup στο anchor του wedge (px εντός του box). */
function anchorStyle(x: number, y: number): React.CSSProperties {
  return { left: `${x}px`, top: `${y}px` };
}
