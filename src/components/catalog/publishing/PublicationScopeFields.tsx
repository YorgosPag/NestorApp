'use client';

/**
 * @fileoverview **Το εύρος της έκδοσης** — όλος ο κατάλογος ή επιλεγμένες κατηγορίες (ADR-923 §5.6.1).
 * @module components/catalog/publishing/PublicationScopeFields
 *
 * 🔑 Το εύρος `selection` (χειροκίνητη επιλογή μοντέλων) **δεν έχει επιλογέα ακόμη**: δεν προσφέρεται ως νέα επιλογή.
 *    Συνταγή που ήδη το έχει το δείχνει (ώστε η φόρμα να μην λέει ψέματα για το τι θα εκδοθεί) αλλά δεν το αλλάζει σιωπηλά.
 * 🔑 Οι κατηγορίες διαβάζονται από την ίδια ζωντανή συλλογή με τη σελίδα «Κατηγορίες» — καμία δεύτερη ανάγνωση.
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { EnumSelect } from '@/components/ui/enum-select';
import { Label } from '@/components/ui/label';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { PUBLICATION_SCOPE_KINDS, type PublicationScopeKind } from '@/subapps/catalog/publishing/publication-vocabulary';
import type { PublicationScope } from '@/subapps/catalog/types/publication';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { FieldIssues } from '../shared/CatalogIssues';
import type { PublicationFieldsProps } from './publication-draft';

const OFFERED_KINDS: readonly PublicationScopeKind[] = PUBLICATION_SCOPE_KINDS.filter((kind) => kind !== 'selection');

/** Ένα νέο εύρος του είδους `kind` — κρατά ό,τι ήδη ταιριάζει. */
function scopeOfKind(kind: PublicationScopeKind, previous: PublicationScope): PublicationScope {
  if (previous.kind === kind) return previous;
  switch (kind) {
    case 'all': return { kind };
    case 'categories': return { kind, categoryIds: [] };
    case 'selection': return { kind, entries: [] };
  }
}

function CategoryChoices({ selected, disabled, onChange }: {
  readonly selected: readonly string[];
  readonly disabled: boolean;
  readonly onChange: (categoryIds: readonly string[]) => void;
}) {
  const { t, text } = useCatalogText();
  const baseId = useId();
  const categories = useCatalogCollection('CATALOG_CATEGORIES').items;
  const sorted = [...categories].sort((a, b) => a.code.localeCompare(b.code));
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label={t('publishing.scope.categories')}>
      {sorted.map((category) => (
        <li key={category.id} className="flex items-center gap-2">
          <Checkbox id={`${baseId}-${category.id}`} checked={selected.includes(category.id)} disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true ? [...selected, category.id] : selected.filter((id) => id !== category.id))} />
          <Label htmlFor={`${baseId}-${category.id}`}>{text(category.labels, category.code)}</Label>
        </li>
      ))}
    </ul>
  );
}

export function PublicationScopeFields({ draft, onChange, issues, disabled }: PublicationFieldsProps) {
  const { t } = useCatalogText();
  const { scope } = draft;
  const values = scope.kind === 'selection' ? PUBLICATION_SCOPE_KINDS : OFFERED_KINDS;
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <CatalogField label={t('publishing.fields.scope')}>
        {({ id }) => (
          <EnumSelect id={id} value={scope.kind} values={values} disabled={disabled}
            getLabel={(kind) => t(`publishing.scope.${kind}`)}
            onValueChange={(kind) => onChange({ ...draft, scope: scopeOfKind(kind, scope) })} />
        )}
      </CatalogField>
      {scope.kind === 'categories' ? (
        <CategoryChoices selected={scope.categoryIds} disabled={disabled}
          onChange={(categoryIds) => onChange({ ...draft, scope: { kind: 'categories', categoryIds } })} />
      ) : null}
      <FieldIssues issues={issues} path="scope" />
    </section>
  );
}
