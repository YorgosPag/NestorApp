'use client';

/**
 * @fileoverview **Η σελίδα «Ιδιότητες» του καταλόγου** — η βιβλιοθήκη ιδιοτήτων του χώρου (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/attributes/AttributesContent
 *
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?attribute=<id>` · `new`). Χωρίς ομάδες δεν υπάρχει πού να μπει ιδιότητα — η σελίδα
 *    το λέει και προσφέρει **μία** κίνηση: «Ομάδες».
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ListTree, Plus, Rows3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { SortableListMove } from '@/components/ui/sortable/sortable-model';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { useCatalogLibrary, type CatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { newEntityKey, optimisticWire, saveDefinition } from '../shared/catalog-actions';
import { orderKeyBetween } from '../shared/catalog-ordering';
import { useCatalogCanManage, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { CatalogSplit } from '../shared/CatalogSplit';
import { NEW_SELECTION, useCatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard } from '../shared/use-unsaved-guard';
import { attributeDraftOf, emptyAttributeDraft, storedAttributeOf } from './attribute-draft';
import { AttributeEditor } from './AttributeEditor';
import { AttributeGroupsDialog } from './AttributeGroupsDialog';
import { AttributeLibraryList } from './AttributeLibraryList';
import { useOrderKeyAtEnd } from './use-attribute-order';

/** Αναδιάταξη μέσα στην ομάδα: **μία** εγγραφή, αισιόδοξα. */
function useMoveAttribute(library: CatalogLibrary) {
  return useCallback(
    (siblings: readonly AttributeRecord[], move: SortableListMove) => {
      const attribute = siblings.find((item) => item.id === move.id);
      if (!attribute) return;
      const definition = { ...attributeDraftOf(attribute), orderKey: orderKeyBetween(siblings, move) };
      saveDefinition(library.ops.attributes, {
        kind: 'attribute',
        existing: attribute,
        definition,
        optimistic: optimisticWire(storedAttributeOf(definition), attribute, newEntityKey(definition.code)),
      });
    },
    [library.ops.attributes],
  );
}

/** Τι δείχνει η σελίδα τώρα: νέα ιδιότητα, υπάρχουσα, ή τίποτα — και η αφετηρία μιας νέας. */
function useAttributeSelection(library: CatalogLibrary, canManage: boolean, selected: string | null) {
  const { t, text } = useCatalogText();
  const orderKeyAtEndOf = useOrderKeyAtEnd(library.attributes);
  const isNew = selected === NEW_SELECTION && canManage && library.groups.length > 0;
  const record = selected && !isNew ? library.ops.attributes.settled.find((item) => item.id === selected) ?? null : null;
  const firstGroup = library.groups[0]?.id ?? '';
  const blank = useMemo(
    () => emptyAttributeDraft(firstGroup, orderKeyAtEndOf(firstGroup, null), library.registry),
    [firstGroup, orderKeyAtEndOf, library.registry],
  );
  const title = isNew ? t('attributes.new') : record ? text(record.labels, record.code) : '';
  return { isNew, record, blank, title, orderKeyAtEndOf };
}

export function AttributesContent() {
  const { t } = useCatalogText();
  const library = useCatalogLibrary(useCatalogFailureNotice());
  const families = useCatalogCollection('CATALOG_FAMILIES');
  const canManage = useCatalogCanManage();
  const unsaved = useUnsavedGuard();
  const [groupsOpen, setGroupsOpen] = useState(false);
  const { selected, select, key: session, selectIfCurrent } = useCatalogSelection('attribute');
  const choose = useCallback((id: string | null) => unsaved.guard(() => select(id)), [unsaved, select]);
  const moveAttribute = useMoveAttribute(library);
  const { isNew, record, blank, title, orderKeyAtEndOf } = useAttributeSelection(library, canManage, selected);
  const actions = canManage ? (
    <>
      <Button type="button" variant="outline" onClick={() => setGroupsOpen(true)}><Rows3 className="mr-1 h-4 w-4" aria-hidden />{t('attributes.groups.title')}</Button>
      <Button type="button" disabled={library.groups.length === 0} onClick={() => choose(NEW_SELECTION)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('attributes.new')}</Button>
    </>
  ) : null;
  return (
    <CatalogPageFrame title={t('pages.attributes.title')} lead={t('pages.attributes.lead')} state={library.state} actions={actions}>
      {library.groups.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('attributes.needGroup')}</p> : null}
      <CatalogSplit
        listLabel={t('pages.attributes.title')}
        list={<AttributeLibraryList attributes={library.attributes} groups={library.groups} selectedId={selected} pendingKeys={library.ops.attributes.pendingKeys} canManage={canManage} onSelect={choose} onMove={moveAttribute} />}
        open={isNew || record !== null}
        title={title}
        onClose={() => choose(null)}
        empty={{ icon: ListTree, title: t('attributes.emptyTitle'), description: t('attributes.emptyDescription') }}
        details={isNew || record ? (
          <AttributeEditor
            key={session}
            record={record}
            blank={blank}
            groups={library.groups}
            families={families.items}
            registry={library.registry}
            ops={library.ops.attributes}
            canManage={canManage}
            orderKeyAtEnd={orderKeyAtEndOf}
            onCreated={(created) => selectIfCurrent(session, created.id)}
            onDeleted={() => select(null)}
            reportDirty={unsaved.reportDirty}
          />
        ) : null}
      />
      <AttributeGroupsDialog open={groupsOpen} onOpenChange={setGroupsOpen} groups={library.groups} ops={library.ops.groups} canManage={canManage} />
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
