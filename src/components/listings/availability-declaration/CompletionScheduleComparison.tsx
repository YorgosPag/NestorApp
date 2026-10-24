'use client';

/**
 * **Σχέδιο · πρόβλεψη · υπόσχεση** — η τριπλή σύγκριση του κτιρίου, μόνο εσωτερικά (ADR-919 §11).
 *
 * @related services/construction-scheduling/completion-promise-check.ts
 *
 * 🔑 Τρεις ημερομηνίες που η αγορά κρατά σε τρία εργαλεία: το **σχέδιο** (P6 baseline / `completionDate`), την
 * **πρόβλεψη** (P6 forecast με ημερομηνία κατάστασης, ADR-919 §6) και την **υπόσχεση** προς το κοινό (P6 «Must Finish
 * By»). Εδώ στέκονται δίπλα-δίπλα, και ό,τι αποκλίνει **ονομάζεται** με λόγια, όχι με χρώμα μόνο.
 *
 * ⛔ Τίποτα από εδώ δεν φεύγει στο κοινό (ADR-777 §8.99.4 «Ιδιωτικότητα»).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate } from '@/lib/intl-formatting';
import { getCurrentLocale } from '@/lib/intl-utils';
import type { CompletionForecast } from '@/services/construction-scheduling/completion-forecast';
import type { CompletionPromiseSignal } from '@/services/construction-scheduling/completion-promise-check';

const NS = ['building'];

interface ComparisonProps {
  readonly planned: string | null;
  readonly forecast: CompletionForecast | null;
  readonly promisePhrase: string | null;
  readonly signals: readonly CompletionPromiseSignal[];
}

function dayOf(raw: string | null): string | null {
  return raw === null ? null : formatCalendarDate(raw.slice(0, 10), getCurrentLocale());
}

function useForecastText(forecast: CompletionForecast | null): string {
  const { t } = useTranslation(NS);
  if (forecast === null) return t('building:availabilityPromise.schedule.loading');
  if (forecast.kind !== 'forecast') return t('building:availabilityPromise.schedule.empty');
  const date = dayOf(forecast.finish) ?? forecast.finish;
  return forecast.isLowerBound ? t('building:availabilityPromise.schedule.atLeast', { date }) : date;
}

function useSignalText(signal: CompletionPromiseSignal): string {
  const { t } = useTranslation(NS);
  switch (signal.kind) {
    case 'expired':
      return t('building:availabilityPromise.signal.expired', { days: signal.daysAgo });
    case 'forecast-beyond-promise':
      return t(signal.isLowerBound ? 'building:availabilityPromise.signal.forecastBeyondAtLeast' : 'building:availabilityPromise.signal.forecastBeyond',
        { date: dayOf(signal.forecastFinish), days: signal.daysBeyond });
    case 'at-risk':
      return t('building:availabilityPromise.signal.atRisk', { date: dayOf(signal.forecastFinish), days: signal.marginDays });
    case 'plan-beyond-promise':
      return t('building:availabilityPromise.signal.planBeyond', { date: dayOf(signal.plannedFinish), days: signal.daysBeyond });
    case 'forecast-unreliable':
      return t('building:availabilityPromise.signal.unreliable');
  }
}

function SignalItem({ signal }: { readonly signal: CompletionPromiseSignal }) {
  return <li>{useSignalText(signal)}</li>;
}

function ScheduleNote({ forecast }: { readonly forecast: CompletionForecast | null }) {
  const { t } = useTranslation(NS);
  if (forecast?.kind === 'no-schedule') return <p className="text-xs text-muted-foreground">{t('building:availabilityPromise.schedule.noSchedule')}</p>;
  if (forecast?.kind === 'completed') {
    return <p className="text-xs text-muted-foreground">{t('building:availabilityPromise.schedule.completed', { date: dayOf(forecast.completedOn) })}</p>;
  }
  return null;
}

export function CompletionScheduleComparison({ planned, forecast, promisePhrase, signals }: ComparisonProps) {
  const { t } = useTranslation(NS);
  const empty = t('building:availabilityPromise.schedule.empty');
  const rows = [
    { key: 'plan', label: t('building:availabilityPromise.schedule.plan'), value: dayOf(planned) ?? empty },
    { key: 'forecast', label: t('building:availabilityPromise.schedule.forecast'), value: useForecastText(forecast) },
    { key: 'promise', label: t('building:availabilityPromise.schedule.promise'), value: promisePhrase ?? empty },
  ];
  return (
    <section aria-label={t('building:availabilityPromise.schedule.heading')} className="flex flex-col gap-2">
      <h4 className="text-xs font-medium text-muted-foreground">{t('building:availabilityPromise.schedule.heading')}</h4>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <ScheduleNote forecast={forecast} />
      {signals.length > 0 && (
        <ul role="alert" className="flex list-disc flex-col gap-1 rounded-md border border-destructive/40 p-2 pl-6 text-sm">
          {signals.map((signal) => <SignalItem key={signal.kind} signal={signal} />)}
        </ul>
      )}
    </section>
  );
}
