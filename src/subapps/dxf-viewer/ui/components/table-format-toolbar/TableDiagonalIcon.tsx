'use client';

/**
 * ADR-750 Φ5 (Α2) — **το εικονίδιο κάθε εντολής διαγωνίου, παραγόμενο από το μητρώο**.
 *
 * Ίδια αρχή με το {@link TableBorderIcon} και ίδιο καρέ ({@link TableIconFrame}): το εικονίδιο
 * δεν **μιμείται** την εντολή — εκτελεί την **ίδια** συνάρτηση γεωμετρίας
 * ({@link tableDiagonalCorners}) με άλλα όρια, το πλέγμα 2×2 του viewBox αντί για το κελί του
 * χρήστη. Άρα «το εικονίδιο δείχνει ↘ και η εντολή ζωγραφίζει ↗» δεν είναι απίθανο· είναι
 * **μη εκφράσιμο**. Το Excel έχει στατικά bitmap που *μπορούν* να αποκλίνουν.
 *
 * Η «Χωρίς διαγώνιες» βγαίνει σκέτο διάστικτο πλέγμα **χωρίς καμία ειδική περίπτωση**: το
 * μητρώο τη δηλώνει `down: false, up: false`, οπότε δεν υπάρχει γραμμή να ζωγραφιστεί. Η ίδια
 * σιωπηλή ορθότητα με το «Χωρίς περίγραμμα» των ακμών.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableDiagonalIcon
 * @see bim/table/table-cell-diagonal-ops.ts — το μητρώο και η γεωμετρία που καταναλώνει
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §19
 */

import React from 'react';
import {
  tableDiagonalCorners,
  type TableDiagonalCommand,
  type TableDiagonalDirection,
} from '../../../bim/table/table-cell-diagonal-ops';
import { TABLE_ICON_BOX, TableIconFrame } from './TableBorderIcon';

/**
 * Το πάχος της διαγωνίου στο εικονίδιο.
 *
 * Λεπτότερο από το `base` των περιγραμμάτων (1.1) επίτηδες: η διαγώνιος διασχίζει **όλο** το
 * τετράγωνο, άρα με ίδιο πάχος θα βάραινε οπτικά περισσότερο από μια πλευρά και η σειρά των
 * εικονιδίων στο μενού θα φαινόταν ανομοιογενής. Ίδιο μέλημα με το `double` (0.85).
 */
const DIAGONAL_WIDTH = 1;

export interface TableDiagonalIconProps {
  readonly command: TableDiagonalCommand;
  /** Πλευρά σε px· το εικονίδιο κλιμακώνεται, οι αναλογίες μένουν. */
  readonly size?: number;
}

export function TableDiagonalIcon({
  command, size = 16,
}: TableDiagonalIconProps): React.ReactElement {
  const directions: readonly TableDiagonalDirection[] = [
    ...(command.down ? (['down'] as const) : []),
    ...(command.up ? (['up'] as const) : []),
  ];

  return (
    <TableIconFrame size={size}>
      {directions.map((direction) => {
        const { a, b } = tableDiagonalCorners(direction, TABLE_ICON_BOX);
        return (
          <line
            key={direction}
            strokeWidth={DIAGONAL_WIDTH}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
          />
        );
      })}
    </TableIconFrame>
  );
}
