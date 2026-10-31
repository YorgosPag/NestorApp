'use client';

/**
 * @fileoverview **Το «γιατί αυτή η τιμή»** — κάθε λίστα και κάθε συνθήκη με την ετυμηγορία της (ADR-923 §5.11 «3δ» Τμήμα 3 ·
 *   SAP pricing analysis).
 * @related price-analysis.ts (`bucketTrace`) · lib/pricing/select-condition.ts (το ίχνος της ΜΙΑΣ μηχανής)
 * @module components/catalog/pricing/PriceTrace
 *
 * 🔑 Η ετυμηγορία λέγεται με **λέξη και εικονίδιο** (CHECK 3.41), ποτέ μόνο με χρώμα.
 * 🔑 Όσες αφορούν άλλο κοινό **μετρούνται**, δεν απαριθμούνται: σε χώρο με εκατοντάδες συνθήκες θα έθαβαν το αποτέλεσμα.
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import { bucketTrace, type AnalysisTraceEntry } from './price-analysis';
import { SELECTION_VERDICT_ICONS, SELECTION_VERDICT_KEYS } from './pricing-labels';

function TraceRow({ entry, name }: { readonly entry: AnalysisTraceEntry; readonly name: string }) {
  const { t } = useCatalogText();
  const Icon = SELECTION_VERDICT_ICONS[entry.verdict];
  return (
    <li className="flex min-w-0 items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">{t(SELECTION_VERDICT_KEYS[entry.verdict])}</span>
        {' — '}
        <span className="break-words text-muted-foreground">{name}</span>
      </span>
    </li>
  );
}

function TraceGroup({ title, trace, nameOf, empty }: {
  readonly title: string;
  readonly trace: readonly AnalysisTraceEntry[];
  readonly nameOf: (id: string) => string;
  readonly empty: string;
}) {
  const { t } = useCatalogText();
  const { relevant, inactive, unrelatedCount } = bucketTrace(trace);
  const shown = [...relevant, ...inactive];
  return (
    <section className="flex flex-col gap-1">
      <h5 className="m-0 text-xs font-semibold text-muted-foreground">{title}</h5>
      {shown.length === 0 ? <p className="m-0 text-xs text-muted-foreground">{empty}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {shown.map((entry) => <TraceRow key={entry.id} entry={entry} name={nameOf(entry.id)} />)}
      </ul>
      {unrelatedCount > 0 ? <p className="m-0 text-xs text-muted-foreground">{t('pricing.analysis.trace.unrelated', { count: unrelatedCount })}</p> : null}
    </section>
  );
}

interface PriceTraceProps {
  readonly listTrace: readonly AnalysisTraceEntry[];
  readonly conditionTrace: readonly AnalysisTraceEntry[];
  readonly listName: (id: string) => string;
  readonly conditionName: (id: string) => string;
}

export function PriceTrace({ listTrace, conditionTrace, listName, conditionName }: PriceTraceProps) {
  const { t } = useCatalogText();
  return (
    <Collapsible className="flex flex-col gap-2 border-t pt-2">
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium">
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        {t('pricing.analysis.trace.title')}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2">
        <TraceGroup title={t('pricing.analysis.trace.lists')} trace={listTrace} nameOf={listName} empty={t('pricing.analysis.trace.listExplicit')} />
        <TraceGroup title={t('pricing.analysis.trace.conditions')} trace={conditionTrace} nameOf={conditionName} empty={t('pricing.analysis.trace.noConditions')} />
      </CollapsibleContent>
    </Collapsible>
  );
}
