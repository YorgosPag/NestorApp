'use client';

/**
 * ADR-404 Phase 5b — Pure SSoT για την κλίση (tilt) του τοίχου στο ribbon.
 *
 * Ο τοίχος είναι **1-DOF** (`WallTilt {angle}` signed — SSoT `bim/geometry/wall-tilt.ts`):
 * lean ⟂ στη φορά `start → end`, το **πρόσημο** της γωνίας επιλέγει πλευρά. Στο UI το
 * εκφράζουμε ως **μέγεθος** (`tiltAngle`, 0..80°) + **πλευρά** (`tiltSide`, Αριστερά/Δεξιά)
 * αντί για ένα signed πεδίο — Giorgio's choice (πιο σαφές οπτικά). Το stored `tilt.angle`
 * μένει το ΕΝΑ signed SSoT· εδώ γίνεται μόνο η αμφίδρομη μετάφραση.
 *
 *   Αριστερά (left)  → **θετική** γωνία → κορυφή προς την αριστερή κάθετη της φοράς start→end
 *   Δεξιά   (right)  → **αρνητική** γωνία → αντίθετη πλευρά
 *
 * Διπλό target (mirror column combobox-resolvers, ΟΧΙ νέα εντολή):
 *   - selected `WallEntity` → `dispatchParams` (`UpdateWallParamsCommand`, ένα undo)
 *   - drawing-mode (no selection, tool active) → `wallToolBridgeStore` overrides ώστε ο
 *     επόμενος τοίχος να γεννιέται ήδη κεκλιμένος (`buildDefaultWallParams`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-404-3d-bim-element-tilt.md §Phase 5b
 */

import type { WallEntity, WallParams, WallTilt } from '../../../../bim/types/wall-types';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';
// SSoT «τι σημαίνει ενεργή κλίση» (ADR-404) — reuse, μηδέν διπλή σύγκριση angle≠0.
import { isWallTiltAngleActive } from '../../../../bim/geometry/wall-tilt';
import { WALL_RIBBON_KEYS } from './wall-command-keys';
import { wallToolBridgeStore } from './wall-tool-bridge-store';

// ─── Option-value sentinels (SSoT — reused από το contextual-wall-tab) ────────

export const TILT_ENABLED_ON = 'on';
export const TILT_ENABLED_OFF = 'off';
export const TILT_SIDE_LEFT = 'left';
export const TILT_SIDE_RIGHT = 'right';

/** Όριο γωνίας (μοίρες) — ταυτό με το ribbon numericInput {min:0, max:80}. */
const TILT_ANGLE_MAX_DEG = 80;

// ─── Pure core: signed `WallTilt` ↔ {enabled, side, magnitude} ────────────────

function readAngle(tilt: WallTilt | undefined): number {
  return tilt?.angle ?? 0;
}

/** on όταν υπάρχει tilt με μη-μηδενική γωνία (reuse SSoT `isWallTiltAngleActive`). */
function readEnabledValue(tilt: WallTilt | undefined): string {
  return isWallTiltAngleActive(tilt) ? TILT_ENABLED_ON : TILT_ENABLED_OFF;
}

/** Πλευρά από το πρόσημο· angle ≥ 0 → Αριστερά (default), angle < 0 → Δεξιά. */
function readSideValue(tilt: WallTilt | undefined): string {
  return readAngle(tilt) < 0 ? TILT_SIDE_RIGHT : TILT_SIDE_LEFT;
}

/** Μέγεθος γωνίας (unsigned, στρογγυλεμένο) ως string για το combobox. */
function readMagnitudeValue(tilt: WallTilt | undefined): string {
  return String(Math.round(Math.abs(readAngle(tilt))));
}

/** Διαβάζει την τιμή του combobox για ένα tilt key από το δεδομένο `tilt`. */
function readTiltField(commandKey: string, tilt: WallTilt | undefined): string | null {
  if (commandKey === WALL_RIBBON_KEYS.tilt.enabled) return readEnabledValue(tilt);
  if (commandKey === WALL_RIBBON_KEYS.tilt.side) return readSideValue(tilt);
  if (commandKey === WALL_RIBBON_KEYS.tilt.angle) return readMagnitudeValue(tilt);
  return null;
}

/**
 * Παράγει το επόμενο `WallTilt | undefined` από μία αλλαγή combobox. Επιστρέφει
 * `{ next }` (μπορεί να είναι `undefined` = κατακόρυφος) ή `null` (άκυρη/μη-tilt key).
 */
function nextTiltFor(
  commandKey: string,
  value: string,
  tilt: WallTilt | undefined,
): { readonly next: WallTilt | undefined } | null {
  if (commandKey === WALL_RIBBON_KEYS.tilt.enabled) {
    if (value === TILT_ENABLED_ON) return { next: tilt ?? { angle: 0 } };
    if (value === TILT_ENABLED_OFF) return { next: undefined };
    return null;
  }
  if (commandKey === WALL_RIBBON_KEYS.tilt.side) {
    if (value !== TILT_SIDE_LEFT && value !== TILT_SIDE_RIGHT) return null;
    const sign = value === TILT_SIDE_RIGHT ? -1 : 1;
    return { next: { angle: sign * Math.abs(readAngle(tilt)) } };
  }
  if (commandKey === WALL_RIBBON_KEYS.tilt.angle) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    const magnitude = Math.min(Math.abs(parsed), TILT_ANGLE_MAX_DEG);
    const sign = readAngle(tilt) < 0 ? -1 : 1;
    return { next: { angle: sign * magnitude } };
  }
  return null;
}

// ─── Bridge adapters (selected entity + drawing-mode handle) ──────────────────

/**
 * Resolve το combobox state ενός tilt key. Διαβάζει τον επιλεγμένο τοίχο πρώτα·
 * fallback στο drawing-tool handle (overrides.tilt). `null` αν κανένα ενεργό.
 */
export function resolveWallTiltComboboxState(
  commandKey: string,
  wall: WallEntity | null,
): RibbonComboboxState | null {
  if (wall) {
    const v = readTiltField(commandKey, wall.params.tilt);
    return v === null ? null : { value: v, options: [] };
  }
  const handle = wallToolBridgeStore.get();
  if (!handle || !handle.isActive) return null;
  const v = readTiltField(commandKey, handle.overrides.tilt);
  return v === null ? null : { value: v, options: [] };
}

/**
 * Εφαρμόζει αλλαγή combobox για ένα tilt key. Γράφει τον επιλεγμένο τοίχο μέσω
 * `dispatchParams` (ίδια `UpdateWallParamsCommand`), ή το drawing-tool handle
 * (overrides) όταν δεν υπάρχει επιλογή. No-op σε άκυρη/μη-tilt key.
 */
export function applyWallTiltComboboxChange(
  commandKey: string,
  value: string,
  wall: WallEntity | null,
  dispatchParams: (wall: WallEntity, next: WallParams) => void,
): void {
  if (wall) {
    const result = nextTiltFor(commandKey, value, wall.params.tilt);
    if (!result) return;
    dispatchParams(wall, { ...wall.params, tilt: result.next });
    return;
  }
  const handle = wallToolBridgeStore.get();
  if (!handle || !handle.isActive) return;
  const result = nextTiltFor(commandKey, value, handle.overrides.tilt);
  if (!result) return;
  handle.setParamOverrides({ tilt: result.next });
}
