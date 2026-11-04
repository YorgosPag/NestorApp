'use client';

/**
 * **Πότε πληρώνεται** (ADR-928 §5.4.1 άξονας 2): με το πέρας · με ορόσημα · με λογαριασμό · κάθε Ν ημέρες/εβδομάδες/μήνες,
 * με άγκυρα και κανόνα αργιών. Μαζί και το συμβάν της εξόφλησης.
 *
 * 🔑 Ημέρες εβδομάδας και ορόσημα με τη **λέξη του εγγράφου** (`documentLocaleOf`, `milestoneLabel`).
 * 🔑 Οι ημέρες μήνα γράφονται ως «5, 20». Ό,τι δεν είναι αριθμός μένει και ο κριτής το λέει (`parseDayList`). Το πεδίο
 *    κρατά το κείμενο που γράφεται, ώστε το κόμμα να μη χάνεται στη μέση της πληκτρολόγησης.
 */

import { useState } from 'react';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ISO_WEEKDAYS } from '@/lib/calendar/weekly-hours';
import { issuesAt } from '@/subapps/procurement/subcontracts/agreements/issue-paths';
import { joinPath } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { documentLocaleOf, MILESTONE_KEYS } from '@/subapps/procurement/subcontracts/document/document-locale';
import { milestoneLabel } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { ANCHOR_KINDS, anchorOfKind, FINAL_SETTLEMENT_KINDS, finalSettlementOfKind, parseDayList, SCHEDULE_KINDS, scheduleOfKind } from '@/subapps/procurement/subcontracts/terms/plan-edits';
import { HOLIDAY_SHIFTS, RECURRENCE_UNITS, type PaymentSchedule, type RecurrenceAnchor } from '@/subapps/procurement/subcontracts/types/payment-plan';
import { EditorField } from '../../editor/EditorField';
import { BoundTermZone } from '../BoundTermZone';
import type { PaymentPlanSectionProps } from './PaymentPlanSection';

type Recurring = Extract<PaymentSchedule, { kind: 'recurring' }>;

function MonthDaysInput({ days, onChange }: { readonly days: readonly number[]; readonly onChange: (days: number[]) => void }) {
  const { t } = useTranslation('procurement');
  const [text, setText] = useState(days.join(', '));
  const parsed = parseDayList(text);
  const same = parsed.length === days.length && parsed.every((day, index) => Object.is(day, days[index]));
  if (!same && text !== days.join(', ')) setText(days.join(', '));
  return <Input id="plan-anchor-days" aria-label={t('subcontracts.sections.plan.monthDays')} value={text} placeholder="5, 20" onChange={(event) => { setText(event.target.value); onChange(parseDayList(event.target.value)); }} />;
}

function AnchorFields({ schedule, set, props }: { readonly schedule: Recurring; readonly set: (next: Recurring) => void; readonly props: PaymentPlanSectionProps }) {
  const { t } = useTranslation('procurement');
  const locale = documentLocaleOf(props.language);
  const anchor = schedule.anchor;
  const setAnchor = (next: RecurrenceAnchor) => set({ ...schedule, anchor: next });
  return (
    <span className="grid gap-1">
      <EditorField id="plan-anchor" label={t('subcontracts.sections.plan.anchor')} issues={issuesAt(props.issues, joinPath(props.path, 'schedule', 'anchor'))}>
        <EnumSelect id="plan-anchor" value={anchor.kind} values={ANCHOR_KINDS} getLabel={(kind) => t(`subcontracts.sections.plan.anchors.${kind}`)} onValueChange={(kind) => setAnchor(anchorOfKind(kind, anchor))} />
      </EditorField>
      {anchor.kind === 'weekday' && (
        <EnumSelect id="plan-anchor-weekday" ariaLabel={t('subcontracts.sections.plan.weekday')} value={String(anchor.weekday)} values={ISO_WEEKDAYS.map(String)}
          getLabel={(day) => locale.phrase(`parameter.weekday.${day}`)}
          onValueChange={(day) => { const weekday = ISO_WEEKDAYS.find((candidate) => String(candidate) === day); if (weekday !== undefined) setAnchor({ kind: 'weekday', weekday }); }} />
      )}
      {anchor.kind === 'month_days' && <MonthDaysInput days={anchor.days} onChange={(days) => setAnchor({ kind: 'month_days', days })} />}
      <BoundTermZone termPath="schedule.anchor.weekday" bound={props.bound} issues={props.issues} language={props.language} />
    </span>
  );
}

function RecurringFields({ schedule, props }: { readonly schedule: Recurring; readonly props: PaymentPlanSectionProps }) {
  const { t } = useTranslation('procurement');
  const { value, onChange, issues, path } = props;
  const set = (next: Recurring) => onChange({ ...value, schedule: next });
  const at = joinPath(path, 'schedule');
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <EditorField id="plan-every" label={t('subcontracts.sections.plan.every')} issues={issuesAt(issues, joinPath(at, 'every'))}>
        <span className="flex gap-2">
          <NumericField id="plan-every" value={schedule.every} min={1} step={1} onValueChange={(every) => set({ ...schedule, every })} className="w-20" />
          <EnumSelect id="plan-unit" ariaLabel={t('subcontracts.sections.plan.unit')} value={schedule.unit} values={RECURRENCE_UNITS} getLabel={(unit) => t(`subcontracts.sections.plan.units.${unit}`)} onValueChange={(unit) => set({ ...schedule, unit })} />
        </span>
      </EditorField>
      <AnchorFields schedule={schedule} set={set} props={props} />
      <EditorField id="plan-holiday" label={t('subcontracts.sections.plan.holidayShift')} issues={issuesAt(issues, joinPath(at, 'holidayShift'))}>
        <EnumSelect id="plan-holiday" value={schedule.holidayShift} values={HOLIDAY_SHIFTS} getLabel={(shift) => t(`subcontracts.sections.plan.holiday.${shift}`)} onValueChange={(holidayShift) => set({ ...schedule, holidayShift })} />
      </EditorField>
    </fieldset>
  );
}

function FinalSettlementFields(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange, issues, path, language } = props;
  const final = value.finalSettlement;
  const locale = documentLocaleOf(language);
  const set = (finalSettlement: typeof final) => onChange({ ...value, finalSettlement });
  return (
    <EditorField id="plan-final" label={t('subcontracts.sections.plan.finalSettlement')} issues={issuesAt(issues, joinPath(path, 'finalSettlement'))}>
      <span className="flex flex-wrap gap-2">
        <EnumSelect id="plan-final" value={final.kind} values={FINAL_SETTLEMENT_KINDS} getLabel={(kind) => t(`subcontracts.sections.plan.final.${kind}`)} onValueChange={(kind) => set(finalSettlementOfKind(kind, final, MILESTONE_KEYS[0]))} />
        {final.kind === 'milestone' && (
          <EnumSelect id="plan-final-milestone" ariaLabel={t('subcontracts.sections.plan.milestone')} value={final.milestone} values={[...new Set([...MILESTONE_KEYS, final.milestone])]} getLabel={(key) => milestoneLabel(key, locale)} onValueChange={(milestone) => set({ kind: 'milestone', milestone })} />
        )}
        {final.kind === 'days_after_completion' && (
          <span className="w-24"><NumericField id="plan-final-days" aria-label={t('subcontracts.sections.plan.days')} value={final.days} min={1} step={1} onValueChange={(days) => set({ kind: 'days_after_completion', days })} /></span>
        )}
      </span>
    </EditorField>
  );
}

export function ScheduleFields(props: PaymentPlanSectionProps) {
  const { t } = useTranslation('procurement');
  const { value, onChange } = props;
  const schedule = value.schedule;
  return (
    <fieldset className="space-y-3">
      <EditorField id="plan-schedule" label={t('subcontracts.sections.plan.schedule')}>
        <EnumSelect id="plan-schedule" value={schedule.kind} values={SCHEDULE_KINDS} getLabel={(kind) => t(`subcontracts.sections.plan.schedules.${kind}`)} onValueChange={(kind) => onChange({ ...value, schedule: scheduleOfKind(kind, schedule) })} />
      </EditorField>
      {schedule.kind === 'recurring' && <RecurringFields schedule={schedule} props={props} />}
      <FinalSettlementFields {...props} />
    </fieldset>
  );
}
