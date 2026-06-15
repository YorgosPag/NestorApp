'use client';

/**
 * ADR-451 Slice 4 — «Ύψος Ορόφου» (storey height) ribbon bridge.
 *
 * Ένα ΔΕΥΤΕΡΟ entry point για το ΙΔΙΟ SSoT με την καρτέλα «Κτίρια → Όροφοι»:
 * γράφει το `floor.height` του **ενεργού ορόφου** μέσω του υπάρχοντος
 * `updateFloorWithPolicy` → `handleUpdateFloor` → `reconcileFloorStackAfterEdit`
 * (entity re-stretch κολονών/δοκαριών/τοίχων/πλακών + upper FFLs). Το 3Δ
 * ξανα-συγχρονίζεται **αυτόματα** (onSnapshot → active storey → `resyncBimScene`).
 * ΜΗΔΕΝ διπλή λογική — απλώς το ribbon καλεί το ίδιο gateway.
 *
 * Mirror του `column.structural.code` pattern (ADR-456): combobox key που ζει στο
 * contextual column tab αλλά γράφει σε **building/floor-level** SSoT, ΟΧΙ στην κολώνα.
 * Πραγματικός χωρισμός read (pure `resolveStoreyHeightState`/`parseStoreyHeightMetres`)
 * από side-effects (store read + gateway) ώστε να είναι testable.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-451-building-vertical-setup-floor-ssot.md
 * @see src/services/floor-mutation-gateway.ts
 */

import { useActiveStoreyStore } from '../../../../systems/levels/active-storey-store';
import type { ActiveStoreyContext } from '../../../../systems/levels/active-storey-context';
import { updateFloorWithPolicy } from '@/services/floor-mutation-gateway';
import { createModuleLogger } from '@/lib/telemetry';
import { STOREY_RIBBON_KEYS } from './storey-command-keys';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

const logger = createModuleLogger('storey-height-bridge');

export { STOREY_RIBBON_KEYS, isStoreyRibbonKey } from './storey-command-keys';

/**
 * Pure: combobox state του «Ύψος Ορόφου» από τον active storey context. Κενός
 * (disabled) όταν δεν υπάρχει ενεργός όροφος. Η τιμή είναι mm (το `storeyHeightMm`
 * = `floor.height × 1000`). `options: []` → ο tab δίνει τις στατικές επιλογές.
 */
export function resolveStoreyHeightState(ctx: ActiveStoreyContext | null): RibbonComboboxState {
  if (!ctx) return { value: '', options: [], disabled: true };
  return { value: String(Math.round(ctx.storeyHeightMm)), options: [] };
}

/** Pure: parse της combobox τιμής (mm) → ύψος ορόφου σε **μέτρα**, ή `null` αν άκυρο. */
export function parseStoreyHeightMetres(value: string): number | null {
  const mm = Number.parseFloat(value);
  if (!Number.isFinite(mm) || mm <= 0) return null;
  return mm / 1000;
}

/** Combobox state για ένα storey key (διαβάζει το active-storey store), ή `null` αν δεν ανήκει εδώ. */
export function getStoreyComboboxState(commandKey: string): RibbonComboboxState | null {
  if (commandKey !== STOREY_RIBBON_KEYS.height) return null;
  return resolveStoreyHeightState(useActiveStoreyStore.getState().context);
}

/**
 * Εφαρμόζει αλλαγή «Ύψος Ορόφου» → PATCH `/api/floors` (force-write· `_v` undefined =
 * backward-compat skip, single-user ribbon edit). Όλο το cascade + 3Δ re-sync είναι
 * server-side SSoT + reactive → καμία άλλη ενέργεια εδώ.
 */
export function applyStoreyComboboxChange(commandKey: string, value: string): void {
  if (commandKey !== STOREY_RIBBON_KEYS.height) return;
  const ctx = useActiveStoreyStore.getState().context;
  if (!ctx) return;
  const heightMetres = parseStoreyHeightMetres(value);
  if (heightMetres === null) return;
  void updateFloorWithPolicy({ payload: { floorId: ctx.floorId, height: heightMetres } }).catch(
    (error: unknown) => logger.error('Storey height update failed', { floorId: ctx.floorId, error }),
  );
}
