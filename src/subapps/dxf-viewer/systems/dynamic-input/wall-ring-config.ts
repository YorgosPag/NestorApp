/**
 * ADR-513 — «Δαχτυλίδι Εντολών» διάταξη του ΤΟΙΧΟΥ: Μήκος / Γωνία / Πάχος / Ύψος.
 *
 * Μήκος & Γωνία = κοινοί builders (`ring-config.ts`, lock στο `DynamicInputLockStore`).
 * Πάχος & Ύψος = wall-specific numeric overrides μέσω `wallToolBridgeStore.setParamOverrides`
 * (η ΙΔΙΑ λογική που είχε inline το component πριν τη γενίκευση — μηδέν αλλαγή συμπεριφοράς).
 */

import { type DisplayUnit, formatDisplayValue, fromDisplay } from '../../config/units';
import { wallPreviewStore } from '../../bim/walls/wall-preview-store';
import { wallToolBridgeStore } from '../../ui/ribbon/hooks/bridge/wall-tool-bridge-store';
import { resolveWallThicknessMm, type WallParamOverrides } from '../../hooks/drawing/wall-completion';
import { resolveStoreyHeightMm } from '../levels/storey-creation-defaults';
import { DEFAULT_WALL_HEIGHT_MM } from '../../bim/types/wall-types';
import { DynamicInputLockStore } from './DynamicInputLockStore';
import {
  type RingConfig,
  type RingFieldDef,
  type RingUnitContext,
  angleRingField,
  combineSubscribers,
  lengthRingField,
} from './ring-config';

/** Τρέχοντα overrides (bridge → preview fallback) — ίδιο idiom με το πρώην inline `currentOverrides`. */
function currentOverrides(): WallParamOverrides {
  return wallToolBridgeStore.get()?.overrides ?? wallPreviewStore.get().overrides;
}

/** Γράψε ένα override στο bridge (no-op όταν δεν υπάρχει ενεργό wall-tool handle). */
function setOverride(key: 'thickness' | 'height', valueMm: number): void {
  const handle = wallToolBridgeStore.get();
  handle?.setParamOverrides({ ...handle.overrides, [key]: valueMm });
}

function wallThicknessField(): RingFieldDef {
  return {
    key: 'thickness',
    labelKey: 'tools.wall.ringThickness',
    kind: 'numeric',
    isLocked: () => currentOverrides().thickness !== undefined,
    seed: (ctx: RingUnitContext) => formatDisplayValue(resolveWallThicknessMm(currentOverrides()), ctx.displayUnit),
    commitNumeric: (value, ctx) => setOverride('thickness', fromDisplay(value, ctx.displayUnit)),
  };
}

function wallHeightField(): RingFieldDef {
  return {
    key: 'height',
    labelKey: 'tools.wall.ringHeight',
    kind: 'numeric',
    isLocked: () => currentOverrides().height !== undefined,
    seed: (ctx: RingUnitContext) =>
      formatDisplayValue(resolveStoreyHeightMm(currentOverrides().height, DEFAULT_WALL_HEIGHT_MM), ctx.displayUnit),
    commitNumeric: (value, ctx) => setOverride('height', fromDisplay(value, ctx.displayUnit)),
  };
}

/**
 * Διάταξη δαχτυλιδιού τοίχου (4 πεδία → 4 ίσες φέτες = cardinal). Σειρά = φέτα (`computeRingSlices`):
 * Μήκος πάνω, Γωνία δεξιά, Ύψος κάτω, Πάχος αριστερά (ίδια όψη με πριν τη δυναμικοποίηση).
 */
export const WALL_RING_CONFIG: RingConfig = {
  ariaLabelKey: 'tools.wall.ringLabel',
  fields: [
    lengthRingField('tools.wall.ringLength'),
    angleRingField('tools.wall.ringAngle'),
    wallHeightField(),
    wallThicknessField(),
  ],
  subscribe: combineSubscribers(
    DynamicInputLockStore.subscribe,
    wallPreviewStore.subscribe,
    wallToolBridgeStore.subscribe,
  ),
};
