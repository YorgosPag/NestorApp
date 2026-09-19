'use client';

/**
 * **Η παρέα και η τιμή μιας κράτησης, όπως τη βλέπει ο οικοδεσπότης** — «2 άτομα · 1 κατοικίδιο · σύνολο 270 €».
 * @related ADR-777 §8.60.21.7 · ADR-835 §23.8 · lib/stay/stay-calendar-view.ts ·
 *   components/stay-calendar/StayCalendarPanel.tsx · components/stay-calendar/StayRequestsInbox.tsx
 *
 * 🔑 **Μία γραμμή, δύο οθόνες** (λεπτομέρεια ημερολογίου · εισερχόμενο αιτημάτων): ό,τι ξέρει ο
 * οικοδεσπότης για την παρέα ειπώνεται **ίδια** και στις δύο — όχι δίδυμα (CHECK 3.28).
 *
 * ⚠️ `pets: null` = **δεν ρωτήθηκε** (κράτηση πριν τη Φ5) ⇒ **σιωπή**, ποτέ «0 κατοικίδια»: θα ήταν
 * ισχυρισμός που κανείς δεν έκανε. Το σύνολο είναι το **στιγμιότυπο** του αιτήματος — ό,τι υποσχέθηκε
 * η πλατφόρμα στον επισκέπτη, όχι η σημερινή τιμή.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatMinor } from '@/lib/money/money';
import type { StayCalendarEntryView } from '@/lib/stay/stay-calendar-view';

type BookingView = Extract<StayCalendarEntryView, { kind: 'booking' }>;

export function StayEntryParty({ entry }: { readonly entry: BookingView }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const parts = [t('property-market:offer.stayCalendar.entry.guests', { count: entry.guests })];
  if (entry.pets !== null && entry.pets > 0) parts.push(t('property-market:offer.stayCalendar.entry.pets', { count: entry.pets }));
  if (entry.totalMinor !== null) parts.push(t('property-market:offer.stayCalendar.entry.total', { total: formatMinor(entry.totalMinor) }));
  return <p className="text-sm text-muted-foreground">{parts.join(' · ')}</p>;
}
