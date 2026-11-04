'use client';

/**
 * @fileoverview **Κατανομή ιδιοτήτων σε επίπεδα παραλλαγών** — στήλες «Κοινά» · «Επίπεδο 1» · «Επίπεδο 2», με σύρσιμο
 *   ανάμεσά τους (Akeneo family variant · Revit type vs instance) (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/VariantLevelBoard
 *
 * 🔑 Πάνω στον ΕΝΑ πίνακα στηλών `@/components/ui/sortable/KanbanBoard` (ADR-930) — ίδιοι αισθητήρες, πλοήγηση
 *    πληκτρολογίου (←/→ ανά στήλη) και ανακοινώσεις με τη ροή πωλήσεων.
 * 🔑 **Δύο δρόμοι, ένα αποτέλεσμα**: σύρσιμο κάρτας σε στήλη (ποντίκι/αφή) **ή** ο επιλογέας επιπέδου πάνω στην κάρτα
 *    (πληκτρολόγιο, αναγνώστης οθόνης). Και οι δύο καλούν το **ίδιο** `placeAttribute`.
 * 🔑 Κάθε ιδιότητα σε **ένα** επίπεδο (κανόνας του επικυρωτή): η μετακίνηση την **αφαιρεί** από όλα πριν τη βάλει στο
 *    νέο. Οι άξονες ζουν αυτόματα στο επίπεδό τους — δεν εμφανίζονται ως κάρτες.
 */

import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KanbanBoard, type KanbanColumnDef } from '@/components/ui/sortable/KanbanBoard';
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

function AttributeCard({ name, column, columns, onPlace, disabled, handle }: {
  readonly name: string;
  readonly column: string;
  readonly columns: readonly KanbanColumnDef[];
  readonly onPlace: (column: string) => void;
  readonly disabled: boolean;
  readonly handle: React.ReactNode;
}) {
  const { t } = useCatalogText();
  return (
    <article className="flex items-center gap-1 rounded-md border bg-card px-1 py-1">
      {handle}
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <Select value={column} disabled={disabled} onValueChange={onPlace}>
        <SelectTrigger className="h-7 w-28 text-xs" aria-label={t('families.variants.levelOf', { name })}><SelectValue /></SelectTrigger>
        <SelectContent>{columns.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
    </article>
  );
}

export function VariantLevelBoard({ scheme, attributes, onChange, disabled }: BoardProps) {
  const { t, text } = useCatalogText();
  const axes = new Set(scheme.levels.flatMap((level) => level.axisAttributeIds));
  const cards = attributes.filter((attribute) => !axes.has(attribute.id));
  const columns: KanbanColumnDef[] = [
    { id: COMMON, label: t('families.variants.common') },
    ...scheme.levels.map((_, index) => ({ id: String(index), label: t('families.variants.level', { number: index + 1 }) })),
  ];
  const place = (attributeId: string, column: string) => onChange(placeAttribute(scheme, attributeId, column));
  const nameOf = (attribute: AttributeRecord) => text(attribute.labels, attribute.code);
  return (
    <KanbanBoard
      columns={columns}
      items={cards}
      getId={(attribute) => attribute.id}
      getLabel={nameOf}
      getColumnId={(attribute) => columnOf(scheme, attribute.id)}
      canDrag={() => !disabled}
      onMove={(attribute, _from, to) => place(attribute.id, to)}
      ariaLabel={t('families.variants.scheme')}
      className={columns.length === 3 ? 'grid gap-2 md:grid-cols-3' : 'grid gap-2 md:grid-cols-2'}
      columnClassName="min-h-24 border-dashed border-border p-2"
      renderCard={(attribute, handle) => (
        <AttributeCard name={nameOf(attribute)} column={columnOf(scheme, attribute.id)} columns={columns}
          disabled={disabled} onPlace={(target) => place(attribute.id, target)} handle={handle} />
      )}
    />
  );
}
