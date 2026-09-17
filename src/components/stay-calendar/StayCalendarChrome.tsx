'use client';

/**
 * **Τα γύρω από το πλέγμα** — δήλωση ενημέρωσης, πλοήγηση μηνών, υπόμνημα.
 *
 * 🔑 **Η δήλωση είναι η πιο σημαντική πρόταση της σελίδας** (ADR-835 §20): χωρίς αυτή οι
 * επισκέπτες βλέπουν «άγνωστη διαθεσιμότητα», όχι «ελεύθερο». Γι' αυτό στέκεται **πάνω**
 * από το πλέγμα και είναι η **μία** κύρια πράξη όσο λείπει.
 *
 * @related ADR-835 §20 (Στάδιο Α)
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Link2, Lock, UserRound } from 'lucide-react';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarMonth, formatLongDate } from '@/lib/intl-formatting';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { cn } from '@/lib/utils';

export function StayCalendarDeclaration({ declaredAt, busy, locked, onSend }: {
  readonly declaredAt: string | null;
  readonly busy: boolean;
  readonly locked: boolean;
  readonly onSend: (command: StayCalendarCommand) => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  if (declaredAt !== null) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-foreground">{t('property-market:offer.stayCalendar.declaration.declaredStatus', { date: formatLongDate(declaredAt) })}</p>
        <button type="button" disabled={busy || locked} onClick={() => onSend({ action: 'declare', declared: false })} className="text-foreground underline disabled:opacity-50">
          {t('property-market:offer.stayCalendar.declaration.revoke')}
        </button>
      </section>
    );
  }
  return (
    <section className={cn('flex flex-col gap-2 rounded-lg border border-border p-4', COLOR_BRIDGE.bg.warning)}>
      <h2 className="text-sm font-semibold text-foreground">{t('property-market:offer.stayCalendar.declaration.undeclaredTitle')}</h2>
      <p className="text-sm text-foreground">{t('property-market:offer.stayCalendar.declaration.undeclaredBody')}</p>
      <button type="button" disabled={busy || locked} onClick={() => onSend({ action: 'declare', declared: true })} className={cn('self-start rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50', COLOR_BRIDGE.action.primary)}>
        {t('property-market:offer.stayCalendar.declaration.declare')}
      </button>
    </section>
  );
}

export function StayCalendarMonthNav({ monthKey, onShift, onToday }: {
  readonly monthKey: string;
  readonly onShift: (months: number) => void;
  readonly onToday: () => void;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const icon = 'rounded-md p-2 text-foreground hover:bg-accent/50';
  return (
    <nav aria-label={t('property-market:offer.stayCalendar.nav.label')} className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => onShift(-1)} aria-label={t('property-market:offer.stayCalendar.nav.previous')} className={icon}>
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <h2 aria-live="polite" className="text-base font-semibold text-foreground">{formatCalendarMonth(monthKey)}</h2>
      <span className="flex items-center gap-1">
        <button type="button" onClick={onToday} className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-accent/50">
          {t('property-market:offer.stayCalendar.nav.today')}
        </button>
        <button type="button" onClick={() => onShift(1)} aria-label={t('property-market:offer.stayCalendar.nav.next')} className={icon}>
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </span>
    </nav>
  );
}

export function StayCalendarLegend(): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const swatch = 'inline-flex size-5 items-center justify-center rounded border';
  return (
    <section aria-label={t('property-market:offer.stayCalendar.legend.title')}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><span aria-hidden className={cn(swatch, 'border-border bg-card')} />{t('property-market:offer.stayCalendar.legend.free')}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className={cn(swatch, 'border-border bg-muted')}><Lock className="size-3" /></span>{t('property-market:offer.stayCalendar.legend.blocked')}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className={cn(swatch, 'border-border bg-muted')}><Link2 className="size-3" /></span>{t('property-market:offer.stayCalendar.legend.external')}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className={cn(swatch, 'border-foreground/40 bg-accent')}><UserRound className="size-3" /></span>{t('property-market:offer.stayCalendar.legend.booked')}</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className={cn(swatch, 'border-border ring-2 ring-foreground')} />{t('property-market:offer.stayCalendar.legend.selected')}</li>
      </ul>
    </section>
  );
}
