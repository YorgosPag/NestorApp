'use client';

/**
 * **«Ρυθμίσεις για αυτές τις μέρες»** — τιμή, ελάχ./μέγ. νύχτες, χωρίς άφιξη/αναχώρηση.
 *
 * 🔑 Πρότυπο Booking.com extranet: επιλέγεις εύρος, αλλάζεις ό,τι θέλεις, αποθηκεύεις. Κενό
 * πεδίο = γενικός κανόνας. Όταν οι μέρες διαφέρουν, η φόρμα ανοίγει κενή **και το λέει**.
 *
 * @related ADR-835 §21 · lib/stay/stay-day-rules-form.ts
 */

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import type { StayNightSelection } from '@/lib/stay/stay-calendar-month';
import {
  EMPTY_DAY_RULES_FORM,
  initialDayRulesForm,
  restrictionFromForm,
  type StayDayRulesFormValues,
} from '@/lib/stay/stay-day-rules-form';
import { STAY_NIGHTLY_RATE_MAX_MINOR } from '@/lib/stay/stay-rules-shape';
import { majorFromMinor } from '@/lib/money/money';
import { cn } from '@/lib/utils';
import { STAY_RULE_MAX_NIGHTS, type StayDayRules } from '@/types/stay-rules';

const BUTTON = 'self-start rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50';

interface StayDayRulesFormProps {
  readonly selection: StayNightSelection;
  readonly days: StayDayRules;
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}

/** Κενό πεδίο ⇒ `null`· αλλιώς ο αριθμός (το `<input type=number>` έχει ήδη τα όρια). */
function numberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function NumberRow({ label, value, max, step, onChange }: {
  readonly label: string;
  readonly value: number | null;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number | null) => void;
}): React.ReactElement {
  const id = React.useId();
  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id} type="number" inputMode="decimal" min={step === 1 ? 1 : 0} max={max} step={step}
        value={value ?? ''} onChange={(event) => onChange(numberOrNull(event.target.value))}
      />
    </>
  );
}

function CheckRow({ label, checked, onChange }: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}): React.ReactElement {
  const id = React.useId();
  return (
    <span className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(state) => onChange(state === true)} />
      <Label htmlFor={id}>{label}</Label>
    </span>
  );
}

export function StayDayRulesForm({ selection, days, busy, onSend }: StayDayRulesFormProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const initial = React.useMemo(() => initialDayRulesForm(days, selection.from, selection.to), [days, selection]);
  const [values, setValues] = React.useState<StayDayRulesFormValues>(initial.values);
  React.useEffect(() => setValues(initial.values), [initial]);
  const patch = (next: Partial<StayDayRulesFormValues>): void => setValues((current) => ({ ...current, ...next }));

  const submit = (source: StayDayRulesFormValues): void => {
    const command = restrictionFromForm(source, selection.from, selection.to);
    if (command !== null) onSend(command);
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); submit(values); }} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{t('property-market:offer.stayCalendar.days.heading')}</h3>
      <p className="text-xs text-muted-foreground">{t('property-market:offer.stayCalendar.days.lead')}</p>
      {initial.mixed && <p role="status" className="text-xs text-foreground">{t('property-market:offer.stayCalendar.days.mixed')}</p>}
      <NumberRow
        label={t('property-market:offer.stayCalendar.days.price')} value={values.priceEuros}
        max={majorFromMinor(STAY_NIGHTLY_RATE_MAX_MINOR)} step={0.01} onChange={(priceEuros) => patch({ priceEuros })}
      />
      <NumberRow
        label={t('property-market:offer.stayCalendar.days.minNights')} value={values.minNights}
        max={STAY_RULE_MAX_NIGHTS} step={1} onChange={(minNights) => patch({ minNights })}
      />
      <NumberRow
        label={t('property-market:offer.stayCalendar.days.maxNights')} value={values.maxNights}
        max={STAY_RULE_MAX_NIGHTS} step={1} onChange={(maxNights) => patch({ maxNights })}
      />
      <CheckRow
        label={t('property-market:offer.stayCalendar.days.closedToArrival')} checked={values.closedToArrival}
        onChange={(closedToArrival) => patch({ closedToArrival })}
      />
      <CheckRow
        label={t('property-market:offer.stayCalendar.days.closedToDeparture')} checked={values.closedToDeparture}
        onChange={(closedToDeparture) => patch({ closedToDeparture })}
      />
      <menu className="flex flex-wrap gap-2">
        <li><button type="submit" disabled={busy} className={cn(BUTTON, COLOR_BRIDGE.action.primary)}>
          {t('property-market:offer.stayCalendar.days.submit')}
        </button></li>
        <li><button type="button" disabled={busy} onClick={() => submit(EMPTY_DAY_RULES_FORM)} className={cn(BUTTON, COLOR_BRIDGE.action.secondary)}>
          {t('property-market:offer.stayCalendar.days.reset')}
        </button></li>
      </menu>
    </form>
  );
}
