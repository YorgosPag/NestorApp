'use client';

/**
 * @fileoverview **Η σελίδα «Οικογένειες προϊόντων» του καταλόγου** (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/FamiliesContent
 *
 * 🔑 Η βιβλιοθήκη (ιδιότητες · ομάδες · μονάδες) φορτώνεται **μαζί** με τις οικογένειες: ο επεξεργαστής επικυρώνει
 *    απέναντι σε αυτήν, και η «νέα ιδιότητα επί τόπου» τη μεγαλώνει χωρίς έξοδο από τη σελίδα.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?family=<id>` · `new`).
 */

import React, { useCallback, useMemo } from 'react';
import { Boxes, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { combineLoadStates, useCatalogLibrary } from '@/hooks/catalog/useCatalogLibrary';
import { useCatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { compareByLocale } from '@/lib/intl-formatting';
import type { FamilyRecord } from '@/services/catalog/catalog-api.client';
import { useCatalogCanManage, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogListItem } from '../shared/CatalogList';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { CatalogSplit } from '../shared/CatalogSplit';
import { NEW_SELECTION, useCatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard } from '../shared/use-unsaved-guard';
import { FamilyEditor } from './FamilyEditor';

function useFamilies() {
  const notice = useCatalogFailureNotice();
  const library = useCatalogLibrary(notice);
  const collection = useCatalogCollection('CATALOG_FAMILIES');
  const ops = useCatalogOptimistic(collection.items, notice);
  const { text } = useCatalogText();
  const sorted = useMemo(() => [...ops.view].sort((a, b) => compareByLocale(text(a.labels, a.code), text(b.labels, b.code))), [ops.view, text]);
  return { library, ops, sorted, state: combineLoadStates([library.state, collection.state]) };
}

function FamilyList({ families, selectedId, pendingKeys, onSelect }: {
  readonly families: readonly FamilyRecord[];
  readonly selectedId: string | null;
  readonly pendingKeys: ReadonlySet<string>;
  readonly onSelect: (id: string) => void;
}) {
  const { t, text } = useCatalogText();
  if (families.length === 0) return <p className="m-0 px-2 text-sm text-muted-foreground">{t('families.none')}</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
      {families.map((family) => (
        <li key={family.id}>
          <CatalogListItem
            icon={Boxes}
            primary={text(family.labels, family.code)}
            secondary={`${family.code} · ${t('families.summary', { attributes: family.attributes.length, schemes: family.variantSchemes.length })}`}
            selected={family.id === selectedId}
            pending={pendingKeys.has(family.id)}
            onSelect={() => onSelect(family.id)}
          />
        </li>
      ))}
    </ul>
  );
}

export function FamiliesContent() {
  const { t, text } = useCatalogText();
  const { library, ops, sorted, state } = useFamilies();
  const canManage = useCatalogCanManage();
  const unsaved = useUnsavedGuard();
  const { selected, select, key: session, selectIfCurrent } = useCatalogSelection('family');
  const choose = useCallback((id: string | null) => unsaved.guard(() => select(id)), [unsaved, select]);
  const isNew = selected === NEW_SELECTION && canManage;
  const record = selected && !isNew ? ops.settled.find((family) => family.id === selected) ?? null : null;
  const title = isNew ? t('families.new') : record ? text(record.labels, record.code) : '';
  return (
    <CatalogPageFrame
      title={t('pages.families.title')}
      lead={t('pages.families.lead')}
      state={state}
      actions={canManage ? <Button type="button" onClick={() => choose(NEW_SELECTION)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('families.new')}</Button> : null}
    >
      <CatalogSplit
        listLabel={t('pages.families.title')}
        list={<FamilyList families={sorted} selectedId={selected} pendingKeys={ops.pendingKeys} onSelect={choose} />}
        open={isNew || record !== null}
        title={title}
        onClose={() => choose(null)}
        empty={{ icon: Boxes, title: t('families.emptyTitle'), description: t('families.emptyDescription') }}
        details={isNew || record ? (
          <FamilyEditor
            key={session}
            record={record}
            families={ops.settled}
            library={library}
            ops={ops}
            canManage={canManage}
            onCreated={(id) => selectIfCurrent(session, id)}
            onDeleted={() => select(null)}
            reportDirty={unsaved.reportDirty}
          />
        ) : null}
      />
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
