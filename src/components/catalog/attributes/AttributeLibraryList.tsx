'use client';

/**
 * @fileoverview **Η βιβλιοθήκη ιδιοτήτων, σε ομάδες** — αναδιάταξη μέσα στην ομάδα, αναζήτηση (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/attributes/AttributeLibraryList
 *
 * 🔑 Η αναδιάταξη γράφει **μία** ιδιότητα (νέο κλειδί ανάμεσα στους γείτονες) — αισιόδοξα.
 * ⚠️ Όσο η αναζήτηση **φιλτράρει**, το σύρσιμο κλειδώνει: οι ορατοί γείτονες δεν είναι οι πραγματικοί, και ένα κλειδί
 *    «ανάμεσά τους» θα πηδούσε πάνω από κρυμμένες ιδιότητες.
 * 🔑 Ιδιότητα σε ομάδα που δεν υπάρχει πια φαίνεται σε «Χωρίς ομάδα» — ποτέ αόρατη.
 */

import React, { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { SortableList } from '@/components/ui/sortable/SortableList';
import type { SortableListMove } from '@/components/ui/sortable/sortable-model';
import type { AttributeGroupRecord, AttributeRecord } from '@/services/catalog/catalog-api.client';
import { normalizeForSearch } from '@/utils/greek-text';
import { ATTRIBUTE_TYPE_ICONS, ATTRIBUTE_TYPE_KEYS } from '../shared/catalog-labels';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogListItem, CatalogListSection } from '../shared/CatalogList';

interface AttributeLibraryListProps {
  readonly attributes: readonly AttributeRecord[];
  readonly groups: readonly AttributeGroupRecord[];
  readonly selectedId: string | null;
  readonly pendingKeys: ReadonlySet<string>;
  readonly canManage: boolean;
  readonly onSelect: (id: string) => void;
  /** Μετακίνηση μέσα στην ομάδα: τα αδέλφια (ταξινομημένα) και οι γείτονες. */
  readonly onMove: (siblings: readonly AttributeRecord[], move: SortableListMove) => void;
}

interface Section {
  readonly key: string;
  readonly title: string;
  readonly items: readonly AttributeRecord[];
}

function useSections(attributes: readonly AttributeRecord[], groups: readonly AttributeGroupRecord[], query: string): Section[] {
  const { t, text } = useCatalogText();
  return useMemo(() => {
    const needle = normalizeForSearch(query);
    const matches = (attribute: AttributeRecord) =>
      needle.length === 0 || normalizeForSearch(`${text(attribute.labels)} ${attribute.code}`).includes(needle);
    const known = new Set(groups.map((group) => group.id));
    const sections: Section[] = groups.map((group) => ({
      key: group.id,
      title: text(group.labels, group.code),
      items: attributes.filter((attribute) => attribute.groupId === group.id && matches(attribute)),
    }));
    const orphans = attributes.filter((attribute) => !known.has(attribute.groupId) && matches(attribute));
    if (orphans.length > 0) sections.push({ key: 'orphans', title: t('attributes.noGroup'), items: orphans });
    return needle.length === 0 ? sections : sections.filter((section) => section.items.length > 0);
  }, [attributes, groups, query, t, text]);
}

export function AttributeLibraryList({ attributes, groups, selectedId, pendingKeys, canManage, onSelect, onMove }: AttributeLibraryListProps) {
  const { t, text } = useCatalogText();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const sections = useSections(attributes, groups, query);
  const filtering = query.trim().length > 0;
  const row = (attribute: AttributeRecord, handle?: React.ReactNode) => (
    <CatalogListItem
      handle={handle}
      icon={ATTRIBUTE_TYPE_ICONS[attribute.type]}
      primary={text(attribute.labels, attribute.code)}
      secondary={`${attribute.code} · ${t(ATTRIBUTE_TYPE_KEYS[attribute.type])}`}
      selected={attribute.id === selectedId}
      pending={pendingKeys.has(attribute.id)}
      onSelect={() => onSelect(attribute.id)}
    />
  );
  return (
    <>
      <label htmlFor={searchId} className="flex items-center gap-2 px-2 pb-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">{t('attributes.search')}</span>
        <Input id={searchId} type="search" placeholder={t('attributes.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {sections.length === 0 ? <p className="m-0 px-2 text-sm text-muted-foreground">{t('attributes.noResults')}</p> : null}
      {sections.map((section) => (
        <CatalogListSection key={section.key} title={section.title} count={section.items.length}>
          {section.items.length === 0 ? (
            <p className="m-0 px-2 text-xs text-muted-foreground">{t('attributes.emptyGroup')}</p>
          ) : (
            <SortableList
              items={section.items}
              getId={(attribute) => attribute.id}
              getLabel={(attribute) => text(attribute.labels, attribute.code)}
              ariaLabel={section.title}
              disabled={!canManage || filtering}
              onMove={(move) => onMove(section.items, move)}
              renderItem={(attribute, handle) => row(attribute, canManage && !filtering ? handle : undefined)}
            />
          )}
        </CatalogListSection>
      ))}
    </>
  );
}
