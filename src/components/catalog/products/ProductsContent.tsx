'use client';
/**
 * **`/catalog/products` — το ενιαίο πλέγμα προϊόντων και ο επεξεργαστής** (ADR-923 §5.10.4 Β2/Β3).
 *
 * Akeneo Serenity: μοντέλα **και** απλά προϊόντα σε μία λίστα, «Νέο», άνοιγμα σε σελίδα προϊόντος. Η επιλογή ζει στη
 * διεύθυνση (`?item=<id>` — το είδος βγαίνει από το πρόθεμα του id) ⇒ back/forward και κοινοποιήσιμος σύνδεσμος.
 * Τα φίλτρα επιβιώνουν από τη μετάβαση στον επεξεργαστή (το Content μένει προσαρτημένο).
 *
 * @module components/catalog/products/ProductsContent
 */

import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useCatalogRecompute } from '@/hooks/catalog/useCatalogRecompute';
import { CATALOG_CHANNELS } from '@/subapps/catalog/vocabulary/channels';

import { CatalogPageFrame } from '../shared/CatalogPageFrame';
import { RecomputePanel } from '../shared/RecomputePanel';
import { useCatalogCanManageProducts, useCatalogText } from '../shared/catalog-ui-hooks';
import { useCatalogSelection } from '../shared/use-catalog-selection';
import { useUnsavedGuard } from '../shared/use-unsaved-guard';
import { uniqueAttributeRefsOf } from './catalog-code-jump';
import { CodeJumpField } from './CodeJumpField';
import { NewProductDialog } from './NewProductDialog';
import { ProductListGrid } from './ProductListGrid';
import { ProductListToolbar, type ListScope } from './ProductListToolbar';
import { ProductEditorView } from './editor/ProductEditorView';
import { facetGroupsOf } from './product-facets';
import { useProductCatalogContext } from './use-product-catalog-context';
import { useProductList, type ProductListFilter } from './use-product-list';

// 🔴 ADR-744 §18 · ADR-923 §5.10.4 Β7 — το `catalog` ΔΕΝ είναι στο κέλυφος: χωρίς το slice, ωμά κλειδιά στο πρώτο καρέ.
// Καταχωρείται από client component (όχι από το `page.tsx`, που είναι Server Component).
import routeSlice from '@/i18n/generated/routes/o__workspace__catalog__products.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

function useScope(settings: ReturnType<typeof useProductCatalogContext>['settings']) {
  const [scope, setScope] = useState<ListScope | null>(null);
  const fallback = useMemo((): ListScope => {
    const channel = CATALOG_CHANNELS[0];
    return { channel, locale: settings.definition.channelLocales[channel][0] };
  }, [settings.definition]);
  // Κανάλι × γλώσσα που έπαψε να υπάρχει (άλλαξαν οι ρυθμίσεις) ⇒ πίσω στο πρώτο έγκυρο.
  const valid = scope && settings.definition.channelLocales[scope.channel].includes(scope.locale) ? scope : fallback;
  return [valid, setScope] as const;
}

function useListPart(ctx: ReturnType<typeof useProductCatalogContext>) {
  const [filter, setFilter] = useState<ProductListFilter>({ familyId: null, facets: [], sort: 'updated' });
  const list = useProductList({ filter, families: ctx.familyById, attributes: ctx.library.attributeById, settings: ctx.settings.definition });
  const family = filter.familyId ? ctx.familyById.get(filter.familyId) ?? null : null;
  const facetGroups = useMemo(() => (family ? facetGroupsOf(family, ctx.library.attributeById) : []), [family, ctx.library.attributeById]);
  const uniqueAttributes = useMemo(() => uniqueAttributeRefsOf(ctx.library.attributes), [ctx.library.attributes]);
  return { filter, setFilter, list, facetGroups, uniqueAttributes };
}

interface ListSectionProps {
  readonly ctx: ReturnType<typeof useProductCatalogContext>;
  readonly part: ReturnType<typeof useListPart>;
  readonly scope: ListScope;
  readonly onScope: (scope: ListScope) => void;
  readonly recompute: ReturnType<typeof useCatalogRecompute>;
  readonly onOpen: (id: string) => void;
}

/** Το άδειο πλέγμα ανά κατάσταση — η αποτυχία λέγεται ΜΙΑ φορά (το μήνυμα πάνω), όχι «κανένα προϊόν» από κάτω. */
const EMPTY_LIST_KEYS = { loading: 'common.loading', ready: 'products.list.empty', failed: 'products.list.unavailable' } as const;

function ProductListSection({ ctx, part, scope, onScope, recompute, onOpen }: ListSectionProps) {
  const { t } = useCatalogText();
  const { staleCount } = part.list;
  return (
    <section className="grid gap-4">
      <ProductListToolbar families={ctx.families} filter={part.filter} onFilter={part.setFilter} scope={scope} onScope={onScope}
        settings={ctx.settings.definition} facetGroups={part.facetGroups} />
      {staleCount > 0 || recompute.state.kind !== 'idle' ? (
        <RecomputePanel recompute={recompute} familyId={part.filter.familyId} needed={staleCount > 0}
          prompt={t('products.list.stale', { count: staleCount })} />
      ) : null}
      {part.list.state === 'failed' ? <p className="m-0 text-sm text-destructive" role="alert">{t('products.list.failed')}</p> : null}
      <ProductListGrid rows={part.list.rows} emptyText={t(EMPTY_LIST_KEYS[part.list.state])} families={ctx.familyById} assets={ctx.assetById} files={ctx.files.byId}
        channel={scope.channel} locale={scope.locale} facets={part.filter.facets} onOpen={(row) => onOpen(row.id)} />
      {part.list.hasMore ? <Button type="button" variant="outline" className="justify-self-center" onClick={part.list.grow}>{t('products.list.more')}</Button> : null}
    </section>
  );
}

export function ProductsContent() {
  const { t } = useCatalogText();
  const ctx = useProductCatalogContext();
  const canManage = useCatalogCanManageProducts();
  const unsaved = useUnsavedGuard();
  const recompute = useCatalogRecompute();
  const [newOpen, setNewOpen] = useState(false);
  const [scope, setScope] = useScope(ctx.settings);
  const { selected, select, key: session } = useCatalogSelection('item');
  const open = useCallback((id: string | null) => unsaved.guard(() => select(id)), [unsaved, select]);
  const part = useListPart(ctx);

  return (
    <CatalogPageFrame title={t('pages.products.title')} lead={t('pages.products.lead')} state={ctx.state}
      actions={selected ? null : (
        <span className="flex flex-wrap items-center gap-2">
          <CodeJumpField uniqueAttributes={part.uniqueAttributes} onFound={(target) => open(target.id)} />
          {canManage ? <Button type="button" onClick={() => setNewOpen(true)}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('products.new.button')}</Button> : null}
        </span>
      )}>
      {selected ? (
        <ProductEditorView key={session} id={selected} ctx={ctx} canManage={canManage} scope={scope} onScope={setScope}
          onOpen={(id) => open(id)} onBack={() => open(null)} reportDirty={unsaved.reportDirty} />
      ) : (
        <ProductListSection ctx={ctx} part={part} scope={scope} onScope={setScope} recompute={recompute} onOpen={(id) => open(id)} />
      )}
      {canManage ? <NewProductDialog open={newOpen} onOpenChange={setNewOpen} families={ctx.families} onCreated={(target) => open(target.id)} /> : null}
      {unsaved.dialog}
    </CatalogPageFrame>
  );
}
