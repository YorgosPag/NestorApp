/**
 * @fileoverview **Τι δείχνει μία γραμμή ορόφου** — υπολογισμένο ΜΙΑ φορά, για τον πίνακα και για τη λίστα.
 * @related ADR-912 §5 · ADR-451 / ADR-461 (το ύψος είναι παράγωγο) · ADR-910 §3.2 (όροφος χωρίς ύψος)
 * @module components/building-management/tabs/floors/floor-row-model
 *
 * 🔑 Ο πίνακας (φαρδύς χώρος) και η λίστα (στενός χώρος) είναι **δύο όψεις της ίδιας γραμμής**. Αν καθεμία
 * υπολόγιζε μόνη της το παράγωγο ύψος, η πρώτη διόρθωση θα έφτανε στη μία και όχι στην άλλη — και το κινητό
 * θα έδειχνε άλλον αριθμό από το desktop για τον ίδιο όροφο.
 */

import { isBuildingStorey } from '@/utils/floor-naming';

import type { useFloorsTabState } from '../useFloorsTabState';
import type { FloorRecord } from '../useFloorsTabState.types';

export type FloorsTabState = ReturnType<typeof useFloorsTabState>;

export interface FloorRowModel {
  readonly floor: FloorRecord;
  readonly isExpanded: boolean;
  readonly isEditing: boolean;
  readonly isHighlighted: boolean;
  /** Ειδική στάθμη (θεμελίωση · απόληξη κλιμακοστασίου) — δεν μετρά ως όροφος. */
  readonly isSpecial: boolean;
  /**
   * ADR-451 / ADR-461 — το υψόμετρο είναι η αλήθεια· το ύψος κάθε ενδιάμεσου ορόφου **παράγεται** (= απόσταση
   * από τον από πάνω) και δεν γράφεται. Ο τελευταίος όροφος και οι ειδικές στάθμες κρατούν ρητό ύψος.
   */
  readonly isHeightDerived: boolean;
  readonly derivedHeight: number | null;
  /** Το ύψος που διαβάζει ο άνθρωπος — παράγωγο ή ρητό, ποτέ μπαγιάτικο από άλλη πηγή. */
  readonly displayHeight: number | null;
  /** ADR-910 §3.2 — ίδιο/αντεστραμμένο υψόμετρο με τον από πάνω: το «0.00 m» δεν είναι τιμή, είναι σφάλμα. */
  readonly isTooLow: boolean;
}

function derivedHeightOf(floor: FloorRecord, next: FloorRecord | undefined): number | null {
  if (next && floor.elevation != null && next.elevation != null) return next.elevation - floor.elevation;
  return floor.height ?? null;
}

export function buildFloorRowModel(state: FloorsTabState, index: number): FloorRowModel {
  const floor = state.floors[index];
  const isHeightDerived = state.heightDerivedFloorIds.has(floor.id);
  const derivedHeight = derivedHeightOf(floor, state.floors[index + 1]);

  return {
    floor,
    isExpanded: state.expandedFloorId === floor.id,
    isEditing: state.editingId === floor.id,
    isHighlighted: state.highlightedFloorId === floor.id,
    isSpecial: floor.kind !== undefined && !isBuildingStorey(floor.kind),
    isHeightDerived,
    derivedHeight,
    displayHeight: isHeightDerived ? derivedHeight : (floor.height ?? null),
    isTooLow: state.tooLowFloorIds.has(floor.id),
  };
}

/** Ο τόνος της γραμμής: επισήμανση από deep-link > ανοιχτή > αιώρηση. Ίδιος σε `<tr>` και `<li>`. */
export function floorRowTone(row: FloorRowModel): string {
  if (row.isHighlighted) return 'bg-[hsl(var(--bg-info)/0.18)]';
  return row.isExpanded ? 'bg-muted/10' : 'hover:bg-muted/20';
}
