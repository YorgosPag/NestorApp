/**
 * @fileoverview **Ο καθαρός πυρήνας του πίνακα στηλών (Kanban)** — ομαδοποίηση, απόφαση ρίψης, πλοήγηση πληκτρολογίου.
 * @module components/ui/sortable/kanban-model
 *
 * Χωρίς React, χωρίς DOM: τα tests τον εκτελούν σκέτο, το `KanbanBoard` τον καλεί.
 *
 * 🔑 **Ο πίνακας δεν αλλάζει δεδομένα μόνος του**: αναφέρει «το Χ από τη στήλη Α στη Β» και ο ιδιοκτήτης των
 *    δεδομένων αποφασίζει (αισιόδοξα, διάλογος, άρνηση). Δεύτερη αποθήκη θέσεων εδώ θα απέκλινε από τα δεδομένα.
 * 🔑 **Καμία σειρά μέσα στη στήλη**: η σειρά των καρτών είναι κανόνας του καταναλωτή (ταξινόμηση), όπως στους
 *    μεγάλους CRM — η χειροκίνητη σειρά ενός χρήστη χαλάει τη σειρά των άλλων.
 */

export interface KanbanColumnRef {
  readonly id: string;
}

/** Τα στοιχεία ανά στήλη, με τη σειρά που ήρθαν. Στοιχείο σε άγνωστη στήλη ⇒ δεν εμφανίζεται (όχι σιωπηλή στήλη). */
export function groupByColumn<T>(
  items: readonly T[],
  columns: readonly KanbanColumnRef[],
  getColumnId: (item: T) => string,
): ReadonlyMap<string, readonly T[]> {
  const groups = new Map<string, T[]>(columns.map((column) => [column.id, []]));
  for (const item of items) groups.get(getColumnId(item))?.push(item);
  return groups;
}

export type KanbanDrop =
  | { readonly kind: 'none' }
  | { readonly kind: 'refused'; readonly to: string }
  | { readonly kind: 'move'; readonly from: string; readonly to: string };

/** Τι σημαίνει μια ρίψη: τίποτα (έξω / ίδια στήλη), άρνηση, ή μετακίνηση. */
export function resolveKanbanDrop(from: string, overColumnId: string | null, allowed: (to: string) => boolean): KanbanDrop {
  if (overColumnId === null || overColumnId === from) return { kind: 'none' };
  if (!allowed(overColumnId)) return { kind: 'refused', to: overColumnId };
  return { kind: 'move', from, to: overColumnId };
}

export interface KanbanRect {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

/**
 * Η επόμενη στήλη για το πληκτρολόγιο (←/→), παραλείποντας όσες δεν δέχονται. Οι στήλες ταξινομούνται κατά
 * οριζόντια θέση — η σειρά της οθόνης, όχι του DOM. Στο άκρο ⇒ μένει εκεί.
 */
export function neighbourColumn(rects: readonly KanbanRect[], currentId: string | null, direction: 1 | -1): KanbanRect | null {
  const ordered = [...rects].sort((a, b) => a.left - b.left);
  if (ordered.length === 0) return null;
  const index = ordered.findIndex((rect) => rect.id === currentId);
  if (index === -1) return direction === 1 ? ordered[0] : ordered[ordered.length - 1];
  return ordered[Math.min(ordered.length - 1, Math.max(0, index + direction))];
}

// ── Ζώνη ρίψης (dock) ─────────────────────────────────────────────────────────────────────────────────────────────
// Οι στόχοι της ζώνης είναι ΑΛΛΑ droppables με το ίδιο νόημα με τη στήλη τους: «άφησέ το στο Χ». Δύο droppables δεν
// μπορούν να έχουν το ίδιο id, άρα ο στόχος φορά πρόθεμα — και ΚΑΘΕ ανάγνωση του `over` περνά από `columnOfDropTarget`.

const DOCK_PREFIX = 'kanban-dock:';

/** Το id του droppable της ζώνης για μια στήλη. */
export function dockTargetId(columnId: string): string {
  return `${DOCK_PREFIX}${columnId}`;
}

export function isDockTarget(targetId: string): boolean {
  return targetId.startsWith(DOCK_PREFIX);
}

/** Η στήλη που σημαίνει ένας στόχος ρίψης — στήλη ή στόχος της ζώνης. */
export function columnOfDropTarget(targetId: string): string {
  return isDockTarget(targetId) ? targetId.slice(DOCK_PREFIX.length) : targetId;
}

// ── Σύμπτυξη στηλών ───────────────────────────────────────────────────────────────────────────────────────────────
// Αποθηκεύονται ΜΟΝΟ οι ρητές επιλογές του ανθρώπου (`true` = συμπτυγμένη, `false` = ανοιχτή). Η προεπιλογή του
// καταναλωτή ισχύει όπου ο άνθρωπος δεν επέλεξε — έτσι μια νέα προεπιλογή φτάνει σε όλους χωρίς να σβήσει επιλογές.

export type KanbanCollapseChoices = Readonly<Record<string, boolean>>;

/** Ό,τι διαβάστηκε από την αποθήκη, φιλτραρισμένο: μόνο γνωστές στήλες, μόνο boolean. Οτιδήποτε άλλο ⇒ καμία επιλογή. */
export function parseCollapseChoices(value: unknown, columnIds: readonly string[]): KanbanCollapseChoices {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const known = new Set(columnIds);
  const choices: Record<string, boolean> = {};
  for (const [id, collapsed] of Object.entries(value)) {
    if (known.has(id) && typeof collapsed === 'boolean') choices[id] = collapsed;
  }
  return choices;
}

/** Οι συμπτυγμένες στήλες: η ρητή επιλογή κερδίζει, αλλιώς η προεπιλογή. */
export function resolveCollapsedColumns(
  columnIds: readonly string[],
  choices: KanbanCollapseChoices,
  collapsedByDefault: (columnId: string) => boolean,
): ReadonlySet<string> {
  return new Set(columnIds.filter((id) => choices[id] ?? collapsedByDefault(id)));
}
