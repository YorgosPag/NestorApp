'use client';

/**
 * ADR-674 Φ C (rev.2) — Opening hardware → priced BOQ, AGGREGATED ανά (floorplan × εξάρτημα).
 *
 * Big-player parity (Revit Door Hardware Schedule «itemize every instance = OFF» / ArchiCAD
 * Interactive Schedule «merge uniform items» / ελληνική ΑΤΟΕ προμέτρηση σιδερικών): η προμέτρηση
 * κιγκαλερίας ΔΕΝ βγαίνει per-instance — είναι **ΜΙΑ γραμμή ανά άρθρο (εξάρτημα)** με τη ΣΥΝΟΛΙΚΗ
 * ποσότητα του floorplan («Μεντεσές: 150 τεμ»). Ίδιο aggregation altitude με την signature-group
 * γραμμή κουφώματος (`opening-boq-sync`) — τα δύο feeds του κουφώματος μιλούν την ίδια γλώσσα.
 *
 * Παράγεται από τα ΙΔΙΑ persisted openings του floorplan (SSoT: reuse `fetchAllOpeningsForFloorplan`):
 *   total[component] = Σ_openings ( resolveOpeningHardwareSet(params)[component].quantity )
 *   → row `boq_bim_hw_<floorplanId>_<component>`, estimatedQuantity = total, unit 'pcs'.
 * Openings χωρίς χειριζόμενη λαβή (fixed/bay-window/overhead-door/revolving-door) δεν συνεισφέρουν.
 *
 * Κάθε opening save/restore/delete καλεί `recomputeFloorplanHardwareBoq(ctx)` — full recompute (μικρό,
 * fire-and-forget), mirror του `upsertOpeningGroupForOpening`. Ο κοινός `syncManagedBoqRow` δίνει
 * detach guard + frozen-baseline drift (5D-BIM) + zero-delete + createdAt preservation.
 *
 * @see ./opening-boq-sync.ts — η signature-group γραμμή κουφώματος (ίδιο altitude, ίδιος fetch SSoT)
 * @see ../family-types/opening-hardware-set.ts — Phase A take-off SSoT (ποσότητες ανά εξάρτημα)
 */

import {
  resolveOpeningHardwareMapping,
  type OpeningHardwareBoqComponent,
} from '../config/bim-to-atoe-mapping';
import type { OpeningParams } from '../types/opening-types';
import {
  HARDWARE_COMPONENT_LABEL_KEY,
  openingHasOperableHardware,
  resolveOpeningHardwareSet,
} from '../family-types/opening-hardware-set';
import { buildSingleEntityBoqRow } from './boq-base-row';
import { syncManagedBoqRow } from './boq-firestore-sync';
import { fetchAllOpeningsForFloorplan, type OpeningBoqContext } from './opening-boq-sync';

/**
 * The full 9-component universe (Phase A SSoT — NOT re-listed). Every recompute
 * sweeps ALL of them so a component that dropped to zero (last carrier opening
 * deleted / re-kinded) is orphan-deleted, not left stale.
 */
const ALL_HARDWARE_COMPONENTS: readonly OpeningHardwareBoqComponent[] =
  Object.keys(HARDWARE_COMPONENT_LABEL_KEY) as OpeningHardwareBoqComponent[];

/** Minimal opening shape the aggregation reads (`kind` lives in `params`). */
export interface HardwareBoqOpening {
  readonly params: OpeningParams;
}

/** Deterministic BOQ row id for a floorplan's aggregated hardware component line. */
export function openingHardwareBoqId(floorplanId: string, component: OpeningHardwareBoqComponent): string {
  return `boq_bim_hw_${floorplanId}_${component}`;
}

/**
 * Pure: sum the hardware pieces of a floorplan's openings PER component. Openings
 * without operable hardware contribute nothing. Exposed for testing without I/O.
 */
export function sumFloorplanHardware(
  openings: readonly HardwareBoqOpening[],
): ReadonlyMap<OpeningHardwareBoqComponent, number> {
  const totals = new Map<OpeningHardwareBoqComponent, number>();
  for (const opening of openings) {
    if (!openingHasOperableHardware(opening.params.kind)) continue;
    for (const item of resolveOpeningHardwareSet(opening.params)) {
      totals.set(item.component, (totals.get(item.component) ?? 0) + item.quantity);
    }
  }
  return totals;
}

async function syncHardwareComponentRow(
  component: OpeningHardwareBoqComponent,
  quantity: number,
  context: OpeningBoqContext,
): Promise<void> {
  const id = openingHardwareBoqId(context.floorplanId, component);
  await syncManagedBoqRow({
    id,
    quantity,
    buildPayload: (existingCreatedAt) =>
      buildSingleEntityBoqRow(
        id,
        context,
        context.floorplanId,
        'opening',
        resolveOpeningHardwareMapping(component),
        quantity,
        existingCreatedAt,
      ),
    logLabel: 'OpeningHardwareBoqSync',
    logContext: { component, floorplanId: context.floorplanId },
  });
}

/**
 * Recompute the floorplan's aggregated priced «σιδερικά» rows after ANY opening
 * change (save / restore / delete). Reads the floorplan's persisted openings,
 * sums each hardware component, upserts one row per component with the total —
 * components that fell to zero are orphan-deleted by `syncManagedBoqRow`.
 * Idempotent, detach- + frozen-baseline-guarded. Fire-and-forget (caller `void`s).
 */
export async function recomputeFloorplanHardwareBoq(context: OpeningBoqContext): Promise<void> {
  if (!context.companyId || !context.projectId || !context.buildingId || !context.floorplanId) return;
  const openings = await fetchAllOpeningsForFloorplan(context);
  const totals = sumFloorplanHardware(openings);
  await Promise.all(
    ALL_HARDWARE_COMPONENTS.map((component) =>
      syncHardwareComponentRow(component, totals.get(component) ?? 0, context),
    ),
  );
}
