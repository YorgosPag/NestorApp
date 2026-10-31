'use client';

/**
 * @fileoverview **Η καρτέλα «Ανάλυση τιμής»** — «δες την τιμή σαν τον Χ», σύγκριση έως 4 κοινών, ιστορικό SKU
 *   (ADR-923 §5.11 «3δ» Τμήμα 3 · SAP pricing analysis).
 * @related use-price-analysis.ts · PriceQuoteCard.tsx · PriceHistoryList.tsx · server/catalog/price-quote.server.ts (η ΜΟΝΗ πηγή)
 * @module components/catalog/pricing/PriceAnalysisPanel
 *
 * 🔑 Ζει μέσα στη σελίδα «Εκπτώσεις»: εξηγεί ακριβώς όσα ορίζονται εκεί, και η όψη `discounts` δίνει ήδη τα ονόματα. Η όψη
 *    `lists` διαβάζεται μόνο όταν ανοίξει η καρτέλα (η ανενεργή καρτέλα αποσυνδέεται).
 * 🔑 Ο κωδικός επιλύεται με το **ίδιο** `useCatalogCodeResolver` των γραμμών τιμοκαταλόγου. Μοντέλο ≠ SKU: το λέμε.
 */

import React, { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { useCatalogCollection } from '@/hooks/catalog/useCatalogCollection';
import { usePriceListsView } from '@/hooks/catalog/usePriceListViews';
import { CatalogField } from '../shared/CatalogFormFields';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { MAX_ANALYSIS_VIEWERS, savingVersusBaseline } from './price-analysis';
import { PriceHistoryList } from './PriceHistoryList';
import { PriceQuoteCard } from './PriceQuoteCard';
import { SKU_LOOKUP_KEYS } from './pricing-labels';
import { usePriceAnalysis, type PriceAnalysis } from './use-price-analysis';
import { useAnalysisNames } from './use-price-analysis-names';
import type { DiscountsWorkspace } from './use-discounts-workspace';

/**
 * 🔴 Το κρυφό submit δεν είναι διακόσμηση: φόρμα με δύο πεδία κειμένου και χωρίς κουμπί υποβολής **δεν** υποβάλλεται με Enter
 * (HTML «implicit submission»), ενώ η οδηγία της οθόνης λέει «πατήστε Enter». Μετρημένο ζωντανά 2026-10-31.
 */
export function AnalysisQuery({ analysis }: { readonly analysis: Pick<PriceAnalysis, 'sku' | 'lookUp' | 'quantity' | 'setQuantity' | 'day' | 'setDay'> }) {
  const { t } = useCatalogText();
  const [code, setCode] = useState('');
  const { sku } = analysis;
  const hint = sku.state === 'ready' ? undefined : t(SKU_LOOKUP_KEYS[sku.state]);
  return (
    <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); void analysis.lookUp(code); }}>
      <CatalogField label={t('pricing.analysis.code')} hint={hint}>
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} value={code} onChange={(event) => setCode(event.target.value)}
            onBlur={() => void analysis.lookUp(code)} autoComplete="off" />
        )}
      </CatalogField>
      <CatalogField label={t('pricing.analysis.quantity')}>
        {({ id, describedBy }) => (
          <NumericField id={id} aria-describedby={describedBy} value={analysis.quantity} min={0} step={1} onValueChange={analysis.setQuantity} />
        )}
      </CatalogField>
      <CatalogField label={t('pricing.analysis.at')}>
        {({ id }) => <DatePickerField id={id} value={analysis.day} placeholder={t('pricing.analysis.now')} onSelect={analysis.setDay} />}
      </CatalogField>
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );
}

function AnalysisCards({ analysis, workspace, names }: {
  readonly analysis: PriceAnalysis;
  readonly workspace: DiscountsWorkspace;
  readonly names: ReturnType<typeof useAnalysisNames>;
}) {
  const { t } = useCatalogText();
  const { viewers, cells, busy, hasSubject } = analysis;
  return (
    <section className="flex flex-col gap-2" aria-label={t('pricing.analysis.viewers')}>
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {viewers.map((viewer, index) => (
          <li key={viewer.key} className="flex min-w-0 flex-col">
            <PriceQuoteCard viewer={viewer} cell={hasSubject ? cells[index] : null} saving={savingVersusBaseline(cells[index], cells[0])} busy={busy} names={names}
              customerGroups={workspace.customerGroups.view} removable={viewers.length > 1} onChange={analysis.change} onRemove={analysis.remove} />
          </li>
        ))}
      </ul>
      {viewers.length < MAX_ANALYSIS_VIEWERS ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={analysis.add}>
          <Plus className="h-4 w-4" aria-hidden />{t('pricing.analysis.addViewer')}
        </Button>
      ) : null}
    </section>
  );
}

export function PriceAnalysisPanel({ workspace }: { readonly workspace: DiscountsWorkspace }) {
  const { t } = useCatalogText();
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  const listsApi = usePriceListsView();
  const lists = listsApi.current.state === 'ready' ? listsApi.current.view : null;
  const revision = `${workspace.view?.freshness.revision ?? 0}:${lists?.freshness.revision ?? 0}`;
  const analysis = usePriceAnalysis({ attributes: attributes.items, revision });
  const names = useAnalysisNames(workspace, lists);
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" aria-label={t('pricing.discounts.tabs.analysis')}>
      <p className="m-0 text-sm text-muted-foreground">{t('pricing.analysis.lead')}</p>
      <AnalysisQuery analysis={analysis} />
      <AnalysisCards analysis={analysis} workspace={workspace} names={names} />
      {analysis.hasSubject ? <PriceHistoryList analysis={analysis} lists={lists?.lists ?? []} nowMs={workspace.nowMs} /> : null}
    </section>
  );
}
