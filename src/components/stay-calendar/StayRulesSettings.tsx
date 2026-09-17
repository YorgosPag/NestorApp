'use client';

/**
 * **Γενικοί κανόνες διαθεσιμότητας** — ειδοποίηση · προετοιμασία · παράθυρο · μέγιστες νύχτες ·
 * μέρες άφιξης/αναχώρησης · ορφανά κενά.
 *
 * 🔑 Οι επιλογές είναι **ακριβώς** όσες προσφέρει η αγορά (Airbnb «Availability settings»,
 * PriceLabs για τα κενά) — κλειστά σύνολα από το `types/stay-rules.ts`, ποτέ ελεύθερος αριθμός
 * που ο διακομιστής θα απέρριπτε. Η τιμή βάσης και οι ελάχιστες νύχτες **δεν** ζουν εδώ: είναι
 * όροι της αγγελίας (μία αλήθεια, `ShortLeaseOffer`).
 *
 * @related ADR-835 §21 · lib/stay/stay-rules-shape.ts
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISO_WEEKDAYS, type IsoWeekday } from '@/lib/calendar/weekly-hours';
import { formatIsoWeekday } from '@/lib/intl-formatting';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { stayRulesFrom } from '@/lib/stay/stay-rules-shape';
import { cn } from '@/lib/utils';
import {
  STAY_ADVANCE_NOTICE_DAYS,
  STAY_AVAILABILITY_WINDOW_MONTHS,
  STAY_CUTOFF_HOUR_MAX,
  STAY_ORPHAN_GAP_NIGHTS,
  STAY_PREPARATION_NIGHTS,
  STAY_RULE_MAX_NIGHTS,
  type StayRules,
} from '@/types/stay-rules';

import { StayRuleChoice } from './StayRuleChoice';

/**
 * Κλειδιά ως ΚΥΡΙΟΛΕΚΤΙΚΑ — η γεννήτρια των route slices τα διαβάζει από εδώ (ADR-744).
 * ⚠️ Ονόματα ιδιοτήτων σε **εισαγωγικά**: ο διαβαστής πινάκων κλειδιών δέχεται μόνο
 * αναγνωριστικά ή συμβολοσειρές — αριθμητικό όνομα θα άφηνε την κλήση `t()` ανεπίλυτη.
 */
const NOTICE_LABEL = {
  '0': 'property-market:offer.stayCalendar.rules.notice0',
  '1': 'property-market:offer.stayCalendar.rules.notice1',
  '2': 'property-market:offer.stayCalendar.rules.notice2',
  '3': 'property-market:offer.stayCalendar.rules.notice3',
  '7': 'property-market:offer.stayCalendar.rules.notice7',
} as const;
const PREPARATION_LABEL = {
  '0': 'property-market:offer.stayCalendar.rules.preparation0',
  '1': 'property-market:offer.stayCalendar.rules.preparation1',
  '2': 'property-market:offer.stayCalendar.rules.preparation2',
} as const;

const HOURS = Array.from({ length: STAY_CUTOFF_HOUR_MAX + 1 }, (_, hour) => hour);
const BUTTON = 'self-start rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50';

function WeekdaysRow({ label, value, onChange }: {
  readonly label: string;
  readonly value: readonly IsoWeekday[];
  readonly onChange: (value: readonly IsoWeekday[]) => void;
}): React.ReactElement {
  const toggle = (weekday: IsoWeekday, on: boolean): void =>
    onChange(on ? [...value, weekday].sort((a, b) => a - b) : value.filter((day) => day !== weekday));
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <span className="flex flex-wrap gap-1">
        {ISO_WEEKDAYS.map((weekday) => (
          <Toggle
            key={weekday} variant="outline" size="sm" pressed={value.includes(weekday)}
            aria-label={formatIsoWeekday(weekday, 'long')} onPressedChange={(on) => toggle(weekday, on)}
          >
            {formatIsoWeekday(weekday, 'short')}
          </Toggle>
        ))}
      </span>
    </fieldset>
  );
}

/** Τα χειριστήρια χρόνου: ειδοποίηση, αποκοπή, προετοιμασία, παράθυρο. */
function TimeRules({ draft, patch }: {
  readonly draft: StayRules;
  readonly patch: (next: Partial<StayRules>) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const notice = draft.advanceNotice;
  return (
    <>
      <StayRuleChoice
        label={t('property-market:offer.stayCalendar.rules.notice')} value={notice.days} options={STAY_ADVANCE_NOTICE_DAYS}
        labelOf={(days) => t(NOTICE_LABEL[days])}
        onChange={(days) => patch({ advanceNotice: { days, sameDayCutoffHour: days === 0 ? notice.sameDayCutoffHour : null } })}
      />
      {notice.days === 0 && (
        <StayRuleChoice
          label={t('property-market:offer.stayCalendar.rules.cutoff')} value={notice.sameDayCutoffHour} options={HOURS} nullable
          labelOf={(hour) => (hour === null ? t('property-market:offer.stayCalendar.rules.cutoffNone') : `${String(hour).padStart(2, '0')}:00`)}
          onChange={(sameDayCutoffHour) => patch({ advanceNotice: { days: 0, sameDayCutoffHour } })}
        />
      )}
      <StayRuleChoice
        label={t('property-market:offer.stayCalendar.rules.preparation')} value={draft.preparationNights}
        options={STAY_PREPARATION_NIGHTS} labelOf={(nights) => t(PREPARATION_LABEL[nights])}
        onChange={(preparationNights) => patch({ preparationNights })}
      />
      <StayRuleChoice
        label={t('property-market:offer.stayCalendar.rules.window')} value={draft.availabilityWindowMonths}
        options={STAY_AVAILABILITY_WINDOW_MONTHS} nullable
        labelOf={(months) => (months === null
          ? t('property-market:offer.stayCalendar.rules.windowNone')
          : t('property-market:offer.stayCalendar.rules.windowMonths', { count: months }))}
        onChange={(availabilityWindowMonths) => patch({ availabilityWindowMonths })}
      />
    </>
  );
}

/** Τα χειριστήρια διάρκειας και ημερών: μέγιστες νύχτες, μέρες, ορφανά κενά. */
function LengthRules({ draft, patch }: {
  readonly draft: StayRules;
  readonly patch: (next: Partial<StayRules>) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const maxId = React.useId();
  const orphanId = React.useId();
  return (
    <>
      <Label htmlFor={maxId}>{t('property-market:offer.stayCalendar.rules.maxNights')}</Label>
      <Input
        id={maxId} type="number" inputMode="numeric" min={0} max={STAY_RULE_MAX_NIGHTS} value={draft.maxNights ?? 0}
        onChange={(event) => patch({ maxNights: Number(event.target.value) > 0 ? Number(event.target.value) : null })}
      />
      <WeekdaysRow label={t('property-market:offer.stayCalendar.rules.arrivalDays')} value={draft.arrivalWeekdays} onChange={(arrivalWeekdays) => patch({ arrivalWeekdays })} />
      <WeekdaysRow label={t('property-market:offer.stayCalendar.rules.departureDays')} value={draft.departureWeekdays} onChange={(departureWeekdays) => patch({ departureWeekdays })} />
      <span className="flex items-center gap-2">
        <Switch id={orphanId} checked={draft.orphanGap !== null} onCheckedChange={(on) => patch({ orphanGap: on ? { maxNights: 2 } : null })} />
        <Label htmlFor={orphanId}>{t('property-market:offer.stayCalendar.rules.orphan')}</Label>
      </span>
      {draft.orphanGap !== null && (
        <StayRuleChoice
          label={t('property-market:offer.stayCalendar.rules.orphanNights')} value={draft.orphanGap.maxNights}
          options={STAY_ORPHAN_GAP_NIGHTS} labelOf={(nights) => String(nights)} hint={t('property-market:offer.stayCalendar.rules.orphanHint')}
          onChange={(maxNights) => patch({ orphanGap: { maxNights } })}
        />
      )}
    </>
  );
}

export function StayRulesSettings({ rules, busy, onSend }: {
  readonly rules: StayRules;
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [draft, setDraft] = React.useState<StayRules>(rules);
  React.useEffect(() => setDraft(rules), [rules]);
  const patch = (next: Partial<StayRules>): void => setDraft((current) => ({ ...current, ...next }));
  // Ο ΙΔΙΟΣ έλεγχος σχήματος με τον διακομιστή: ό,τι δεν θα δεχόταν εκείνος, δεν στέλνεται.
  const valid = stayRulesFrom(draft);

  return (
    <details className="rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{t('property-market:offer.stayCalendar.rules.heading')}</summary>
      <form onSubmit={(event) => { event.preventDefault(); if (valid !== null) onSend({ action: 'rules', rules: valid }); }} className="mt-3 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('property-market:offer.stayCalendar.rules.lead')}</p>
        <p className="text-xs text-muted-foreground">{t('property-market:offer.stayCalendar.rules.termsNote')}</p>
        <TimeRules draft={draft} patch={patch} />
        <LengthRules draft={draft} patch={patch} />
        {valid === null && <p role="alert" className={cn('text-sm', COLOR_BRIDGE.text.error)}>{t('property-market:offer.stayCalendar.rules.weekdaysEmpty')}</p>}
        <button type="submit" disabled={busy || valid === null} className={cn(BUTTON, COLOR_BRIDGE.action.primary)}>
          {t('property-market:offer.stayCalendar.rules.submit')}
        </button>
      </form>
    </details>
  );
}
