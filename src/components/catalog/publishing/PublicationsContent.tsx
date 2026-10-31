'use client';

/**
 * @fileoverview **Η σελίδα «Εκδόσεις καταλόγου»** — συνταγές και εκδόσεις PDF (ADR-923 §5.6.1).
 * @module components/catalog/publishing/PublicationsContent
 *
 * 🔑 **Όλα από τον διακομιστή**: η όψη `publications` (κριτής `pricingView`, γιατί μια έκδοση μπορεί να κουβαλά τιμές)·
 *    ζωντανή μόνο όσο τρέχει έκδοση (`usePublicationsView`: ρολόι 3 s που σβήνει μόλις τελειώσουν όλες).
 * 🔑 **Χωρίς δικαίωμα προβολής** ⇒ το λέμε με το **δικό** μας κλειδί (`pricing.noView`), όχι γενικό «δεν φορτώθηκε».
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?recipe=<κωδικός>`) — ο κωδικός είναι σταθερός από τη δημιουργία.
 */

import React, { useCallback, useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePublicationsView } from '@/hooks/catalog/usePublicationsView';
import type { PublicationRecipeWire, PublicationRunWire, PublicationsViewWire } from '@/subapps/catalog/types/publication';
import { useCatalogAccess, useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { CatalogSplit } from '../shared/CatalogSplit';
import { NEW_SELECTION, useCatalogSelection, type CatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard, type UnsavedGuard } from '../shared/use-unsaved-guard';
import { PublicationRecipeEditor } from './PublicationRecipeEditor';
import { PublicationRecipeList } from './PublicationRecipeList';
import { PublicationRunPanel } from './PublicationRunPanel';

// 🔴 ADR-744 §18 — το `catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/o__workspace__catalog__publications.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NO_RUNS: readonly PublicationRunWire[] = [];

interface DetailsProps {
  readonly record: PublicationRecipeWire | null;
  readonly runs: readonly PublicationRunWire[];
  readonly selection: CatalogSelection;
  readonly unsaved: UnsavedGuard;
  readonly revalidate: () => Promise<void>;
}

function PublicationDetails({ record, runs, selection, unsaved, revalidate }: DetailsProps) {
  const [dirty, setDirty] = useState(false);
  const { reportDirty } = unsaved;
  const report = useCallback((next: boolean) => { setDirty(next); reportDirty(next); }, [reportDirty]);
  return (
    <>
      {record === null ? null : <PublicationRunPanel recipeId={record.id} runs={runs} dirty={dirty} revalidate={revalidate} />}
      <PublicationRecipeEditor
        key={selection.key}
        record={record}
        revalidate={revalidate}
        onCreated={(code) => selection.selectIfCurrent(selection.key, code)}
        onDeleted={() => selection.select(null)}
        reportDirty={report}
      />
    </>
  );
}

function runsOf(view: PublicationsViewWire, record: PublicationRecipeWire | null): readonly PublicationRunWire[] {
  return record === null ? NO_RUNS : view.runs.filter((run) => run.recipeId === record.id);
}

export function PublicationsContent() {
  const { t, text } = useCatalogText();
  const api = usePublicationsView();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const unsaved = useUnsavedGuard();
  const selection = useCatalogSelection('recipe');
  const { selected, select } = selection;
  const choose = useCallback((code: string | null) => unsaved.guard(() => select(code)), [unsaved, select]);
  const view = api.current.state === 'ready' ? api.current.view : null;
  const forbidden = api.current.state === 'failed' && api.current.failure.kind === 'forbidden';
  const isNew = selected === NEW_SELECTION && canManage;
  const record = view !== null && selected !== null && !isNew ? view.recipes.find((recipe) => recipe.code === selected) ?? null : null;
  const title = isNew ? t('publishing.newRecipe') : record ? text(record.labels, record.code) : '';
  return (
    <CatalogPageFrame
      title={t('publishing.title')}
      lead={t('publishing.subtitle')}
      state={forbidden ? 'ready' : api.current.state}
      actions={canManage && view ? (
        <Button type="button" onClick={() => choose(NEW_SELECTION)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('publishing.newRecipe')}</Button>
      ) : null}
    >
      {forbidden || view === null ? (
        <p className="m-0 text-muted-foreground" role="status">{t('pricing.noView')}</p>
      ) : (
        <CatalogSplit
          listLabel={t('publishing.title')}
          list={<PublicationRecipeList recipes={view.recipes} selectedCode={selected} onSelect={choose} />}
          open={isNew || record !== null}
          title={title}
          onClose={() => choose(null)}
          empty={{ icon: BookOpen, title: t('publishing.title'), description: t('publishing.subtitle') }}
          details={isNew || record !== null ? (
            <PublicationDetails record={record} runs={runsOf(view, record)} selection={selection} unsaved={unsaved} revalidate={api.revalidate} />
          ) : null}
        />
      )}
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
