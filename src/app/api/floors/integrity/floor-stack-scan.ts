/**
 * Η σάρωση ακεραιότητας των στοιβών ορόφων — καθαρή πάνω σε ό,τι διαβάστηκε (η ανάγνωση ζει στο `route.ts`).
 *
 * @module api/floors/integrity/floor-stack-scan
 * @see lib/floor/floor-stack-integrity — ο ΙΔΙΟΣ κανόνας που εφαρμόζει η εγγραφή (`floor-stack-authority.ts`)
 */

import {
  findFloorStackConflicts,
  findSameElevationGroups,
  type FloorSlotClash,
  type FloorSlotRow,
} from '@/lib/floor/floor-stack-integrity';
import { groupByKey } from '@/utils/collection-utils';
import { toFloorStackRow } from '../_shared/floor-stack-rows';

/** Ένας όροφος όπως τον αναγνωρίζει ο άνθρωπος στην αναφορά. */
export interface ReportedFloor {
  id: string;
  number: number;
  name: string;
}

export interface StackFinding {
  buildingId: string;
  companyId: string;
  floors: ReportedFloor[];
}

export interface FloorsIntegrityReport {
  success: true;
  floorsScanned: number;
  buildingsScanned: number;
  /** Όροφοι χωρίς κτίριο ή ενοικιαστή — δεν ανήκουν σε καμία στοίβα, άρα δεν κρίνονται. */
  ownerlessFloors: number;
  /** Παραβιάσεις μοναδικότητας — σφάλματα προς επίλυση. */
  conflicts: Array<StackFinding & { clash: FloorSlotClash }>;
  /** Μετρούμενοι όροφοι στο ίδιο υψόμετρο — επιτρέπεται (Revit), αναφέρεται. */
  sameElevation: StackFinding[];
}

/** Ένας όροφος της σάρωσης: η γραμμή του κανόνα μαζί με τον κάτοχο της στοίβας του. */
export interface ScannedFloor {
  readonly row: FloorSlotRow;
  /** `null` ⇒ ο όροφος δεν δηλώνει κτίριο ή ενοικιαστή. */
  readonly stackKey: string | null;
  readonly buildingId: string;
  readonly companyId: string;
}

/** Ένα έγγραφο ορόφου → η γραμμή του και η στοίβα του. Η στοίβα είναι (κτίριο, ενοικιαστής), όπως στο σύνορο εγγραφής. */
export function scanFloor(id: string, data: Readonly<Record<string, unknown>>): ScannedFloor {
  const buildingId = typeof data.buildingId === 'string' ? data.buildingId : '';
  const companyId = typeof data.companyId === 'string' ? data.companyId : '';
  const stackKey = buildingId !== '' && companyId !== '' ? `${companyId}::${buildingId}` : null;
  return { row: toFloorStackRow(id, data), stackKey, buildingId, companyId };
}

function reportFloors(stack: readonly ScannedFloor[], ids: readonly string[]): ReportedFloor[] {
  return ids.flatMap((id) => {
    const found = stack.find((floor) => floor.row.id === id);
    return found ? [{ id, number: found.row.number, name: found.row.name ?? '' }] : [];
  });
}

/** Το εύρημα μιας ομάδας ορόφων μέσα στη στοίβα της. */
function findingOf(stack: readonly ScannedFloor[], ids: readonly string[]): StackFinding {
  return { buildingId: stack[0].buildingId, companyId: stack[0].companyId, floors: reportFloors(stack, ids) };
}

/** Κάθε όροφος → η στοίβα του → ο κανόνας. */
export function judgeFloorStacks(scanned: readonly ScannedFloor[]): FloorsIntegrityReport {
  const owned = scanned.filter((floor) => floor.stackKey !== null);
  const stacks = Object.values(groupByKey([...owned], (floor: ScannedFloor) => floor.stackKey as string));
  const rowsOf = (stack: readonly ScannedFloor[]) => stack.map((floor) => floor.row);
  return {
    success: true,
    floorsScanned: scanned.length,
    buildingsScanned: stacks.length,
    ownerlessFloors: scanned.length - owned.length,
    conflicts: stacks.flatMap((stack) =>
      findFloorStackConflicts(rowsOf(stack)).map((conflict) => ({
        ...findingOf(stack, conflict.floorIds),
        clash: conflict.clash,
      })),
    ),
    sameElevation: stacks.flatMap((stack) =>
      findSameElevationGroups(rowsOf(stack)).map((ids) => findingOf(stack, ids)),
    ),
  };
}
