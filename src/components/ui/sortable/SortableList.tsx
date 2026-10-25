'use client';

/**
 * =============================================================================
 * ΤΟ ΕΝΑ ΑΝΑΔΙΑΤΑΣΣΟΜΕΝΟ ΣΤΟΙΧΕΙΟ ΛΙΣΤΑΣ (ADR-923 Φάση 1γ) — ποντίκι, αφή, πληκτρολόγιο, αναγνώστης οθόνης
 * =============================================================================
 *
 * Πάνω στο `@dnd-kit` (MIT): Space/Enter σηκώνει, βέλη μετακινούν, Space αφήνει, Esc ακυρώνει — και κάθε βήμα
 * ανακοινώνεται **στη γλώσσα του χρήστη** (`common:sortable.*`), όχι στα αγγλικά της βιβλιοθήκης.
 *
 * 🔑 **Η λίστα δεν αλλάζει σειρά μόνη της.** Αναφέρει τη μετακίνηση ως «ανάμεσα σε ποιους γείτονες»
 *    (`SortableListMove`) και ο ιδιοκτήτης των δεδομένων γράφει **ένα** κλειδί σειράς (`keyBetween`) — η νέα σειρά
 *    επιστρέφει από τα δεδομένα (αισιόδοξα, από τον καταναλωτή). Δεύτερη αποθήκη σειράς εδώ θα απέκλινε.
 * 🔑 **Η λαβή είναι κουμπί**, όχι ολόκληρη η γραμμή: η γραμμή κρατά τα δικά της κλικ (επιλογή, επεξεργασία).
 * ⚠️ Χωρίς `DragOverlay`/portal: το στοιχείο μετακινείται **επί τόπου** με transform, άρα καμία καθολική στρώση
 *    (κλίμακα z-index, ADR-780 / CHECK 3.50).
 *
 * @module components/ui/sortable/SortableList
 */

import React, { useCallback, useMemo } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { listMoveOf, type SortableListMove } from './sortable-model';
import { useDragTransform } from './use-drag-transform';

/** Απόσταση (px) πριν το πάτημα γίνει σύρσιμο — ώστε το απλό κλικ στη λαβή να μη μετακινεί τίποτα. */
const POINTER_ACTIVATION_DISTANCE = 4;

export interface SortableListProps<T> {
  readonly items: readonly T[];
  readonly getId: (item: T) => string;
  /** Το όνομα του στοιχείου για τον αναγνώστη οθόνης («Το «Ψύξη» μετακινήθηκε…»). */
  readonly getLabel: (item: T) => string;
  readonly onMove: (move: SortableListMove) => void;
  /** Το περιεχόμενο της γραμμής· η `handle` μπαίνει όπου θέλει ο καταναλωτής. */
  readonly renderItem: (item: T, handle: React.ReactNode) => React.ReactNode;
  /** Ετικέτα της λίστας (`aria-label`). */
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

/** Οι ανακοινώσεις, στη γλώσσα του χρήστη. Θέσεις 1-based, όπως τις λέει ο άνθρωπος. */
function useSortableAnnouncements(ids: readonly string[], labelOf: (id: string) => string): Announcements {
  const { t } = useTranslation('common');
  return useMemo(() => {
    const position = (id: string | number | undefined) => ids.indexOf(String(id)) + 1;
    const say = (key: string, activeId: string | number, overId?: string | number) =>
      t(key, { label: labelOf(String(activeId)), position: position(overId ?? activeId), total: ids.length });
    return {
      onDragStart: ({ active }) => say('sortable.picked', active.id),
      onDragOver: ({ active, over }) => (over ? say('sortable.over', active.id, over.id) : undefined),
      onDragEnd: ({ active, over }) => (over ? say('sortable.dropped', active.id, over.id) : undefined),
      onDragCancel: ({ active }) => say('sortable.cancelled', active.id),
    };
  }, [ids, labelOf, t]);
}

/** Αισθητήρες ποντικιού/αφής + πληκτρολογίου — κοινοί σε λίστα και δέντρο. */
export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

interface SortableRowProps {
  readonly id: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly children: (handle: React.ReactNode) => React.ReactNode;
}

function SortableRow({ id, label, disabled, children }: SortableRowProps) {
  const { t } = useTranslation('common');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="inline-flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={t('sortable.handle', { label })}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );
  const rowRef = useDragTransform(setNodeRef, transform, transition);
  return (
    <li ref={rowRef} className={cn('list-none', isDragging && 'relative opacity-80 shadow-md')}>
      {children(handle)}
    </li>
  );
}

export function SortableList<T>({
  items,
  getId,
  getLabel,
  onMove,
  renderItem,
  ariaLabel,
  disabled = false,
  className,
}: SortableListProps<T>) {
  const { t } = useTranslation('common');
  const sensors = useSortableSensors();
  const ids = useMemo(() => items.map(getId), [items, getId]);
  const labels = useMemo(() => new Map(items.map((item) => [getId(item), getLabel(item)])), [items, getId, getLabel]);
  const labelOf = useCallback((id: string) => labels.get(id) ?? id, [labels]);
  const announcements = useSortableAnnouncements(ids, labelOf);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over) return;
      const move = listMoveOf(ids, String(active.id), String(over.id));
      if (move) onMove(move);
    },
    [ids, onMove],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('sortable.instructions') } }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul aria-label={ariaLabel} className={cn('m-0 flex flex-col gap-1 p-0', className)}>
          {items.map((item) => {
            const id = getId(item);
            return (
              <SortableRow key={id} id={id} label={labelOf(id)} disabled={disabled}>
                {(handle) => renderItem(item, handle)}
              </SortableRow>
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
