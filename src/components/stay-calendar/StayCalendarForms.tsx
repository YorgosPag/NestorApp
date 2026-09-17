'use client';

/**
 * **Οι δύο πράξεις πάνω σε ελεύθερες νύχτες** — κλείσιμο και χειροκίνητη κράτηση.
 *
 * ⚠️ Τα όρια (μήκος σημείωσης/ονόματος, άτομα) έρχονται από τον **ίδιο** αναλυτή που
 * κρίνει ο διακομιστής (`stay-calendar-command.ts`) — ποτέ δεύτεροι αριθμοί εδώ.
 *
 * @related ADR-835 §20 (Στάδιο Α)
 */

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  STAY_BOOKING_MAX_GUESTS,
  STAY_GUEST_LABEL_MAX_LENGTH,
  STAY_NOTE_MAX_LENGTH,
  type StayCalendarCommand,
} from '@/lib/stay/stay-calendar-command';
import type { StayNightSelection } from '@/lib/stay/stay-calendar-month';
import { cn } from '@/lib/utils';

interface FormProps {
  readonly selection: StayNightSelection;
  readonly busy: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}

const BUTTON = 'self-start rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50';

export function StayBlockForm({ selection, busy, onSend }: FormProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [note, setNote] = React.useState('');
  const noteId = React.useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSend({ action: 'block', from: selection.from, to: selection.to, note: note.trim() === '' ? null : note.trim() });
    setNote('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{t('property-market:offer.stayCalendar.block.heading')}</h3>
      <Label htmlFor={noteId}>{t('property-market:offer.stayCalendar.block.note')}</Label>
      <Textarea
        id={noteId}
        value={note}
        maxLength={STAY_NOTE_MAX_LENGTH}
        placeholder={t('property-market:offer.stayCalendar.block.notePlaceholder')}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
      />
      <button type="submit" disabled={busy} className={cn(BUTTON, COLOR_BRIDGE.action.secondary)}>
        {t('property-market:offer.stayCalendar.block.submit')}
      </button>
    </form>
  );
}

export function StayBookingForm({ selection, busy, onSend }: FormProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [guestLabel, setGuestLabel] = React.useState('');
  const [guests, setGuests] = React.useState(2);
  const labelId = React.useId();
  const guestsId = React.useId();
  const ready = guestLabel.trim() !== '' && Number.isInteger(guests) && guests >= 1;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!ready) return;
    onSend({ action: 'book', checkIn: selection.from, checkOut: selection.to, guests, guestLabel: guestLabel.trim() });
    setGuestLabel('');
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{t('property-market:offer.stayCalendar.book.heading')}</h3>
      <Label htmlFor={labelId}>{t('property-market:offer.stayCalendar.book.guestLabel')}</Label>
      <Input
        id={labelId}
        value={guestLabel}
        required
        maxLength={STAY_GUEST_LABEL_MAX_LENGTH}
        placeholder={t('property-market:offer.stayCalendar.book.guestLabelPlaceholder')}
        onChange={(event) => setGuestLabel(event.target.value)}
      />
      <Label htmlFor={guestsId}>{t('property-market:offer.stayCalendar.book.guests')}</Label>
      <Input
        id={guestsId}
        type="number"
        inputMode="numeric"
        min={1}
        max={STAY_BOOKING_MAX_GUESTS}
        value={guests}
        onChange={(event) => setGuests(Number(event.target.value))}
      />
      <button type="submit" disabled={busy || !ready} className={cn(BUTTON, COLOR_BRIDGE.action.primary)}>
        {t('property-market:offer.stayCalendar.book.submit')}
      </button>
    </form>
  );
}
