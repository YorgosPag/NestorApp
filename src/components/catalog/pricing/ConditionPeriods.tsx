'use client';

/**
 * @fileoverview **Οι περίοδοι ενός κελιού** — τρέχουσα · μελλοντικές · ληγμένες, και «Νέα περίοδος» (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related condition-matrix.ts (`MatrixCell.entries`, ήδη ταξινομημένες) · ConditionsPanel.tsx (ο γονέας)
 * @module components/catalog/pricing/ConditionPeriods
 *
 * SAP VK13: μια υποδοχή «ομάδα × κοινό» έχει **πολλές** εγγραφές με διαδοχική ισχύ («−10% τον Νοέμβριο», μετά «−5%»). Εδώ
 * φαίνονται όλες μαζί, με τη λέξη της ισχύος (όχι μόνο χρώμα, CHECK 3.41), και η επιλογή ανοίγει την καθεμία.
 */

import React from 'react';
import { AlertTriangle, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCatalogText } from '../shared/catalog-ui-hooks';
import type { MatrixCell } from './condition-matrix';
import { VALIDITY_VERDICT_BADGES, VALIDITY_VERDICT_ICONS, VALIDITY_VERDICT_KEYS } from './pricing-labels';
import type { DiscountWords } from './use-discount-words';

interface ConditionPeriodsProps {
  readonly cell: MatrixCell | undefined;
  readonly selectedId: string | null;
  readonly words: DiscountWords;
  readonly onOpen: (id: string) => void;
  readonly onNew: (() => void) | null;
}

export function ConditionPeriods({ cell, selectedId, words, onOpen, onNew }: ConditionPeriodsProps) {
  const { t } = useCatalogText();
  const entries = (cell?.entries ?? []).filter((entry) => !entry.isDraft);
  return (
    <section className="flex flex-col gap-2 border-b px-4 py-3" aria-label={t('pricing.discounts.periods.title')}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pricing.discounts.periods.title')}</h3>
        {onNew ? <Button type="button" size="sm" variant="outline" onClick={onNew}><Plus className="mr-1 h-4 w-4" aria-hidden />{t('pricing.discounts.periods.new')}</Button> : null}
      </header>
      {entries.length === 0 ? <p className="m-0 text-sm text-muted-foreground">{t('pricing.discounts.periods.empty')}</p> : (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {entries.map((entry) => {
            const Icon = VALIDITY_VERDICT_ICONS[entry.verdict];
            const selected = entry.id === selectedId;
            return (
              <li key={entry.id}>
                <button type="button" aria-current={selected ? 'true' : undefined} onClick={() => onOpen(entry.id)}
                  className={cn('flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50', entry.ambiguous && 'ring-1 ring-destructive')}>
                  <Badge variant={VALIDITY_VERDICT_BADGES[entry.verdict]} className="gap-1"><Icon className="h-3 w-3" aria-hidden />{t(VALIDITY_VERDICT_KEYS[entry.verdict])}</Badge>
                  <span className="font-medium tabular-nums">{words.rule(entry.definition.rule)}</span>
                  <span className="text-muted-foreground">{words.period(entry.definition)}</span>
                  {entry.definition.audience.kind === 'partner' ? <span className="text-muted-foreground">{words.audience(entry.definition.audience)}</span> : null}
                  {entry.ambiguous ? <span className="flex items-center gap-0.5 text-xs font-medium text-destructive"><AlertTriangle className="h-3 w-3" aria-hidden />{t('pricing.discounts.matrix.ambiguous')}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
