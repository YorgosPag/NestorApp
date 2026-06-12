/**
 * ADR-441 Slice GEN-COL — toast μετά το «Κολώνες από κάναβο».
 *
 * Το `up-to-date` (κάθε τομή έχει ήδη κολώνα) ΔΕΝ είναι αποτυχία (Revit
 * «ενημερωμένο»): εκπέμπεται ως success-style summary με created=0.
 *
 * Extracted from `useRibbonColumnBridge` (file-size SSoT, MAX 500 lines).
 */

import { EventBus } from '../../../../systems/events/EventBus';
import type { ColumnGridCommitResult } from '../../../../bim/columns/column-grid-commit';

export function emitColumnsFromGridToast(result: ColumnGridCommitResult): void {
  if (result.ok || result.reason === 'up-to-date') {
    EventBus.emit('bim:columns-from-grid', { created: result.created, skipped: result.skipped });
  } else {
    EventBus.emit('bim:columns-from-grid-failed', { reason: result.reason ?? 'insufficient-guides' });
  }
}
