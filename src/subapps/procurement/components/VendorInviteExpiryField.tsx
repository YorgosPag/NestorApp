'use client';

/**
 * @fileoverview **«Ο σύνδεσμος ισχύει έως» — πάντα ημερομηνία** (ADR-327 §7.5, Ε1β).
 * @module subapps/procurement/components/VendorInviteExpiryField
 *
 * Ήταν Select με «Προσαρμοσμένη…» **χωρίς** πεδίο: η επιλογή έστελνε σιωπηλά 7 ημέρες. Τώρα οι συντομεύσεις
 * (3/5/7/14) είναι απλώς τρόποι να διαλέξεις **ημέρα**, και η «Συγκεκριμένη ημερομηνία» ανοίγει πραγματικό
 * ημερολόγιο (`DatePickerField`) με τα όρια της ΜΙΑΣ πολιτικής (`inviteExpiryBounds`): άκυρη ημέρα δεν διαλέγεται.
 * Κάτω από το πεδίο γράφεται πάντα η ημερομηνία που θα πάρει ο σύνδεσμος — και η προθεσμία του RFQ, αν υπάρχει.
 */

import { useState } from 'react';

import { DatePickerField } from '@/components/ui/date-picker-field';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { endOfCalendarDay, type CalendarDay } from '@/constants/platform-operator';
import type { Translate } from '@/i18n/hooks/useTranslation';
import { dateKeyOfPicker, pickerDateOfKey } from '@/lib/calendar/date-key';
import { formatOperatorDate } from '@/lib/operator-time-format';

import {
  VENDOR_INVITE_EXPIRY_PRESET_DAYS,
  inviteExpiryBounds,
  presetExpiryDay,
  type VendorInviteExpiryPresetDays,
} from '../config/vendor-invite-policy';

type ExpiryMode = `${VendorInviteExpiryPresetDays}` | 'date';

const PRESET_MODES = VENDOR_INVITE_EXPIRY_PRESET_DAYS.map((days) => `${days}` as const);

/** Η αρχική επιλογή: η συντόμευση που δίνει ακριβώς αυτή την ημέρα, αλλιώς «Συγκεκριμένη ημερομηνία». */
function modeOf(day: CalendarDay, now: Date): ExpiryMode {
  const preset = VENDOR_INVITE_EXPIRY_PRESET_DAYS.find((days) => presetExpiryDay(days, now) === day);
  return preset === undefined ? 'date' : `${preset}`;
}

export interface VendorInviteExpiryFieldProps {
  readonly id: string;
  readonly value: CalendarDay;
  readonly onChange: (day: CalendarDay) => void;
  /** Η προθεσμία υποβολής του RFQ (ms), για την υπόδειξη κάτω από το πεδίο. */
  readonly rfqDeadlineMs: number | null;
  readonly disabled: boolean;
  readonly language: string;
  readonly t: Translate;
}

export function VendorInviteExpiryField({ id, value, onChange, rfqDeadlineMs, disabled, language, t }: VendorInviteExpiryFieldProps) {
  const [now] = useState(() => new Date());
  const [mode, setMode] = useState<ExpiryMode>(() => modeOf(value, now));
  const bounds = inviteExpiryBounds(now);

  const choose = (next: ExpiryMode) => {
    setMode(next);
    if (next !== 'date') onChange(presetExpiryDay(Number(next) as VendorInviteExpiryPresetDays, now));
  };

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <Label htmlFor={id} className="text-sm font-medium">{t('rfqs.invite.deadline.label')}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mode} onValueChange={(next) => choose(next as ExpiryMode)}>
          <SelectTrigger id={id} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESET_MODES.map((days) => (
              <SelectItem key={days} value={days}>{t(`rfqs.invite.deadline.preset.${days}d`)}</SelectItem>
            ))}
            <SelectItem value="date">{t('rfqs.invite.deadline.preset.custom')}</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'date' && (
          <span className="w-56">
            <DatePickerField
              value={pickerDateOfKey(value)}
              onSelect={(date) => { const day = dateKeyOfPicker(date); if (day !== null) onChange(day); }}
              placeholder={t('rfqs.invite.deadline.pickDate')}
              disabled={disabled}
              disabledDates={[{ before: pickerDateOfKey(bounds.first) ?? now }, { after: pickerDateOfKey(bounds.last) ?? now }]}
            />
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('rfqs.invite.deadline.until', { date: formatOperatorDate(endOfCalendarDay(value), language) })}
        {rfqDeadlineMs !== null && ` · ${t('rfqs.invite.deadline.rfqDeadline', { date: formatOperatorDate(rfqDeadlineMs, language) })}`}
      </p>
    </fieldset>
  );
}
