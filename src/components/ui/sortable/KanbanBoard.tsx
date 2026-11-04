'use client';

/**
 * =============================================================================
 * Ο ΕΝΑΣ ΠΙΝΑΚΑΣ ΣΤΗΛΩΝ (Kanban) — ποντίκι, αφή, πληκτρολόγιο, αναγνώστης οθόνης (ADR-929)
 * =============================================================================
 *
 * Πάνω στο `@dnd-kit` (MIT), δίπλα στο `SortableList`/`SortableTree`, με τους **ίδιους** αισθητήρες
 * (`useSortableSensors`) και τον **ίδιο** μηχανισμό κίνησης (`useDragTransform`).
 *
 * 🔑 **Ο πίνακας αναφέρει, δεν αποφασίζει**: `onMove(item, from, to)` — ο ιδιοκτήτης των δεδομένων κάνει την
 *    αλλαγή (αισιόδοξα, με διάλογο, ή αρνείται). Η θέση της κάρτας επιστρέφει από τα δεδομένα.
 * 🔑 **Κλικ ≠ σύρσιμο**: απόσταση ενεργοποίησης 4px — το απλό κλικ στην κάρτα κάνει ό,τι ορίζει η κάρτα.
 * 🔑 **Μη επιτρεπτές στήλες θολώνουν όσο σέρνεις** (`canDrop`) και δεν δέχονται ρίψη — ο άνθρωπος βλέπει πού
 *    ΜΠΟΡΕΙ να αφήσει πριν αφήσει.
 * 🔑 **Πληκτρολόγιο**: Space σηκώνει, ←/→ πηγαίνει στη γειτονική **επιτρεπτή** στήλη, Space αφήνει, Esc ακυρώνει·
 *    κάθε βήμα ανακοινώνεται στη γλώσσα του χρήστη (`common:kanban.*`).
 * ⚠️ Χωρίς `DragOverlay`/portal: η κάρτα μετακινείται επί τόπου (τοπικό `z-10`, όχι καθολική στρώση — CHECK 3.50).
 *
 * @module components/ui/sortable/KanbanBoard
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { groupByColumn, neighbourColumn, resolveKanbanDrop } from './kanban-model';
import { useSortableSensors } from './SortableList';
import { useDragTransform } from './use-drag-transform';

/** Εσοχή από την κορυφή της στήλης-στόχου όταν η κάρτα «πηδά» με το πληκτρολόγιο. */
const KEYBOARD_COLUMN_INSET = 48;

export interface KanbanColumnDef {
  readonly id: string;
  readonly label: string;
  /** Επιπλέον περιεχόμενο κεφαλίδας (σύνολα, μετρητές). Η ετικέτα μπαίνει πάντα. */
  readonly header?: React.ReactNode;
}

export interface KanbanBoardProps<T> {
  readonly columns: readonly KanbanColumnDef[];
  readonly items: readonly T[];
  readonly getId: (item: T) => string;
  readonly getLabel: (item: T) => string;
  readonly getColumnId: (item: T) => string;
  readonly onMove: (item: T, from: string, to: string) => void;
  /** Η κάρτα· η `handle` (λαβή πληκτρολογίου/ποντικιού) μπαίνει όπου θέλει ο καταναλωτής. */
  readonly renderCard: (item: T, handle: React.ReactNode) => React.ReactNode;
  readonly ariaLabel: string;
  readonly canDrag?: (item: T) => boolean;
  readonly canDrop?: (item: T, to: string) => boolean;
  /** `card`: ολόκληρη η κάρτα σέρνεται με το ποντίκι (Pipedrive/HubSpot)· `handle`: μόνο η λαβή. */
  readonly activation?: 'card' | 'handle';
  readonly emptyLabel?: string;
  readonly className?: string;
  readonly columnClassName?: string;
}

const ALWAYS = () => true;

/** Κάρτα που σέρνεται — `pointerWithin` (ακρίβεια ποντικιού) με εφεδρεία `rectIntersection` (πληκτρολόγιο). */
const columnCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : rectIntersection(args);
};

/** ←/→ = γειτονική ΕΝΕΡΓΗ στήλη· ↑/↓ δεν έχουν νόημα (καμία σειρά μέσα στη στήλη). */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (direction === 0) return undefined;
  event.preventDefault();
  const rects = context.droppableContainers
    .filter((container) => !container.disabled)
    .map((container) => ({ id: String(container.id), rect: context.droppableRects.get(container.id) }))
    .flatMap(({ id, rect }) => (rect ? [{ id, left: rect.left, top: rect.top, width: rect.width }] : []));
  const next = neighbourColumn(rects, context.over ? String(context.over.id) : null, direction);
  const card = context.collisionRect;
  if (!next || !card) return undefined;
  return { x: next.left + (next.width - card.width) / 2, y: next.top + KEYBOARD_COLUMN_INSET };
};

function useKanbanAnnouncements(labelOfItem: (id: string) => string, labelOfColumn: (id: string) => string): Announcements {
  const { t } = useTranslation('common-shared');
  return useMemo(() => {
    // Στατικά κλειδιά, ένα ανά ανακοίνωση: το i18n slice (ADR-744) ξέρει ακριβώς τι χρειάζεται — καμία δυναμική t().
    const vars = (itemId: string | number, columnId?: string | number) =>
      ({ label: labelOfItem(String(itemId)), column: columnId === undefined ? '' : labelOfColumn(String(columnId)) });
    return {
      onDragStart: ({ active }) => t('kanban.picked', vars(active.id)),
      onDragOver: ({ active, over }) => (over ? t('kanban.over', vars(active.id, over.id)) : undefined),
      onDragEnd: ({ active, over }) => (over ? t('kanban.dropped', vars(active.id, over.id)) : t('kanban.cancelled', vars(active.id))),
      onDragCancel: ({ active }) => t('kanban.cancelled', vars(active.id)),
    };
  }, [labelOfColumn, labelOfItem, t]);
}

interface ColumnProps {
  readonly column: KanbanColumnDef;
  readonly count: number;
  readonly refusing: boolean;
  readonly emptyLabel?: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

function KanbanColumn({ column, count, refusing, emptyLabel, className, children }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, disabled: refusing });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.label}
      aria-disabled={refusing || undefined}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border border-transparent p-3 transition-colors',
        className,
        isOver && 'border-primary bg-accent/40',
        refusing && 'opacity-40',
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <h3 className="m-0 truncate text-sm font-medium text-foreground">{column.label}</h3>
        {column.header}
      </header>
      <ul className="m-0 flex min-h-16 flex-1 flex-col gap-2 p-0">{children}</ul>
      {count === 0 && emptyLabel ? <p className="m-0 text-center text-xs text-muted-foreground">{emptyLabel}</p> : null}
    </section>
  );
}

interface CardProps {
  readonly id: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly activation: 'card' | 'handle';
  readonly children: (handle: React.ReactNode) => React.ReactNode;
}

function KanbanCard({ id, label, disabled, activation, children }: CardProps) {
  const { t } = useTranslation('common-shared');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id, disabled });
  const ref = useDragTransform(setNodeRef, transform, undefined);
  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="inline-flex h-7 w-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t('kanban.handle', { label })}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );
  const cardListeners = activation === 'card' && !disabled ? listeners : undefined;
  return (
    <li
      ref={ref}
      className={cn('list-none', activation === 'card' && !disabled && 'cursor-grab', isDragging && 'relative z-10 opacity-90 shadow-lg')}
      {...cardListeners}
    >
      {children(handle)}
    </li>
  );
}

/**
 * Ο browser στέλνει `click` αμέσως μετά το `pointerup` που άφησε την κάρτα — και η κάρτα θα «άνοιγε» (πλοήγηση)
 * σε κάθε ρίψη. Καταπίνεται ΜΟΝΟ εκείνο το ένα κλικ: ο ακροατής φεύγει στο επόμενο task, άρα ένα πραγματικό κλικ
 * αργότερα (ή μετά από ρίψη με πληκτρολόγιο, που δεν παράγει κλικ) περνά κανονικά.
 */
function swallowClickAfterDrop(): void {
  const swallow = (event: Event) => { event.stopPropagation(); event.preventDefault(); };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
}

/** Η κατάσταση ενός συρσίματος: ποια κάρτα σηκώθηκε, και τι σημαίνει η ρίψη της. */
function useKanbanDrag<T>({ items, columns, getId, getLabel, getColumnId, onMove, canDrop }: KanbanBoardProps<T> & { readonly canDrop: (item: T, to: string) => boolean }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((item) => [getId(item), item])), [items, getId]);
  const columnLabels = useMemo(() => new Map(columns.map((column) => [column.id, column.label])), [columns]);
  const labelOfItem = useCallback((id: string) => { const item = byId.get(id); return item ? getLabel(item) : id; }, [byId, getLabel]);
  const labelOfColumn = useCallback((id: string) => columnLabels.get(id) ?? id, [columnLabels]);
  const announcements = useKanbanAnnouncements(labelOfItem, labelOfColumn);

  const onDragStart = useCallback(({ active }: DragStartEvent) => setActiveId(String(active.id)), []);
  const onDragCancel = useCallback(() => { setActiveId(null); swallowClickAfterDrop(); }, []);
  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      swallowClickAfterDrop();
      const item = byId.get(String(active.id));
      if (!item) return;
      const drop = resolveKanbanDrop(getColumnId(item), over ? String(over.id) : null, (to) => canDrop(item, to));
      if (drop.kind === 'move') onMove(item, drop.from, drop.to);
    },
    [byId, canDrop, getColumnId, onMove],
  );
  return { active: activeId ? byId.get(activeId) : undefined, announcements, onDragStart, onDragEnd, onDragCancel };
}

export function KanbanBoard<T>(props: KanbanBoardProps<T>) {
  const { columns, items, getId, getLabel, getColumnId, renderCard, ariaLabel, emptyLabel, className, columnClassName } = props;
  const { canDrag = ALWAYS, canDrop = ALWAYS, activation = 'handle' } = props;
  const { t } = useTranslation('common-shared');
  const sensors = useSortableSensors(columnKeyboardCoordinates);
  const { active, announcements, onDragStart, onDragEnd, onDragCancel } = useKanbanDrag({ ...props, canDrop });
  const groups = useMemo(() => groupByColumn(items, columns, getColumnId), [items, columns, getColumnId]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={columnCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('kanban.instructions') } }}
    >
      <div role="group" aria-label={ariaLabel} className={cn('flex gap-3', className)}>
        {columns.map((column) => {
          const cards = groups.get(column.id) ?? [];
          const refusing = active !== undefined && column.id !== getColumnId(active) && !canDrop(active, column.id);
          return (
            <KanbanColumn key={column.id} column={column} count={cards.length} refusing={refusing} emptyLabel={emptyLabel} className={columnClassName}>
              {cards.map((item) => (
                <KanbanCard key={getId(item)} id={getId(item)} label={getLabel(item)} disabled={!canDrag(item)} activation={activation}>
                  {(handle) => renderCard(item, handle)}
                </KanbanCard>
              ))}
            </KanbanColumn>
          );
        })}
      </div>
    </DndContext>
  );
}
