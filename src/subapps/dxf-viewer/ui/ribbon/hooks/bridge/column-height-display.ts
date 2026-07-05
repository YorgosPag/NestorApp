'use client';

/**
 * ADR-449/451 — Pure helper για την εμφάνιση του «Ύψος» κολώνας στο ribbon.
 *
 * Το `params.height` έχει νόημα ΜΟΝΟ σε `unconnected` top. Σε storey/level-bound
 * κολώνα (storey-ceiling/absolute/attached) το ύψος είναι ΠΑΡΑΓΩΓΟ (ορίζεται από
 * Κτίρια→Όροφοι) → το πεδίο γίνεται read-only και δείχνει τη **resolved** (rendered)
 * τιμή μέσω της ΙΔΙΑΣ SSoT με τον πυρήνα (`resolveColumnVerticalExtentMm`).
 *
 * Εξάγεται σε ξεχωριστό module ώστε να είναι unit-testable **χωρίς** το βαρύ
 * structural import-chain του `column-bridge-combobox-resolvers` (firebase).
 */

import type { ColumnEntity } from '../../../../bim/types/column-types';
import { resolveColumnVerticalExtentMm } from '../../../../bim/geometry/column-vertical-profile';
import { projectVerticesTo2D } from '../../../../bim/geometry/shared/polygon-utils';
import { useActiveStoreyStore } from '../../../../systems/levels/active-storey-store';

/** True όταν το ύψος είναι παράγωγο (storey/level-bound) → read-only στο ribbon. */
export function isColumnHeightDerived(topBinding: ColumnEntity['params']['topBinding']): boolean {
  return topBinding !== 'unconnected';
}

/**
 * Resolved (rendered) ύψος κολώνας σε mm, ΙΔΙΑ SSoT με τον πυρήνα (storey-aware), ή
 * `null` για `attached` (per-corner — χρειάζεται host lookup που δεν έχει το ribbon)
 * ή χωρίς active storey context → ο caller κάνει fallback στο raw `params.height`.
 */
export function deriveStoreyBoundHeightMm(column: ColumnEntity): number | null {
  if (column.params.topBinding === 'attached') return null;
  const ctx = useActiveStoreyStore.getState().context;
  if (!ctx) return null;
  const footprint = projectVerticesTo2D(column.geometry?.footprint?.vertices ?? []);
  const ext = resolveColumnVerticalExtentMm(column.params, footprint, {
    floorElevationMm: ctx.floorElevationMm,
    nextFloorElevationMm: ctx.nextFloorElevationMm ?? undefined,
  });
  return ext.zTopMm - ext.zBotMm;
}
