'use client';

/**
 * @fileoverview **Η σελίδα «Τιμοκατάλογοι»** (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @module components/catalog/pricing/PriceListsContent
 *
 * 🔑 **Οι τιμές ΜΟΝΟ από τον διακομιστή** (απόφαση Ζ): η όψη `lists` + η όψη `discounts` (ομάδες πελατών για το κοινό),
 *    ζωντανές με σήματα όψης (`usePricingView`) — καμία ανάγνωση Firestore για τιμές.
 * 🔑 **Αισιόδοξες εγγραφές πάνω στην όψη**: `useCatalogOptimistic(view.lists)`. Όσο εκκρεμεί εγγραφή, η ανανέωση της όψης
 *    **περιμένει** (`isHeld`) — αλλιώς θα έσβηνε την αισιόδοξη εικόνα πριν απαντήσει ο γραφέας· όταν αδειάσει η ουρά, `release()`.
 * 🔑 **Χωρίς δικαίωμα προβολής** ⇒ το λέμε με το **δικό** μας κλειδί (`pricing.noView`), όχι γενικό «δεν φορτώθηκε».
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?list=<κωδικός>`) — ο κωδικός είναι σταθερός από τη δημιουργία (το id τον ακολουθεί).
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Plus, Receipt } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useCatalogOptimistic, type CatalogOptimistic } from '@/hooks/catalog/useCatalogOptimistic';
import { useDiscountsView, usePriceListsView } from '@/hooks/catalog/usePriceListViews';
import type { PricingViewState } from '@/hooks/catalog/usePricingView';
import type { CatalogLoadState } from '@/hooks/catalog/useCatalogCollection';
import type { CustomerGroupWire, DiscountGroupWire, PriceListsView, PriceListWire } from '@/subapps/catalog/types/pricing-views';
import { useCatalogAccess, useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';
import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { CatalogSplit } from '../shared/CatalogSplit';
import { NEW_SELECTION, useCatalogSelection, type CatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard, type UnsavedGuard } from '../shared/use-unsaved-guard';
import { PriceListWorkspace } from './PriceListWorkspace';
import { PriceListList } from './PriceListList';

// 🔴 ADR-744 §18 — το `catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
import routeSlice from '@/i18n/generated/routes/o__workspace__catalog__price-lists.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

const NO_LISTS: readonly PriceListWire[] = [];
const NO_GROUPS: readonly CustomerGroupWire[] = [];
const NO_DISCOUNT_GROUPS: readonly DiscountGroupWire[] = [];

function loadStateOf<V>(current: PricingViewState<V>): CatalogLoadState {
  return current.state === 'failed' ? 'failed' : current.state;
}

/** Οι αισιόδοξες εγγραφές λιστών πάνω στην όψη, με το «κράτημα» της ανανέωσης όσο εκκρεμούν. */
function usePriceListsWorkspace() {
  const held = useRef(false);
  const isHeld = useCallback(() => held.current, []);
  const lists = usePriceListsView(isHeld);
  const discounts = useDiscountsView();
  const view: PriceListsView | null = lists.current.state === 'ready' ? lists.current.view : null;
  const ops = useCatalogOptimistic(view?.lists ?? NO_LISTS, useCatalogFailureNotice());
  held.current = ops.pendingKeys.size > 0;
  const { release } = lists;
  useEffect(() => { if (ops.pendingKeys.size === 0) release(); }, [ops.pendingKeys, release]);
  const groups = discounts.current.state === 'ready' ? discounts.current.view : null;
  const forbidden = lists.current.state === 'failed' && lists.current.failure.kind === 'forbidden';
  return { lists, view, ops, customerGroups: groups?.customerGroups ?? NO_GROUPS, discountGroups: groups?.discountGroups ?? NO_DISCOUNT_GROUPS, forbidden };
}

interface DetailsProps {
  readonly record: PriceListWire | undefined;
  readonly isNew: boolean;
  readonly view: PriceListsView;
  readonly ops: CatalogOptimistic<PriceListWire>;
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly nowMs: number;
  readonly revalidate: () => Promise<void>;
  readonly unsaved: UnsavedGuard;
  readonly selection: CatalogSelection;
}

function PriceListDetails({ record, isNew, view, ops, customerGroups, discountGroups, nowMs, revalidate, unsaved, selection }: DetailsProps) {
  const settled = isNew ? null : ops.settled.find((list) => list.code === record?.code) ?? null;
  if (!isNew && settled === null) return null;
  const hasVersions = settled !== null && view.versions.some((version) => version.priceListId === settled.id);
  return (
    <PriceListWorkspace
      key={selection.key}
      record={settled}
      versions={view.versions}
      nowMs={nowMs}
      discountGroups={discountGroups}
      revalidate={revalidate}
      lists={ops.view}
      hasVersions={hasVersions}
      customerGroups={customerGroups}
      ops={ops}
      onCreated={(code) => selection.selectIfCurrent(selection.key, code)}
      onDeleted={() => selection.select(null)}
      reportDirty={unsaved.reportDirty}
    />
  );
}

export function PriceListsContent() {
  const { t, text } = useCatalogText();
  const { lists, view, ops, customerGroups, discountGroups, forbidden } = usePriceListsWorkspace();
  const canManage = useCatalogAccess('pricing') === 'granted';
  const unsaved = useUnsavedGuard();
  const selection = useCatalogSelection('list');
  const { selected, select } = selection;
  const choose = useCallback((code: string | null) => unsaved.guard(() => select(code)), [unsaved, select]);
  const isNew = selected === NEW_SELECTION && canManage;
  const record = selected && !isNew ? ops.view.find((list) => list.code === selected) : undefined;
  // Το «τώρα» = η στιγμή της ανάγνωσης (`asOf`, ίδιο στιγμιότυπο με τα δεδομένα): ντετερμινιστικό, και η όψη ξαναδιαβάζεται
  // στο πρώτο μελλοντικό όριο (`freshUntil`), άρα η φάση «τρέχουσα/μελλοντική» δεν παλιώνει ποτέ.
  const nowMs = view ? Date.parse(view.asOf) : 0;
  const pendingIds = useMemo(() => new Set(ops.view.filter((list) => ops.pendingKeys.has(list.id)).map((list) => list.id)), [ops]);
  const title = isNew ? t('pricing.general.newTitle') : record ? text(record.labels, record.code) : '';
  return (
    <CatalogPageFrame
      title={t('pages.priceLists.title')}
      lead={t('pages.priceLists.lead')}
      state={forbidden ? 'ready' : loadStateOf(lists.current)}
      actions={canManage && view ? (
        <Button type="button" onClick={() => choose(NEW_SELECTION)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('pricing.list.newList')}</Button>
      ) : null}
    >
      {forbidden || view === null ? (
        <p className="m-0 text-muted-foreground" role="status">{t('pricing.noView')}</p>
      ) : (
        <CatalogSplit
          listLabel={t('pages.priceLists.title')}
          list={<PriceListList lists={ops.view} versions={view.versions} nowMs={nowMs} selectedCode={selected} pendingIds={pendingIds} onSelect={choose} />}
          open={isNew || record !== undefined}
          title={title}
          onClose={() => choose(null)}
          empty={{ icon: Receipt, title: t('pricing.list.emptyTitle'), description: t('pricing.list.emptyDescription') }}
          details={<PriceListDetails record={record} isNew={isNew} view={view} ops={ops} customerGroups={customerGroups} discountGroups={discountGroups}
            nowMs={nowMs} revalidate={lists.revalidate} unsaved={unsaved} selection={selection} />}
        />
      )}
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
