/**
 * ADR-739 §39 — **η πλοήγηση του πλέγματος**: καθαρή, χωρίς DOM, χωρίς React.
 *
 * Χωριστό αρχείο ώστε ο χάρτης πλήκτρων να ελέγχεται με σκέτους πίνακες τιμών αντί για
 * προσομοιωμένα συμβάντα, και ώστε ο `TableSizeGrid` να μείνει με συναρτήσεις ≤40 γραμμών.
 *
 * ## Η μία σύμβαση που κρατά τον καμβά ήσυχο
 * Επιστροφή `null` σημαίνει «**δεν με αφορά αυτό το πλήκτρο**» ⇒ ο καλών **δεν** κάνει
 * `preventDefault`. Αυτό δεν είναι λεπτομέρεια: το `Tab` πρέπει να βγάζει από το πλέγμα προς
 * το πεδίο πλάτους (ADR-711 Ε1 — κανένας accelerator δεν διεκδικεί το `Tab`), και ένα
 * `preventDefault` σε κάθε πλήκτρο θα το εγκλώβιζε σιωπηλά.
 *
 * @module subapps/dxf-viewer/ui/ribbon/components/table/table-size-grid-keyboard
 */

import { MIN_TOTAL_TABLE_ROWS } from './table-size-menu-model';

/** Θέση κυψελίδας, **0-based**. */
export interface GridPos {
  readonly col: number;
  readonly row: number;
}

export interface GridDims {
  readonly columns: number;
  readonly rows: number;
}

/**
 * Η **πρώτη εστιάσιμη** σειρά. Η σειρά 0 παραλείπεται επίτηδες: δίνει ακριβώς το ίδιο μέγεθος
 * με τη σειρά 1 (σύνολο {@link MIN_TOTAL_TABLE_ROWS}), οπότε ως ξεχωριστός στόχος
 * πληκτρολογίου θα ήταν ένα βήμα που δεν αλλάζει τίποτα — και ο χρήστης δεν έχει τρόπο να
 * καταλάβει γιατί.
 */
export const MIN_FOCUSABLE_ROW_INDEX = MIN_TOTAL_TABLE_ROWS - 1;

/** Τα πλήκτρα που δεσμεύουν το τρέχον μέγεθος. */
export function isGridCommitKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampPos(pos: GridPos, dims: GridDims): GridPos {
  return {
    col: clamp(pos.col, 0, dims.columns - 1),
    row: clamp(pos.row, MIN_FOCUSABLE_ROW_INDEX, dims.rows - 1),
  };
}

type NavEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>;

/** Το άλμα κάθε πλήκτρου, πριν το φράξιμο στα όρια. `null` = άσχετο πλήκτρο. */
function rawTarget(current: GridPos, event: NavEvent, dims: GridDims): GridPos | null {
  const jump = event.ctrlKey || event.metaKey;
  switch (event.key) {
    case 'ArrowLeft':
      return { col: current.col - 1, row: current.row };
    case 'ArrowRight':
      return { col: current.col + 1, row: current.row };
    case 'ArrowUp':
      return { col: current.col, row: current.row - 1 };
    case 'ArrowDown':
      return { col: current.col, row: current.row + 1 };
    case 'Home':
      return jump ? { col: 0, row: MIN_FOCUSABLE_ROW_INDEX } : { col: 0, row: current.row };
    case 'End':
      return jump
        ? { col: dims.columns - 1, row: dims.rows - 1 }
        : { col: dims.columns - 1, row: current.row };
    default:
      return null;
  }
}

/**
 * Η επόμενη θέση εστίασης, **φραγμένη στα όρια χωρίς αναδίπλωση**, ή `null` όταν το πλήκτρο
 * δεν αφορά την πλοήγηση.
 *
 * Χωρίς αναδίπλωση επίτηδες: το πλέγμα είναι **γεωμετρικό μέγεθος**, όχι λίστα. Ένα δεξί βέλος
 * στη 10η στήλη που πηδά στην 1η της επόμενης γραμμής θα άλλαζε **και τις δύο** διαστάσεις με
 * ένα πάτημα — ακριβώς αυτό που ο χρήστης δεν ζήτησε.
 */
export function nextGridFocus(
  current: GridPos,
  event: NavEvent,
  dims: GridDims,
): GridPos | null {
  const target = rawTarget(current, event, dims);
  if (!target) return null;
  return clampPos(target, dims);
}
