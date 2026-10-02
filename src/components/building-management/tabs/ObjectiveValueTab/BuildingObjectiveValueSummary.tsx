'use client';

/**
 * @fileoverview **Η σύνοψη της καρτέλας «Αντικειμενική»** (ADR-898 Φ4β): το σύνολο του κτιρίου — **μόνο** όταν είναι
 * αληθινό — η ημέρα αποτίμησης, και ποιες απαντήσεις του κτιρίου ξεκλειδώνουν μονάδες.
 * @module components/building-management/tabs/ObjectiveValueTab/BuildingObjectiveValueSummary
 *
 * 🔑 **Ποτέ μερικό άθροισμα ως σύνολο** (ADR-898 §4.2): ελλιπές ⇒ «λείπουν Ν από Μ», κανένα ποσό.
 * 🔑 `refreshing` ⇒ το ποσό είναι της προηγούμενης ανάγνωσης: φαίνεται **αχνό** και ο αναγνώστης οθόνης ακούει
 *   «επανυπολογισμός» — ποτέ παλιό ποσό ως τρέχον.
 */

import React, { useId } from 'react';

import { Button } from '@/components/ui/button';
import { formatCalendarDay, formatCurrency } from '@/lib/intl-formatting';
import type { BuildingObjectiveValues } from '@/lib/objective-value/building-objective-values-contract';
import type { BuildingFactQuestion } from '@/lib/objective-value/building-objective-value-questions';
import { cn } from '@/lib/utils';

import type { BuildingObjectiveValueLabels } from './useBuildingObjectiveValueLabels';

const B = 'objective-value:building';

interface SummaryProps {
  readonly data: BuildingObjectiveValues;
  readonly refreshing: boolean;
  readonly labels: BuildingObjectiveValueLabels;
  readonly onGoToFact: (fact: BuildingFactQuestion) => void;
  /** Ενέργειες της κεφαλίδας (π.χ. εξαγωγή). */
  readonly actions?: React.ReactNode;
}

function Total({ data, refreshing, labels }: Pick<SummaryProps, 'data' | 'refreshing' | 'labels'>) {
  const { t } = labels;
  const { total } = data;
  if (total.kind === 'incomplete') {
    return <p className="m-0 text-sm text-foreground">{t(`${B}.total.incomplete`, { pending: total.pending, units: total.units })}</p>;
  }
  if (total.units === 0) return <p className="m-0 text-sm text-muted-foreground">{t(`${B}.total.none`)}</p>;
  return (
    <p className="m-0 flex flex-wrap items-baseline gap-2">
      <span className={cn('text-2xl font-semibold tabular-nums text-foreground', refreshing && 'opacity-60')}>{formatCurrency(total.value)}</span>
      <span className="text-sm text-muted-foreground">{t(`${B}.total.units`, { count: total.units })}</span>
    </p>
  );
}

function Questions({ data, labels, onGoToFact }: Pick<SummaryProps, 'data' | 'labels' | 'onGoToFact'>) {
  const { t } = labels;
  const headingId = useId();
  if (data.questions.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2 rounded-md border border-border bg-muted p-3">
      <h4 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${B}.questions.title`)}</h4>
      <p className="m-0 text-sm text-muted-foreground">{t(`${B}.questions.summary`, { count: data.questions.length })}</p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {data.questions.map(({ fact, units }) => (
          <li key={fact}>
            <Button type="button" variant="outline" size="sm" onClick={() => onGoToFact(fact)}>
              {t(`${B}.questions.facts.${fact}`)} · {t(`${B}.facts.waiting`, { count: units })}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BuildingObjectiveValueSummary({ data, refreshing, labels, onGoToFact, actions }: SummaryProps) {
  const { t } = labels;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} aria-busy={refreshing} className="flex flex-col gap-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <hgroup className="flex flex-col gap-1">
          <h3 id={headingId} className="m-0 text-sm font-medium text-muted-foreground">{t(`${B}.total.label`)}</h3>
          {/* `role="status"` και όχι `<output>`: το σύνολο είναι παράγραφος, που το `<output>` δεν δέχεται. */}
          <div role="status" className="flex flex-col gap-1">
            <Total data={data} refreshing={refreshing} labels={labels} />
          </div>
          <p className="m-0 text-xs text-muted-foreground">
            {t(`${B}.valuationDate`, { date: formatCalendarDay(data.valuationDate, true) })}
            {refreshing && <span className="ml-2">{t(`${B}.refreshing`)}</span>}
          </p>
        </hgroup>
        {actions}
      </header>
      <Questions data={data} labels={labels} onGoToFact={onGoToFact} />
    </section>
  );
}
