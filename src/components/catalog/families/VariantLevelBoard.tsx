'use client';

/**
 * @fileoverview **Κατανομή ιδιοτήτων σε επίπεδα παραλλαγών** — στήλες «Κοινά» · «Επίπεδο 1» · «Επίπεδο 2», με σύρσιμο
 *   ανάμεσά τους (Akeneo family variant · Revit type vs instance) (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/VariantLevelBoard
 *
 * 🔑 **Δύο δρόμοι, ένα αποτέλεσμα**: σύρσιμο κάρτας σε στήλη (ποντίκι/αφή) **ή** ο επιλογέας επιπέδου πάνω στην κάρτα
 *    (πληκτρολόγιο, αναγνώστης οθόνης). Και οι δύο καλούν το **ίδιο** `placeAttribute`.
 * 🔑 Κάθε ιδιότητα σε **ένα** επίπεδο (κανόνας του επικυρωτή): η μετακίνηση την **αφαιρεί** από όλα πριν τη βάλει στο
 *    νέο. Οι άξονες ζουν αυτόματα στο επίπεδό τους — δεν εμφανίζονται ως κάρτες.
 */

import React from 'react';
import { DndContext, closestCenter, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSortableSensors } from '@/components/ui/sortable/SortableList';
import { useDragTransform } from '@/components/ui/sortable/use-drag-transform';
import { cn } from '@/lib/utils';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import type { VariantScheme } from '@/subapps/catalog/types/family';
import { useCatalogText } from '../shared/catalog-ui-hooks';

/** Στήλη: `common` ή ο δείκτης επιπέδου ως κείμενο. */
const COMMON = 'common';

export function placeAttribute(scheme: VariantScheme, attributeId: string, column: string): VariantScheme {
  return {
    ...scheme,
    levels: scheme.levels.map((level, index) => {
      const rest = level.attributeIds.filter((id) => id !== attributeId);
      return { ...level, attributeIds: String(index) === column ? [...rest, attributeId] : rest };
    }),
  };
}

function columnOf(scheme: VariantScheme, attributeId: string): string {
  const index = scheme.levels.findIndex((level) => level.attributeIds.includes(attributeId));
  return index === -1 ? COMMON : String(index);
}

interface BoardProps {
  readonly scheme: VariantScheme;
  readonly attributes: readonly AttributeRecord[];
  readonly onChange: (scheme: VariantScheme) => void;
  readonly disabled: boolean;
}

function AttributeCard({ attribute, column, columns, onPlace, disabled }: {
  readonly attribute: AttributeRecord;
  readonly column: string;
  readonly columns: readonly { readonly key: string; readonly label: string }[];
  readonly onPlace: (column: string) => void;
  readonly disabled: boolean;
}) {
  const { t, text } = useCatalogText();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: attribute.id, disabled });
  const ref = useDragTransform(setNodeRef, transform, undefined);
  const name = text(attribute.labels, attribute.code);
  return (
    <li ref={ref} className={cn('flex list-none items-center gap-1 rounded-md border bg-card px-1 py-1', isDragging && 'relative opacity-80 shadow-md')}>
      <button type="button" className="inline-flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground disabled:cursor-not-allowed" aria-label={t('families.variants.dragOf', { name })} disabled={disabled} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <Select value={column} disabled={disabled} onValueChange={onPlace}>
        <SelectTrigger className="h-7 w-28 text-xs" aria-label={t('families.variants.levelOf', { name })}><SelectValue /></SelectTrigger>
        <SelectContent>{columns.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </li>
  );
}

function BoardColumn({ id, label, children }: { readonly id: string; readonly label: string; readonly children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={label} className={cn('flex min-h-24 min-w-0 flex-col gap-1 rounded-md border border-dashed p-2', isOver && 'border-primary bg-accent/40')}>
      <h4 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h4>
      <ul className="m-0 flex flex-col gap-1 p-0">{children}</ul>
    </section>
  );
}

export function VariantLevelBoard({ scheme, attributes, onChange, disabled }: BoardProps) {
  const { t } = useCatalogText();
  const sensors = useSortableSensors();
  const axes = new Set(scheme.levels.flatMap((level) => level.axisAttributeIds));
  const cards = attributes.filter((attribute) => !axes.has(attribute.id));
  const columns = [
    { key: COMMON, label: t('families.variants.common') },
    ...scheme.levels.map((_, index) => ({ key: String(index), label: t('families.variants.level', { number: index + 1 }) })),
  ];
  const place = (attributeId: string, column: string) => onChange(placeAttribute(scheme, attributeId, column));
  const onDragEnd = ({ active, over }: DragEndEvent) => { if (over) place(String(active.id), String(over.id)); };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
      accessibility={{ screenReaderInstructions: { draggable: t('families.variants.dragInstructions') } }}>
      <div className={cn('grid gap-2', columns.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {columns.map((column) => (
          <BoardColumn key={column.key} id={column.key} label={column.label}>
            {cards.filter((attribute) => columnOf(scheme, attribute.id) === column.key).map((attribute) => (
              <AttributeCard key={attribute.id} attribute={attribute} column={column.key} columns={columns} disabled={disabled} onPlace={(target) => place(attribute.id, target)} />
            ))}
          </BoardColumn>
        ))}
      </div>
    </DndContext>
  );
}
