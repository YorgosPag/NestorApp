'use client';

/**
 * =============================================================================
 * Ο ΕΝΑΣ ΠΙΝΑΚΑΣ ΣΤΗΛΩΝ (Kanban) — ποντίκι, αφή, πληκτρολόγιο, αναγνώστης οθόνης (ADR-930)
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
 * 🔑 **`layout="fill"`** (ADR-930 §3.11, Jira): ο πίνακας γεμίζει το ύψος του γονέα, κυλά **ολόκληρος** και στους δύο
 *    άξονες με **ορατές** μπάρες (`ScrollArea` — ο καθολικός κανόνας του `globals.css` κρύβει κάθε εγγενή), οι
 *    κεφαλίδες μένουν καρφωμένες πάνω, και οι άκρες σβήνουν όπου υπάρχουν κρυμμένες στήλες. Μία κύλιση, όχι μία ανά
 *    στήλη: η κάρτα κινείται επί τόπου, και μια κύλιση ανά στήλη θα την έκοβε μόλις έβγαινε από τη στήλη της.
 * 🔑 **Σύμπτυξη** (`collapsed` + `onCollapsedChange`) και **ζώνη ρίψης** (`dock`) — βλ. `kanban-column` / `kanban-dock`.
 * ⚠️ Χωρίς `DragOverlay`/portal: η κάρτα μετακινείται επί τόπου (τοπικό `z-20`, όχι καθολική στρώση — CHECK 3.50).
 *
 * @module components/ui/sortable/KanbanBoard
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  pointerWithin,
  rectIntersection,
  useDraggable,
  type Announcements,
  type AutoScrollOptions,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useScrollEdges } from '@/hooks/useScrollEdges';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import fadeStyles from '../scroll-edge-fade.module.css';
import { KanbanColumn } from './kanban-column';
import { KanbanDock, type KanbanDockTarget } from './kanban-dock';
import { columnOfDropTarget, groupByColumn, isDockTarget, neighbourColumn, resolveKanbanDrop } from './kanban-model';
import { useSortableSensors } from './SortableList';
import { useDragTransform } from './use-drag-transform';

export type { KanbanDockTarget } from './kanban-dock';

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
  /** Κλάσεις κεφαλίδας στήλης — με `layout="fill"` χρειάζεται ΑΔΙΑΦΑΝΕΣ φόντο (η κεφαλίδα είναι `sticky`). */
  readonly columnHeaderClassName?: string;
  /** `flow` (προεπιλογή): ύψος = περιεχόμενο. `fill`: γεμίζει τον γονέα (που πρέπει να είναι flex στήλη). */
  readonly layout?: 'flow' | 'fill';
  /** Οι συμπτυγμένες στήλες (ελεγχόμενο — π.χ. από `useKanbanCollapse`). */
  readonly collapsed?: ReadonlySet<string>;
  /** Χωρίς αυτό καμία στήλη δεν συμπτύσσεται. */
  readonly onCollapsedChange?: (columnId: string, collapsed: boolean) => void;
  /** Στόχοι ρίψης στο κάτω μέρος, ορατοί μόνο όσο σέρνεις. Η ρίψη εκεί = ρίψη στη στήλη του στόχου. */
  readonly dock?: readonly KanbanDockTarget[];
  /** Προσβάσιμο όνομα της ζώνης ρίψης. */
  readonly dockLabel?: string;
}

const ALWAYS = () => true;
const NONE: ReadonlySet<string> = new Set();

/**
 * Κάρτα που σέρνεται — `pointerWithin` (ακρίβεια ποντικιού) με εφεδρεία `rectIntersection` (πληκτρολόγιο).
 * Η ζώνη ρίψης **επικαλύπτει** τις στήλες: όταν ο δείκτης είναι πάνω της, κερδίζει εκείνη (ό,τι βλέπει ο άνθρωπος).
 */
const columnCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const dock = within.filter((collision) => isDockTarget(String(collision.id)));
  if (dock.length > 0) return dock;
  return within.length > 0 ? within : rectIntersection(args);
};

/** ←/→ = γειτονική ΕΝΕΡΓΗ στήλη· ↑/↓ δεν έχουν νόημα (καμία σειρά μέσα στη στήλη). Η ζώνη ρίψης δεν είναι στήλη. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0;
  if (direction === 0) return undefined;
  event.preventDefault();
  const rects = context.droppableContainers
    .filter((container) => !container.disabled && !isDockTarget(String(container.id)))
    .map((container) => ({ id: String(container.id), rect: context.droppableRects.get(container.id) }))
    .flatMap(({ id, rect }) => (rect ? [{ id, left: rect.left, top: rect.top, width: rect.width }] : []));
  const current = context.over ? columnOfDropTarget(String(context.over.id)) : null;
  const next = neighbourColumn(rects, current, direction);
  const card = context.collisionRect;
  if (!next || !card) return undefined;
  return { x: next.left + (next.width - card.width) / 2, y: next.top + KEYBOARD_COLUMN_INSET };
};

function useKanbanAnnouncements(labelOfItem: (id: string) => string, labelOfColumn: (id: string) => string): Announcements {
  const { t } = useTranslation('common-shared');
  return useMemo(() => {
    // Στατικά κλειδιά, ένα ανά ανακοίνωση: το i18n slice (ADR-744) ξέρει ακριβώς τι χρειάζεται — καμία δυναμική t().
    const vars = (itemId: string | number, targetId?: string | number) => ({
      label: labelOfItem(String(itemId)),
      column: targetId === undefined ? '' : labelOfColumn(columnOfDropTarget(String(targetId))),
    });
    return {
      onDragStart: ({ active }) => t('kanban.picked', vars(active.id)),
      onDragOver: ({ active, over }) => (over ? t('kanban.over', vars(active.id, over.id)) : undefined),
      onDragEnd: ({ active, over }) => (over ? t('kanban.dropped', vars(active.id, over.id)) : t('kanban.cancelled', vars(active.id))),
      onDragCancel: ({ active }) => t('kanban.cancelled', vars(active.id)),
    };
  }, [labelOfColumn, labelOfItem, t]);
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
      className={cn('list-none', activation === 'card' && !disabled && 'cursor-grab', isDragging && 'relative z-20 opacity-90 shadow-lg')}
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

/**
 * Πάνω από τη ζώνη ρίψης ο πίνακας ΔΕΝ κυλά: η ζώνη κάθεται στο κάτω άκρο, ακριβώς εκεί όπου το `@dnd-kit` θα
 * ξεκινούσε αυτόματη κύλιση — ο άνθρωπος που σκοπεύει τον στόχο θα έβλεπε τον πίνακα να φεύγει από κάτω του.
 */
function useDockAwareAutoScroll() {
  const overDock = useRef(false);
  const autoScroll = useMemo<AutoScrollOptions>(() => ({ canScroll: () => !overDock.current }), []);
  const track = useCallback((overId: string | null) => { overDock.current = overId !== null && isDockTarget(overId); }, []);
  return { autoScroll, track };
}

/** Η κατάσταση ενός συρσίματος: ποια κάρτα σηκώθηκε, και τι σημαίνει η ρίψη της. */
function useKanbanDrag<T>({ items, columns, getId, getLabel, getColumnId, onMove, canDrop }: KanbanBoardProps<T> & { readonly canDrop: (item: T, to: string) => boolean }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((item) => [getId(item), item])), [items, getId]);
  const columnLabels = useMemo(() => new Map(columns.map((column) => [column.id, column.label])), [columns]);
  const labelOfItem = useCallback((id: string) => { const item = byId.get(id); return item ? getLabel(item) : id; }, [byId, getLabel]);
  const labelOfColumn = useCallback((id: string) => columnLabels.get(id) ?? id, [columnLabels]);
  const announcements = useKanbanAnnouncements(labelOfItem, labelOfColumn);
  const { autoScroll, track } = useDockAwareAutoScroll();

  const onDragStart = useCallback(({ active }: DragStartEvent) => setActiveId(String(active.id)), []);
  const onDragOver = useCallback(({ over }: DragOverEvent) => track(over ? String(over.id) : null), [track]);
  const onDragCancel = useCallback(() => { setActiveId(null); track(null); swallowClickAfterDrop(); }, [track]);
  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      track(null);
      swallowClickAfterDrop();
      const item = byId.get(String(active.id));
      if (!item) return;
      const target = over ? columnOfDropTarget(String(over.id)) : null;
      const drop = resolveKanbanDrop(getColumnId(item), target, (to) => canDrop(item, to));
      if (drop.kind === 'move') onMove(item, drop.from, drop.to);
    },
    [byId, canDrop, getColumnId, onMove, track],
  );
  const handlers = { onDragStart, onDragOver, onDragEnd, onDragCancel };
  return { active: activeId ? byId.get(activeId) : undefined, announcements, autoScroll, handlers };
}

/**
 * Το περιτύλιγμα του Radix (το μόνο παιδί του viewport) γίνεται **flex, όσο φαρδύ το περιεχόμενο και τουλάχιστον όσο η
 * θυρίδα, σε πλάτος και ύψος**: (α) οι στήλες τεντώνουν ως κάτω (στόχος ρίψης σε όλο το ύψος), (β) το πλάτος του
 * αλλάζει όταν μια στήλη συμπτύσσεται — και το `useScrollEdges` παρατηρεί ακριβώς αυτό το παιδί. Με το προεπιλεγμένο
 * `!block` (ADR-912 §10) το παιδί θα είχε πάντα το πλάτος της θυρίδας και το σβήσιμο θα έμενε μπαγιάτικο.
 */
const FILL_VIEWPORT = '[&>div]:!flex [&>div]:!w-fit [&>div]:!min-w-full [&>div]:!min-h-full';

/** Το πλαίσιο του `layout="fill"`: μία κύλιση και στους δύο άξονες, ορατές μπάρες, σβήσιμο όπου συνεχίζει. */
function FillFrame({ children, overlay }: { readonly children: React.ReactNode; readonly overlay: React.ReactNode }) {
  const edges = useScrollEdges<HTMLDivElement>();
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ScrollArea
        orientation="both"
        className="min-h-0 flex-1"
        viewportRef={edges.ref}
        viewportEdges={edges.edges}
        viewportClassName={cn(fadeStyles.fade, FILL_VIEWPORT)}
      >
        {children}
      </ScrollArea>
      {overlay}
    </div>
  );
}

interface BoardColumnsProps<T> {
  readonly board: KanbanBoardProps<T>;
  readonly active: T | undefined;
  readonly canDrop: (item: T, to: string) => boolean;
  readonly fill: boolean;
}

/** Οι στήλες με τις κάρτες τους — ίδιες σε `flow` και `fill`. */
function BoardColumns<T>({ board, active, canDrop, fill }: BoardColumnsProps<T>) {
  const { columns, items, getId, getLabel, getColumnId, renderCard, ariaLabel, emptyLabel, className, columnClassName } = board;
  const { canDrag = ALWAYS, activation = 'handle', collapsed = NONE, onCollapsedChange, columnHeaderClassName } = board;
  const groups = useMemo(() => groupByColumn(items, columns, getColumnId), [items, columns, getColumnId]);
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex gap-3', fill && 'flex-1 pb-4', className)}>
      {columns.map((column) => {
        const cards = groups.get(column.id) ?? [];
        const refusing = active !== undefined && column.id !== getColumnId(active) && !canDrop(active, column.id);
        return (
          <KanbanColumn
            key={column.id}
            column={column}
            count={cards.length}
            refusing={refusing}
            emptyLabel={emptyLabel}
            className={columnClassName}
            headerClassName={columnHeaderClassName}
            sticky={fill}
            collapsed={collapsed.has(column.id)}
            onCollapsedChange={onCollapsedChange ? (next) => onCollapsedChange(column.id, next) : undefined}
          >
            {cards.map((item) => (
              <KanbanCard key={getId(item)} id={getId(item)} label={getLabel(item)} disabled={!canDrag(item)} activation={activation}>
                {(handle) => renderCard(item, handle)}
              </KanbanCard>
            ))}
          </KanbanColumn>
        );
      })}
    </div>
  );
}

export function KanbanBoard<T>(props: KanbanBoardProps<T>) {
  const { canDrop = ALWAYS, layout = 'flow', getColumnId, dock: dockTargets, dockLabel, ariaLabel } = props;
  const { t } = useTranslation('common-shared');
  const sensors = useSortableSensors(columnKeyboardCoordinates);
  const { active, announcements, autoScroll, handlers } = useKanbanDrag({ ...props, canDrop });
  const fill = layout === 'fill';
  const refuses = (columnId: string) => active !== undefined && (columnId === getColumnId(active) || !canDrop(active, columnId));
  const board = <BoardColumns board={props} active={active} canDrop={canDrop} fill={fill} />;
  const dock = dockTargets && dockTargets.length > 0
    ? <KanbanDock targets={dockTargets} label={dockLabel ?? ariaLabel} visible={active !== undefined} refuses={refuses} />
    : null;
  // `flow` χωρίς ζώνη = ακριβώς το DOM που είχε πάντα (VariantLevelBoard, ADR-923): κανένα επιπλέον περιτύλιγμα.
  const body = fill ? <FillFrame overlay={dock}>{board}</FillFrame> : dock ? <div className="relative">{board}{dock}</div> : board;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={columnCollision}
      autoScroll={autoScroll}
      {...handlers}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('kanban.instructions') } }}
    >
      {body}
    </DndContext>
  );
}
