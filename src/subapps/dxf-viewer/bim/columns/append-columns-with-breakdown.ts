/**
 * ADR-419 / ADR-524 — SSoT helper: append έτοιμων columns μέσω του onColumnCreated
 * callback + εκπομπή breakdown event (κολώνες/τοιχία) για ενημερωτικό toast.
 *
 * Κοινό σε «Κολώνα σε περιοχή» (`use-column-region-clicks`) + «Πολλαπλή πλήρωση
 * όμοιων πλαισίων» (`use-column-batch-fill-suggest`) ώστε το append + breakdown
 * να ζει σε ΜΙΑ πηγή (Giorgio SSoT audit — μηδέν copy-paste του emit).
 *
 * @see ./column-from-faces.ts (isWallColumnKind)
 */

import type { ColumnEntity } from '../types/column-types';
import { isWallColumnKind } from './column-from-faces';
import { EventBus } from '../../systems/events/EventBus';

/** Append κάθε column μέσω `onColumnCreated` + εκπομπή κολώνες/τοιχία breakdown. */
export function appendColumnsWithBreakdown(
  entities: readonly ColumnEntity[],
  onColumnCreated: ((entity: ColumnEntity) => void) | undefined,
): void {
  let columns = 0;
  let walls = 0;
  for (const c of entities) {
    onColumnCreated?.(c);
    if (isWallColumnKind(c.kind)) walls++;
    else columns++;
  }
  EventBus.emit('bim:columns-discrete-from-perimeter', { columns, walls, ignored: 0 });
}
