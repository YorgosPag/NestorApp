'use client';

/**
 * ADR-404 Phase 5c — Pure SSoT για την κλίση/ρύση (slope) της πλάκας στο ribbon.
 *
 * Η πλάκα διαφέρει από κολώνα/τοίχο σε **δύο invariants** (ADR-369 §9 Q7):
 *   1. `geometryType:'box'|'tilted'` discriminator — το toggle αλλάζει ΚΑΙ τα δύο
 *      (slope required iff `'tilted'`, Zod-enforced). Ζει στο ΕΝΑ SSoT `withSlabSlope`
 *      (reuse· ΟΧΙ inline coupling εδώ — μάθημα τοίχου `isWallTiltAngleActive`).
 *   2. `SlabSlope.angle` = **ποσοστό %** (όχι μοίρες). Η μονάδα εμφάνισης
 *      (%/μοίρες/λόγος) είναι ribbon pref (`slab-slope-unit`)· stored ΠΑΝΤΑ %.
 *
 * Πλήρης ευελιξία (Giorgio): 5 πεδία — on/off + μονάδα + τιμή + φορά (`direction°`
 * ελεύθερη) + άξονας (`pivotEdge`). Διπλό target (mirror wall-tilt-param, ΟΧΙ νέα
 * εντολή):
 *   - selected `SlabEntity` → `dispatchParams` (`UpdateSlabParamsCommand`, ένα undo)
 *   - drawing-mode (no selection, tool active) → `slabToolBridgeStore` overrides
 *     ώστε η επόμενη πλάκα να γεννιέται ήδη κεκλιμένη (`buildDefaultSlabParams`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 5c
 */

import type { SlabEntity, SlabParams, SlabSlope } from '../../../../bim/types/slab-types';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';
// SSoT geometryType↔slope invariant — reuse σε gizmo + ribbon (μηδέν διπλό coupling).
import { withSlabSlope } from '../../../../bim/geometry/slab-slope';
// SSoT angle-normalize [0,360) — reuse (rotation/mirror-math το χρησιμοποιούν), ΟΧΙ νέο local.
import { normalizeAngleDeg } from '../../../../rendering/entities/shared/geometry-utils';
import { SLAB_RIBBON_KEYS } from './slab-command-keys';
import { slabToolBridgeStore } from './slab-tool-bridge-store';
import {
  isSlabSlopeUnit,
  slabSlopeUnitStore,
  slopeDisplayToPercent,
  slopePercentToDisplay,
  type SlabSlopeUnit,
} from './slab-slope-unit';

// ─── Option-value sentinels (SSoT — reused από το contextual-slab-tab) ─────────

export const SLOPE_ENABLED_ON = 'on';
export const SLOPE_ENABLED_OFF = 'off';

/** pivotEdge values (mirror του `SlabSlope.pivotEdge` union). */
export const SLOPE_PIVOT_VALUES = ['center', 'N', 'S', 'E', 'W'] as const;
type SlopePivot = SlabSlope['pivotEdge'];

const PIVOT_SET: ReadonlySet<string> = new Set<string>(SLOPE_PIVOT_VALUES);

/** Default κλίση όταν ενεργοποιείται από μηδέν: 2% ρύση (drainage standard), προς +X, γύρω από το κέντρο. */
const DEFAULT_SLAB_SLOPE: SlabSlope = { direction: 0, angle: 2, pivotEdge: 'center' };

// ─── Pure core: read/derive combobox value από `SlabSlope | undefined` ────────

function readEnabledValue(slope: SlabSlope | undefined): string {
  return slope ? SLOPE_ENABLED_ON : SLOPE_ENABLED_OFF;
}

function readDirectionValue(slope: SlabSlope | undefined): string {
  return String(Math.round(slope?.direction ?? DEFAULT_SLAB_SLOPE.direction));
}

function readPivotValue(slope: SlabSlope | undefined): string {
  return slope?.pivotEdge ?? 'center';
}

/**
 * Διαβάζει την τιμή του combobox για ένα slope key. Η `unit` περνά ως παράμετρος
 * (pure-given-unit → reactive read στο bridge μέσω `useSyncExternalStore`, ΟΧΙ
 * κρυφό store-read που θα εμπόδιζε το re-format του πεδίου «Τιμή»).
 */
function readSlopeField(commandKey: string, slope: SlabSlope | undefined, unit: SlabSlopeUnit): string | null {
  if (commandKey === SLAB_RIBBON_KEYS.slope.unit) return unit;
  if (commandKey === SLAB_RIBBON_KEYS.slope.enabled) return readEnabledValue(slope);
  if (commandKey === SLAB_RIBBON_KEYS.slope.angle) return slopePercentToDisplay(slope?.angle ?? 0, unit);
  if (commandKey === SLAB_RIBBON_KEYS.slope.direction) return readDirectionValue(slope);
  if (commandKey === SLAB_RIBBON_KEYS.slope.pivot) return readPivotValue(slope);
  return null;
}

/**
 * Παράγει το επόμενο `SlabSlope | null` από μία αλλαγή combobox (`null` = επίπεδη
 * → box). Επιστρέφει `{ next }` ή `null` (άκυρη/μη-slope key — δεν αγγίζει την πλάκα).
 * Το `unit` key ΔΕΝ φτάνει εδώ (το χειρίζεται ο caller — display pref, μηδέν geometry).
 */
function nextSlopeFor(
  commandKey: string,
  value: string,
  slope: SlabSlope | undefined,
): { readonly next: SlabSlope | null } | null {
  const base = slope ?? DEFAULT_SLAB_SLOPE;
  if (commandKey === SLAB_RIBBON_KEYS.slope.enabled) {
    if (value === SLOPE_ENABLED_ON) return { next: slope ?? DEFAULT_SLAB_SLOPE };
    if (value === SLOPE_ENABLED_OFF) return { next: null };
    return null;
  }
  if (commandKey === SLAB_RIBBON_KEYS.slope.angle) {
    const pct = slopeDisplayToPercent(value, slabSlopeUnitStore.get());
    // ≤0 / άκυρο → επίπεδη (mirror gizmo «near-flat → box»).
    return pct === null ? { next: null } : { next: { ...base, angle: pct } };
  }
  if (commandKey === SLAB_RIBBON_KEYS.slope.direction) {
    const dir = Number.parseFloat(value);
    if (!Number.isFinite(dir)) return null;
    return { next: { ...base, direction: normalizeAngleDeg(dir) } };
  }
  if (commandKey === SLAB_RIBBON_KEYS.slope.pivot) {
    if (!PIVOT_SET.has(value)) return null;
    return { next: { ...base, pivotEdge: value as SlopePivot } };
  }
  return null;
}

// ─── Bridge adapters (selected entity + drawing-mode handle) ──────────────────

/**
 * Resolve το combobox state ενός slope key. `unit` → πάντα (display pref, παρέχεται
 * από τον caller για reactivity). Αλλιώς διαβάζει την επιλεγμένη πλάκα πρώτα·
 * fallback στο drawing-tool handle (`overrides.slope`). `null` αν κανένα ενεργό.
 */
export function resolveSlabSlopeComboboxState(
  commandKey: string,
  slab: SlabEntity | null,
  unit: SlabSlopeUnit,
): RibbonComboboxState | null {
  if (commandKey === SLAB_RIBBON_KEYS.slope.unit) {
    return { value: unit, options: [] };
  }
  if (slab) {
    const v = readSlopeField(commandKey, slab.params.slope, unit);
    return v === null ? null : { value: v, options: [] };
  }
  const handle = slabToolBridgeStore.get();
  if (!handle || !handle.isActive) return null;
  const v = readSlopeField(commandKey, handle.overrides.slope, unit);
  return v === null ? null : { value: v, options: [] };
}

/**
 * Εφαρμόζει αλλαγή combobox για ένα slope key. `unit` → ribbon pref store (μηδέν
 * geometry mutation). Αλλιώς γράφει την επιλεγμένη πλάκα μέσω `dispatchParams`
 * (`UpdateSlabParamsCommand` + `withSlabSlope` invariant), ή το drawing-tool handle
 * (overrides) όταν δεν υπάρχει επιλογή. No-op σε άκυρη/μη-slope key.
 */
export function applySlabSlopeComboboxChange(
  commandKey: string,
  value: string,
  slab: SlabEntity | null,
  dispatchParams: (slab: SlabEntity, next: SlabParams) => void,
): void {
  if (commandKey === SLAB_RIBBON_KEYS.slope.unit) {
    if (isSlabSlopeUnit(value)) slabSlopeUnitStore.set(value);
    return;
  }
  if (slab) {
    const result = nextSlopeFor(commandKey, value, slab.params.slope);
    if (!result) return;
    dispatchParams(slab, withSlabSlope(slab.params, result.next));
    return;
  }
  const handle = slabToolBridgeStore.get();
  if (!handle || !handle.isActive) return;
  const result = nextSlopeFor(commandKey, value, handle.overrides.slope);
  if (!result) return;
  const nextOverrides = withSlabSlope(handle.overrides, result.next);
  handle.setParamOverrides({
    geometryType: nextOverrides.geometryType,
    slope: nextOverrides.slope,
  });
}
