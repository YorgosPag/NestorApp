'use client';

/**
 * @fileoverview **ΤΑ ΔΙΑΣΤΗΜΑΤΑ ΜΙΑΣ ΗΜΕΡΑΣ** — «από–έως», αφαίρεση, «Προσθήκη διαστήματος» (ADR-841 §7 Α21.16.8 · Α21.21).
 * @related WeeklyHoursDayRow.tsx (ημέρα της εβδομάδας) · SpecialDayRow.tsx (ειδική ημερομηνία) · lib/calendar/weekly-hours-editing.ts
 * @module components/mandate/DailyIntervalsEditor
 *
 * 🔑 **N.0.2 — εξήχθη από το `WeeklyHoursDayRow`** τη στιγμή που ήρθε δεύτερος καταναλωτής (η ειδική μέρα, Α21.21):
 * ένα δεύτερο αντίγραφο θα ήταν το κλασικό δίδυμο — η ίδια πάντα-έγκυρη πρόταση γραμμένη δύο φορές, που κάποτε
 * θα διαφωνούσε με τον εαυτό της.
 *
 * ♿ Το όνομα της ημέρας μπαίνει ως `sr-only` **μετά** το ορατό κείμενο (WCAG 2.5.3 label-in-name).
 */

import React from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { endsNextDay, type DailyInterval } from '@/lib/calendar/weekly-hours';
import { proposeNextInterval } from '@/lib/calendar/weekly-hours-editing';
import { SHOWCASE_CARD_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';

interface IntervalInputsProps {
  readonly interval: DailyInterval;
  readonly errorId: string | undefined;
  readonly onEdit: (patch: Partial<DailyInterval>) => void;
  readonly onRemove: () => void;
}

function IntervalInputs({ interval, errorId, onEdit, onRemove }: IntervalInputsProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const invalid = errorId !== undefined;
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Input type="time" className="w-28" aria-label={t(SHOWCASE_CARD_KEYS.opensLabel)} aria-invalid={invalid} aria-describedby={errorId} value={interval.opens} onChange={(event) => onEdit({ opens: event.target.value })} />
      <span aria-hidden="true">–</span>
      <Input type="time" className="w-28" aria-label={t(SHOWCASE_CARD_KEYS.closesLabel)} aria-invalid={invalid} aria-describedby={errorId} value={interval.closes} onChange={(event) => onEdit({ closes: event.target.value })} />
      {endsNextDay(interval) ? <span className="text-xs text-muted-foreground">{t(SHOWCASE_CARD_KEYS.endsNextDay)}</span> : null}
      <Button type="button" variant="ghost" size="icon" aria-label={t(SHOWCASE_CARD_KEYS.removeInterval)} onClick={onRemove}>
        <X aria-hidden="true" />
      </Button>
    </span>
  );
}

export interface DailyIntervalsEditorProps {
  /** Το όνομα της ημέρας ή της ημερομηνίας — για τον αναγνώστη οθόνης. */
  readonly day: string;
  readonly intervals: readonly DailyInterval[];
  /** Η ταυτότητα του μηνύματος ελαττώματος, όταν υπάρχει. */
  readonly errorId: string | undefined;
  readonly onChange: (intervals: readonly DailyInterval[]) => void;
  readonly className?: string;
}

export function DailyIntervalsEditor({ day, intervals, errorId, onChange, className }: DailyIntervalsEditorProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const proposal = proposeNextInterval(intervals);
  return (
    <span className={cn('flex flex-wrap items-center gap-2', className)}>
      {intervals.map((interval, index) => (
        <IntervalInputs
          key={index}
          interval={interval}
          errorId={errorId}
          onEdit={(patch) => onChange(intervals.map((current, at) => (at === index ? { ...current, ...patch } : current)))}
          onRemove={() => onChange(intervals.filter((_, at) => at !== index))}
        />
      ))}
      {proposal !== null ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...intervals, proposal])}>
          <Plus aria-hidden="true" /> {t(SHOWCASE_CARD_KEYS.addInterval)}
          <span className="sr-only"> ({day})</span>
        </Button>
      ) : null}
    </span>
  );
}
