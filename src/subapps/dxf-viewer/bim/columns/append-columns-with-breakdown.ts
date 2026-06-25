/**
 * ADR-419 / ADR-524 — SSoT helper: append έτοιμων columns μέσω του onColumnCreated
 * callback + εκπομπή breakdown event (κολώνες/τοιχία/αγνοημένα) για ενημερωτικό toast.
 *
 * Κοινό σε ΟΛΑ τα paths που δημιουργούν columns batch:
 *   - «Κολώνα σε περιοχή» (`use-column-region-clicks`)
 *   - «Πολλαπλή πλήρωση όμοιων πλαισίων» (`use-column-batch-fill-suggest`, ADR-524)
 *   - «από περίγραμμα» (`use-column-perimeter-commit`, Φ3c)
 * ώστε το append + count + breakdown emit να ζει σε ΜΙΑ πηγή (Giorgio SSoT audit —
 * πριν ήταν 3× copy-paste του ίδιου loop+emit).
 *
 * @see ./column-from-faces.ts (isWallColumnKind)
 */

import type { ColumnEntity } from '../types/column-types';
import { isWallColumnKind } from './column-from-faces';
import { EventBus } from '../../systems/events/EventBus';

/**
 * Append columns ΣΕ ΕΝΑ batch μέσω `appendAll` + εκπομπή κολώνες/τοιχία/αγνοημένα
 * breakdown. `ignored` = περιγράμματα που απορρίφθηκαν από τον validator (default 0).
 *
 * ⚠️ Ο `appendAll` ΠΡΕΠΕΙ να προσθέτει ΟΛΕΣ τις entities ΜΑΖΙ (π.χ. `addColumnsToScene`
 * → ΕΝΑΣ adapter), ΟΧΙ N× per-entity: N ξεχωριστοί adapters διαβάζουν stale scene →
 * μένει μόνο η τελευταία + σπάνε τα auto-foundation/cascades (ADR-524 root cause).
 */
export function appendColumnsWithBreakdown(
  entities: readonly ColumnEntity[],
  appendAll: (entities: readonly ColumnEntity[]) => void,
  ignored = 0,
): void {
  if (entities.length > 0) appendAll(entities);
  let columns = 0;
  let walls = 0;
  for (const c of entities) {
    if (isWallColumnKind(c.kind)) walls++;
    else columns++;
  }
  EventBus.emit('bim:columns-discrete-from-perimeter', { columns, walls, ignored });
}
