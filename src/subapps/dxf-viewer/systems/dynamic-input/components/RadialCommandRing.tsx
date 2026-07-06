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
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useDisplayUnit } from '../../../hooks/common/useDisplayUnit';
import type { SceneUnits } from '../../../utils/scene-units';
import type { Point2D } from '../../../rendering/types/Types';
import { setCrosshairSuppressed } from '../../cursor/CrosshairSuppressionStore';
import { useEscapeHandler, ESC_PRIORITY } from '../../escape-bus';
import { evalExpr } from '../numeric-expression';
import type { RingConfig, RingFieldDef, RingUnitContext } from '../ring-config';
import {
  type CursorZone,
  RING_INNER_R,
  RING_OPACITY,
  RING_HOVER_OPACITY,
  computeRingSlices,
  sliceIndexAtAngle,
  polarPoint,
  pieSectorPath,
  cursorZone,
  advanceWheelCenter,
  nextFieldKeyInOrder,
} from '../radial-ring-logic';
// File-size SRP split (N.7.1) — pure predicates + inline style builders.
import { isHeadsUpNumericKey, isEditableTarget, boxStyle, anchorStyle } from './radial-command-ring-helpers';

export interface RadialCommandRingProps {
  /** Διάταξη πεδίων ανά εργαλείο (τοίχος / γραμμή). */
  readonly config: RingConfig;
  /** Scene-units του ενεργού level (mm→scene conversion για το lock μήκους). */
  readonly sceneUnits: SceneUnits;
  /** Κλειδί επανα-αρχικοποίησης: αλλάζει σε νέο segment (αρχή τοίχου / 1ο σημείο γραμμής). */
  readonly startKey: string;
  /** Draw-time getter του canvas element — βελάκι cursor πάνω στα wedges + synthetic mousemove. */
  readonly getCanvasEl?: () => HTMLCanvasElement | null;
  /**
   * ADR-513 §grip-parity — τρόπος «commit» του δαχτυλιδιού:
   *   · `'canvas-click'` (default, ΣΧΕΔΙΑΣΗ): πληκτρολόγηση → lock → synthetic click στον καμβά
   *     τοποθετεί το σημείο, + window interceptor μπλοκάρει το commit πάνω στα wedges.
   *   · `'lock-only'` (ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ / press-drag): πληκτρολόγηση → **μόνο** lock· το πραγματικό
   *     «άφημα» του ποντικιού κάνει το commit (grip mouseup). ΚΑΝΕΝΑ synthetic click, ΚΑΝΕΝΑ
   *     μπλοκάρισμα του mouseup — αλλιώς θα κοβόταν το commit του grip.
   */
  readonly placementMode?: 'canvas-click' | 'lock-only';
  /** ADR-513 §grip-parity — κλήση στο unmount (lock-only): καθάρισε το lock ώστε το επόμενο drag να ξεκινά ελεύθερο. */
  readonly onDeactivate?: () => void;
}

export function RadialCommandRing({
  config,
  sceneUnits,
  startKey,
  getCanvasEl,
  placementMode = 'canvas-click',
  onDeactivate,
}: RadialCommandRingProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const { displayUnit } = useDisplayUnit();
  const colors = useSemanticColors();

  // Re-render σε κάθε αλλαγή των stores που τρέφουν highlight/seed (lock / overrides / linetype).
  // Χαμηλή συχνότητα (αλλάζουν σε ενέργεια χρήστη, όχι ανά frame) — ο high-freq κέρσορας πάει από window mousemove.
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => config.subscribe(forceRender), [config]);

  const unitCtx: RingUnitContext = useMemo(() => ({ displayUnit, sceneUnits }), [displayUnit, sceneUnits]);

  // ADR-513 §equal-slices — ο κύκλος χωρίζεται σε ΤΟΣΕΣ ΙΣΕΣ φέτες όσα τα πεδία (2→ημικύκλια, 3→120°,
  // 4→cardinal). Το πεδίο index i παίρνει τη φέτα `slices[i]` (SSoT `computeRingSlices`).
  const slices = useMemo(() => computeRingSlices(config.fields.length), [config.fields.length]);
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
  // Όσο τοποθετούμε σημείο μέσω synthetic mouse events, ο window interceptor κάνει early-return
  // ώστε τα synthetic events να περάσουν στον καμβά (αντί να μπλοκαριστούν ως κλικ σε wedge).
  const placingRef = useRef(false);
  const [cursor, setCursor] = useState<Point2D | null>(null);
  const [center, setCenter] = useState<Point2D | null>(null);
  const [zone, setZone] = useState<CursorZone>('inside');
  const [hovered, setHovered] = useState<number | null>(null);
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

  // ADR-513 §direct-distance-entry (AutoCAD heads-up) — με το δαχτυλίδι mounted και ΚΑΝΕΝΑ popup
  // ανοιχτό, ένα ψηφίο/δεκαδικό/πρόσημο ΑΝΟΙΓΕΙ αυτόματα το «Μήκος» με seed το πλήκτρο (το 1ο ψηφίο
  // αντικαθιστά). Capture-phase + stopPropagation → κερδίζει τα υπόλοιπα keyboard listeners. Δεν
  // κλέβει πληκτρολόγηση από άλλο editable element (ribbon combobox κ.λπ.).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (openField !== null) return; // popup ανοιχτό → το input χειρίζεται την πληκτρολόγηση
      if (!isHeadsUpNumericKey(e)) return;
      if (isEditableTarget(typeof document !== 'undefined' ? document.activeElement : null)) return;
      const lengthField = fieldByKey.get('length');
      if (!lengthField || lengthField.kind !== 'numeric') return; // δεν υπάρχει «Μήκος» → no-op
      e.preventDefault();
      e.stopPropagation();
      setOpenField('length');
      setDraft(e.key);
      setTimeout(() => { inputRef.current?.focus(); }, 0);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [fieldByKey, openField]);

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
      ? sliceIndexAtAngle((Math.atan2(cursor.y - c.y, cursor.x - c.x) * 180) / Math.PI, config.fields.length)
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
  }, [cursor, getCanvasEl, config.fields.length]);

  // Καθάρισε crosshair-suppression + επανάφερε το αρχικό cursor όταν φεύγει το δαχτυλίδι.
  // ADR-513 §grip-parity — `onDeactivate` (lock-only) ξεκλειδώνει το length/angle στο unmount
  // (= τέλος grip drag), ώστε το επόμενο drag να ξεκινά ελεύθερο (μηδέν stale lock).
  useEffect(() => () => {
    setCrosshairSuppressed(false);
    const el = getCanvasEl?.();
    if (el && canvasCursorRef.current !== null) {
      el.style.cursor = canvasCursorRef.current;
      canvasCursorRef.current = null;
    }
    onDeactivate?.();
  }, [getCanvasEl, onDeactivate]);

  /** Synthetic mousemove στον καμβά → άμεσο rebuild του ghost μετά από lock/override/τύπο. */
  const pokeCanvas = useCallback(() => {
    const canvasEl = getCanvasEl?.();
    const cur = cursorRef.current;
    if (canvasEl && cur) {
      canvasEl.dispatchEvent(new MouseEvent('mousemove', { clientX: cur.x, clientY: cur.y, bubbles: true }));
    }
  }, [getCanvasEl]);

  // Άνοιξε πεδίο από το κλειδί του (SSoT: numeric → seed+focus· select → dropdown λίστα). Ενοποιεί
  // την «άνοιγμα φέτας» (index) ΚΑΙ το Tab-advance (key) — μηδέν διπλότυπη λογική ανοίγματος.
  const openFieldForKey = useCallback((key: string) => {
    const field = fieldByKey.get(key);
    if (!field) return; // άγνωστο κλειδί → no-op
    setOpenField(field.key);
    if (field.kind === 'numeric') {
      setDraft(field.seed(unitCtx));
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [fieldByKey, unitCtx]);

  // ADR-513 §multi-field-lock — SSoT «κλείδωσε το τρέχον αριθμητικό πεδίο» ΧΩΡΙΣ να κλείσει το popup.
  // Το μοιράζονται Enter (commit-all), Tab (lock-and-advance) και το switch φέτας. `true` μόνο σε
  // επιτυχές lock (έγκυρη έκφραση). Ο caller δίνει το raw string (React `draft` ή DOM `input.value`).
  const lockOpenNumericRaw = useCallback((raw: string): boolean => {
    if (!openField) return false;
    const field = fieldByKey.get(openField);
    if (field?.kind !== 'numeric' || !field.commitNumeric) return false;
    const num = evalExpr(raw.replace(/,/g, '.'));
    if (num === null) return false;
    field.commitNumeric(num, unitCtx);
    pokeCanvas();
    return true;
  }, [openField, fieldByKey, unitCtx, pokeCanvas]);

  const openWedge = useCallback((index: number) => {
    const field = config.fields[index];
    if (!field) return; // εκτός εύρους → no-op
    // ADR-513 §multi-field-lock — αν υπάρχει ήδη ανοιχτό αριθμητικό πεδίο, κλείδωσέ το ΠΡΩΤΑ (διάβασε το
    // draft από το DOM ώστε να ΜΗΝ μπει `draft` dep στο window-intercept effect) → δεν χάνεται η τιμή.
    lockOpenNumericRaw(inputRef.current?.value ?? '');
    openFieldForKey(field.key);
  }, [config, lockOpenNumericRaw, openFieldForKey]);

  // Όσο ο κέρσορας είναι ΠΑΝΩ στα wedges (inside) είναι `pointer-events-none` (ώστε ο καμβάς να
  // συνεχίζει να δέχεται mousemove). Άρα το κλικ σε wedge το πιάνουμε εδώ (window capture) ΚΑΙ
  // μπλοκάρουμε το commit. Κλικ έξω από τα wedges (annulus) → περνά κανονικά = commit.
  useEffect(() => {
    const intercept = (e: MouseEvent) => {
      if (placingRef.current) return; // synthetic placement events → άφησέ τα να φτάσουν στον καμβά
      if (popupRef.current?.contains(e.target as Node)) return; // popup: άφησέ το (stopPropagation στο popup div κόβει το bubbling στους canvas handlers)
      const c = centerRef.current;
      const cur = cursorRef.current;
      if (!c || !cur) return;
      const d = Math.hypot(cur.x - c.x, cur.y - c.y);
      if (cursorZone(d) !== 'inside') return; // annulus/outside → άφησε το commit
      // ADR-513 §grip-parity — lock-only (press-drag άκρου): μπλοκάρουμε ΜΟΝΟ για να ΑΝΟΙΞΟΥΜΕ φέτα
      // (mousedown) ή όσο ένα popup είναι ήδη ανοιχτό. ΠΟΤΕ δεν «τρώμε» ένα σκέτο release πάνω σε φέτα —
      // αυτό το release είναι το commit του grip (αλλιώς κόβεται η επέκταση άκρου). Στη ΣΧΕΔΙΑΣΗ
      // (canvas-click) μπλοκάρουμε όλα τα inside events όπως πριν (το synthetic click κάνει το commit).
      if (placementMode === 'lock-only' && e.type !== 'mousedown' && openField === null) return;
      if (e.type === 'mousedown') {
        openWedge(sliceIndexAtAngle((Math.atan2(cur.y - c.y, cur.x - c.x) * 180) / Math.PI, config.fields.length));
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
  }, [openWedge, placementMode, openField, config.fields.length]);

  // Επιστρέφει `true` ΜΟΝΟ όταν όντως κλειδώθηκε αριθμητική τιμή (έγκυρη έκφραση) — ώστε το
  // Enter να τοποθετεί σημείο μόνο σε επιτυχές commit (όχι σε άκυρη/κενή είσοδο).
  const commitNumericOpen = useCallback((): boolean => {
    // Δέξου ΚΑΙ κόμμα ΚΑΙ τελεία ως δεκαδικό (0,25 ≡ 0.25) — μέσω του κοινού `lockOpenNumericRaw`.
    const committed = lockOpenNumericRaw(draft);
    setOpenField(null);
    return committed;
  }, [lockOpenNumericRaw, draft]);

  // ADR-513 §direct-distance-entry — tool-agnostic τοποθέτηση: dispatch πραγματικού click sequence
  // (mousedown→mouseup, button 0) στον καμβά στις τρέχουσες client συντεταγμένες, ώστε το ενεργό
  // εργαλείο (γραμμή/τοίχος/δοκός) να τοποθετήσει το endpoint μέσω του ΚΑΝΟΝΙΚΟΥ του click pipeline
  // (το `applyLengthAngleLock` περιορίζει το σημείο στο κλειδωμένο μήκος → preview ≡ commit). Η
  // τοποθέτηση συμβαίνει στο mouseup (`mouse-handler-up.ts`). Μετά → one-shot reset του field (Μήκος).
  const placeAtCursor = useCallback((placedField: RingFieldDef | null) => {
    const canvasEl = getCanvasEl?.();
    const cur = cursorRef.current;
    if (canvasEl && cur) {
      placingRef.current = true;
      try {
        const init: MouseEventInit = { clientX: cur.x, clientY: cur.y, button: 0, bubbles: true };
        canvasEl.dispatchEvent(new MouseEvent('mousedown', init));
        canvasEl.dispatchEvent(new MouseEvent('mouseup', init));
      } finally {
        placingRef.current = false;
      }
    }
    // AutoCAD: το κλειδωμένο μήκος «μιας βολής» καθαρίζει ΜΕΤΑ την τοποθέτηση (SSoT: field owns reset).
    placedField?.clearOnPlace?.();
  }, [getCanvasEl]);

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
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Κράτα το field ΠΡΙΝ το commit (το commitNumericOpen κλείνει το popup) → σωστό one-shot reset.
      const placedField = openField ? fieldByKey.get(openField) ?? null : null;
      // ADR-513 §grip-parity — lock-only (press-drag): Enter → ΜΟΝΟ lock (το ghost ανανεώνεται μέσω
      // pokeCanvas στο commitNumericOpen)· το commit το κάνει το «άφημα» του ποντικιού, ΟΧΙ synthetic click.
      if (commitNumericOpen() && placementMode === 'canvas-click') placeAtCursor(placedField);
      return;
    }
    // ADR-513 §multi-field-lock — Tab = lock-and-advance: κλείδωσε το τρέχον draft (ΧΩΡΙΣ τοποθέτηση) και
    // άνοιξε το ΕΠΟΜΕΝΟ πεδίο στη σειρά του config (cycle· Shift+Tab ανάποδα). Το commit-all μένει στο Enter.
    if (e.key === 'Tab' && openField) {
      e.preventDefault();
      e.stopPropagation();
      lockOpenNumericRaw(draft);
      const nextKey = nextFieldKeyInOrder(config.fields.map((f) => f.key), openField, e.shiftKey);
      if (nextKey) openFieldForKey(nextKey);
    }
  }, [openField, fieldByKey, draft, placementMode, commitNumericOpen, placeAtCursor, lockOpenNumericRaw, config, openFieldForKey]);

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
  const openFieldIndex = openField ? config.fields.findIndex((f) => f.key === openField) : -1;
  const openFieldDef = openFieldIndex >= 0 ? config.fields[openFieldIndex] : null;
  const popupAnchor = openFieldDef
    ? polarPoint(cc, cc, RING_INNER_R * 0.62, slices[openFieldIndex].centerDeg)
    : null;

  return (
    <section
      aria-label={t(config.ariaLabelKey)}
      className={`fixed -translate-x-1/2 -translate-y-1/2 ${PANEL_LAYOUT.POINTER_EVENTS.NONE} ${colors.text.WHITE}`}
      style={boxStyle(center.x, center.y, box)}
    >
      {showWedges && (
        <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className={`absolute ${PANEL_LAYOUT.INSET['0']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}`}>
          {config.fields.map((field, i) => {
            const { a0, a1 } = slices[i];
            const active = hovered === i || openField === field.key || field.isLocked();
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
          {config.fields.map((field, i) => {
            const a = polarPoint(cc, cc, RING_INNER_R * 0.6, slices[i].centerDeg);
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
          // ADR-513 §grip-parity-hotgrip — το popup είναι DOM-παιδί του καμβά/container: χωρίς αυτό, ένα
          // mousedown/mouseup/click ΠΑΝΩ στο popup ανεβαίνει (bubbles) στον `handleContainerMouseUp` →
          // κάνει commit το ενεργό grip (hot-grip terminal) → ο τροχός ξε-mountάρεται κι ΚΛΕΙΝΕΙ ΤΟ ΠΕΔΙΟ
          // στην ΠΡΩΤΗ πληκτρολόγηση. Σταματάμε το propagation ώστε η αλληλεπίδραση με το πεδίο να μη φτάνει
          // ΠΟΤΕ στους canvas handlers (το input κρατά focus/keydown/change κανονικά).
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
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

// ADR-513 — heads-up predicate re-exported ώστε ο import path των tests (`radial-ring-headsup.test`)
// να μείνει σταθερός μετά το file-size split (N.7.1, 2026-07-06).
export { isHeadsUpNumericKey };
