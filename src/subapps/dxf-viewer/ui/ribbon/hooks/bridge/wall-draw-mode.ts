/**
 * ADR-565 §12 / Φ1.x — Wall «Draw gallery» mode registry (Revit «Modify | Place Wall» Draw panel).
 *
 * ΕΝΑ SSoT για τους 6 τρόπους σχεδίασης τοίχου που εκθέτει η on-screen options bar:
 *   Ευθύς · Καμπύλος (3-σημείων / κέντρο–άκρα / αρχή–τέλος–ακτίνα / εφαπτομενικό) · Πολυγραμμή.
 *
 * Καταναλώνεται από:
 *   - `RibbonWallDrawModeWidget` (render + active-highlight → καλεί απευθείας το drawing handle),
 *   - colocated tests.
 *
 * Mirror του ADR-521 `COLUMN_DRAW_KINDS` (canonical, ordered λίστα των σχεδιάσιμων modes). Ο widget
 * γράφει απευθείας στο `wallToolBridgeStore` handle (όπως `RibbonWallJoinWidget`) — ΟΧΙ action string
 * routing — οπότε εδώ ΔΕΝ υπάρχει `wall.drawMode:` parser (θα ήταν dead code, CHECK 3.22).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-565-curved-circular-structural-bim-elements.md §11 §12
 */

import type { WallArcVariant, WallKind } from '../../../../bim/types/wall-types';

/** Ένας τρόπος σχεδίασης τοίχου (Draw gallery entry). */
export interface WallDrawMode {
  /** Σταθερό id — μέρος του action `wall.drawMode:<id>` + React key. */
  readonly id: string;
  /** Το `WallKind` που θέτει η επιλογή. */
  readonly kind: WallKind;
  /** Το arc variant (μόνο όταν `kind === 'curved'`). `undefined` σε straight/polyline. */
  readonly arcVariant?: WallArcVariant;
  /** i18n label key (N.11). */
  readonly labelKey: string;
  /** i18n tooltip key (N.11). */
  readonly tooltipKey: string;
}

/**
 * Οι 6 τρόποι σχεδίασης, στη σειρά που εμφανίζονται στη μπάρα (Revit Draw gallery order:
 * ευθεία → τόξα → πολυγραμμή).
 */
export const WALL_DRAW_MODES: readonly WallDrawMode[] = [
  {
    id: 'straight',
    kind: 'straight',
    labelKey: 'ribbon.commands.wallEditor.drawMode.straight.label',
    tooltipKey: 'ribbon.commands.wallEditor.drawMode.straight.tooltip',
  },
  {
    id: 'arc-3-point',
    kind: 'curved',
    arcVariant: '3-point',
    labelKey: 'ribbon.commands.wallEditor.drawMode.arc3Point.label',
    tooltipKey: 'ribbon.commands.wallEditor.drawMode.arc3Point.tooltip',
  },
  {
    id: 'arc-center-ends',
    kind: 'curved',
    arcVariant: 'center-ends',
    labelKey: 'ribbon.commands.wallEditor.drawMode.arcCenterEnds.label',
    tooltipKey: 'ribbon.commands.wallEditor.drawMode.arcCenterEnds.tooltip',
  },
  {
    id: 'arc-start-end-radius',
    kind: 'curved',
    arcVariant: 'start-end-radius',
    labelKey: 'ribbon.commands.wallEditor.drawMode.arcStartEndRadius.label',
    tooltipKey: 'ribbon.commands.wallEditor.drawMode.arcStartEndRadius.tooltip',
  },
  {
    id: 'arc-tangent',
    kind: 'curved',
    arcVariant: 'tangent',
    labelKey: 'ribbon.commands.wallEditor.drawMode.arcTangent.label',
    tooltipKey: 'ribbon.commands.wallEditor.drawMode.arcTangent.tooltip',
  },
  {
    id: 'polyline',
    kind: 'polyline',
    labelKey: 'ribbon.commands.wallEditor.drawMode.polyline.label',
    tooltipKey: 'ribbon.commands.wallEditor.drawMode.polyline.tooltip',
  },
] as const;

/**
 * Το id του **ενεργού** draw-mode δεδομένου του τρέχοντος `kind` + `arcVariant` του εργαλείου
 * (για το active-highlight της μπάρας). Straight/polyline → match by kind· curved → match by
 * arcVariant. Fallback στο πρώτο mode (defensive· δεν πρέπει να συμβεί).
 */
export function activeWallDrawModeId(kind: WallKind, arcVariant: WallArcVariant): string {
  const match = WALL_DRAW_MODES.find((m) =>
    m.kind === kind && (m.kind !== 'curved' || m.arcVariant === arcVariant),
  );
  return (match ?? WALL_DRAW_MODES[0]).id;
}
