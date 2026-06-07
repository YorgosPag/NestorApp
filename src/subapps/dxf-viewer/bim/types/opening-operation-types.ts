/**
 * Opening Operation Type SSoT (ADR-421 §A1).
 *
 * Ρητός μηχανισμός λειτουργίας ανά κούφωμα, χαρτογραφημένος 1:1 στα buildingSMART
 * IFC4 enumerations ώστε το IFC export να δηλώνει σωστά ΠΩΣ ανοίγει κάθε κούφωμα
 * (Revit-grade openBIM). Στο IFC το «είδος» δεν είναι ένα enum — είναι **operation**
 * (πώς ανοίγει) + **partitioning** (διάταξη φύλλων). Ένα Nestor `OpeningKind`
 * αντιστοιχεί σε έναν συνδυασμό· αυτό το module ορίζει τα enums + τον default
 * χάρτη `kind → operation`.
 *
 * Πηγές (verbatim από buildingSMART IFC4):
 *   - IfcDoorTypeOperationEnum (20 τιμές)
 *   - IfcWindowPanelOperationEnum (14 τιμές)
 *   - IfcWindowTypePartitioningEnum (11 τιμές)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md §2.2, §A1
 */

import type { OpeningKind, OpeningHanding } from './opening-types';

// ─── IfcDoorTypeOperationEnum (20) ───────────────────────────────────────────

/** Door panel operation, mirror του IfcDoorTypeOperationEnum (IFC4). */
export const IFC_DOOR_OPERATION_VALUES = [
  'SINGLE_SWING_LEFT',
  'SINGLE_SWING_RIGHT',
  'DOUBLE_DOOR_SINGLE_SWING',
  'DOUBLE_DOOR_SINGLE_SWING_OPPOSITE_LEFT',
  'DOUBLE_DOOR_SINGLE_SWING_OPPOSITE_RIGHT',
  'DOUBLE_SWING_LEFT',
  'DOUBLE_SWING_RIGHT',
  'DOUBLE_DOOR_DOUBLE_SWING',
  'SLIDING_TO_LEFT',
  'SLIDING_TO_RIGHT',
  'DOUBLE_DOOR_SLIDING',
  'FOLDING_TO_LEFT',
  'FOLDING_TO_RIGHT',
  'DOUBLE_DOOR_FOLDING',
  'REVOLVING',
  'ROLLINGUP',
  'SWING_FIXED_LEFT',
  'SWING_FIXED_RIGHT',
  'USERDEFINED',
  'NOTDEFINED',
] as const;

export type IfcDoorOperationType = (typeof IFC_DOOR_OPERATION_VALUES)[number];

// ─── IfcWindowPanelOperationEnum (14) ────────────────────────────────────────

/** Window panel operation, mirror του IfcWindowPanelOperationEnum (IFC4). */
export const IFC_WINDOW_OPERATION_VALUES = [
  'SIDEHUNGRIGHTHAND',
  'SIDEHUNGLEFTHAND',
  'TILTANDTURNRIGHTHAND',
  'TILTANDTURNLEFTHAND',
  'TOPHUNG',
  'BOTTOMHUNG',
  'PIVOTHORIZONTAL',
  'PIVOTVERTICAL',
  'SLIDINGHORIZONTAL',
  'SLIDINGVERTICAL',
  'REMOVABLECASEMENT',
  'FIXEDCASEMENT',
  'OTHEROPERATION',
  'NOTDEFINED',
] as const;

export type IfcWindowOperationType = (typeof IFC_WINDOW_OPERATION_VALUES)[number];

// ─── IfcWindowTypePartitioningEnum (11) ──────────────────────────────────────

/** Window panel layout, mirror του IfcWindowTypePartitioningEnum (IFC4). */
export const IFC_WINDOW_PARTITIONING_VALUES = [
  'SINGLE_PANEL',
  'DOUBLE_PANEL_VERTICAL',
  'DOUBLE_PANEL_HORIZONTAL',
  'TRIPLE_PANEL_VERTICAL',
  'TRIPLE_PANEL_BOTTOM',
  'TRIPLE_PANEL_TOP',
  'TRIPLE_PANEL_LEFT',
  'TRIPLE_PANEL_RIGHT',
  'TRIPLE_PANEL_HORIZONTAL',
  'USERDEFINED',
  'NOTDEFINED',
] as const;

export type IfcWindowPartitioning = (typeof IFC_WINDOW_PARTITIONING_VALUES)[number];

// ─── Unified opening operation ───────────────────────────────────────────────

/** Όλες οι έγκυρες τιμές operation (door ∪ window) — για zod enum. */
export const OPENING_OPERATION_VALUES = [
  ...IFC_DOOR_OPERATION_VALUES,
  ...IFC_WINDOW_OPERATION_VALUES,
] as const;

/** Operation discriminator για κάθε κούφωμα (IfcDoor ή IfcWindow operation). */
export type OpeningOperationType = IfcDoorOperationType | IfcWindowOperationType;

// ─── Defaults SSoT ───────────────────────────────────────────────────────────

/**
 * Default operation ανά kind (SSoT). Legacy openings χωρίς `operationType`
 * resolve από εδώ. Οι handed πόρτες (door) επιλέγουν LEFT/RIGHT μέσω
 * {@link resolveOperationType}.
 */
export const DEFAULT_OPERATION_BY_KIND: Readonly<Record<OpeningKind, OpeningOperationType>> = {
  // ─── Doors (IfcDoorTypeOperationEnum) ─────────────────────────────────────
  'door':                 'SINGLE_SWING_LEFT',
  'double-door':          'DOUBLE_DOOR_SINGLE_SWING',
  'french-door':          'DOUBLE_DOOR_SINGLE_SWING',
  'sliding-door':         'SLIDING_TO_LEFT',
  'double-sliding-door':  'DOUBLE_DOOR_SLIDING',
  'pocket-door':          'SLIDING_TO_LEFT',
  'bifold-door':          'FOLDING_TO_LEFT',
  'overhead-door':        'ROLLINGUP',
  'revolving-door':       'REVOLVING',
  // ─── Windows (IfcWindowPanelOperationEnum) ────────────────────────────────
  'window':               'SIDEHUNGRIGHTHAND',
  'fixed':                'FIXEDCASEMENT',
  'double-hung-window':   'SLIDINGVERTICAL',
  'sliding-window':       'SLIDINGHORIZONTAL',
  'awning-window':        'TOPHUNG',
  'hopper-window':        'BOTTOMHUNG',
  'tilt-turn-window':     'TILTANDTURNRIGHTHAND',
  'bay-window':           'SIDEHUNGRIGHTHAND',
};

/**
 * Resolve το operation ενός κουφώματος από `kind` + (προαιρετικό) `handing`.
 * Τα handed kinds επιλέγουν LEFT/RIGHT variant· όλα τα υπόλοιπα επιστρέφουν το
 * default του kind (idempotent, side-effect free). Revit-grade: η φορά (hinge
 * side / slide direction / fold direction) χαρτογραφείται στο σωστό IFC4 enum.
 */
export function resolveOperationType(
  kind: OpeningKind,
  handing?: OpeningHanding,
): OpeningOperationType {
  const isRight = handing === 'right';
  const isLeft = handing === 'left';
  switch (kind) {
    case 'door':
      return isRight ? 'SINGLE_SWING_RIGHT' : 'SINGLE_SWING_LEFT';
    case 'sliding-door':
    case 'pocket-door':
      return isRight ? 'SLIDING_TO_RIGHT' : 'SLIDING_TO_LEFT';
    case 'bifold-door':
      return isRight ? 'FOLDING_TO_RIGHT' : 'FOLDING_TO_LEFT';
    case 'tilt-turn-window':
      return isLeft ? 'TILTANDTURNLEFTHAND' : 'TILTANDTURNRIGHTHAND';
    default:
      return DEFAULT_OPERATION_BY_KIND[kind];
  }
}
