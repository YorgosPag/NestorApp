'use client';

/**
 * **`/offers/[offerId]/calendar` — το ημερολόγιο κρατήσεων του ιδιοκτήτη.**
 *
 * 🔑 **Η οθόνη δεν αποφασίζει τίποτα**: η επιλογή μεταφράζεται σε διάστημα από το
 * `stay-calendar-month`, η πράξη σε έκβαση από τον διακομιστή, και ο κριτής κατάληψης
 * τρέχει **μόνο** μέσα στη συναλλαγή. Εδώ ζει μόνο η σύνθεση.
 *
 * ⚠️ Το ημερολόγιο είναι **μόνο** για αγγελία με ζωντανή βραχυχρόνια διάθεση. Για άλλη
 * αγγελία η σελίδα **εξηγεί**, δεν κρύβεται — ο σύνδεσμος μπορεί να είναι αποθηκευμένος.
 *
 * @related ADR-835 §20 (Στάδιο Α) · hooks/owner-property/useStayCalendar.ts
 */

import dynamic from 'next/dynamic';
import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useAuth } from '@/auth/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useStayCalendar, type StayCalendarController } from '@/hooks/owner-property/useStayCalendar';
import {
  useStayCalendarSelection,
  type StayCalendarSelectionController,
} from '@/hooks/owner-property/useStayCalendarSelection';
import { deriveCommercialAmounts } from '@/lib/offers/derive-commercial-status';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import type { PricedPropertyLike } from '@/lib/properties/price-resolver';
import type { StayCalendarCommand } from '@/lib/stay/stay-calendar-command';
import { selectionMeaning } from '@/lib/stay/stay-calendar-month';
import type { StayCalendarView } from '@/lib/stay/stay-calendar-view';
import { useMyOwnerProperty } from '@/services/realtime/hooks/useMyOwnerProperties';
import { ownerPropertyOfferKinds } from '@/types/owner-property';
import { stayCalendarMessageOf, type StayCalendarMessage } from './stay-calendar-outcome';
import { StayCalendarDeclaration, StayCalendarLegend, StayCalendarMonthNav } from './StayCalendarChrome';

import { StayCalendarGrid } from './StayCalendarGrid';
import { StayCalendarPanel } from './StayCalendarPanel';
import { StayRulesSettings } from './StayRulesSettings';
import type { StayPendingWarnings } from './StayRuleWarningsConfirm';
import routeSlice from '@/i18n/generated/routes/offers__offerId__calendar.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

// ADR-744 — τα κλειδιά του πρώτου καρέ, σύγχρονα (CHECK 3.51). Δήλωση: `.i18n-shell-slice.json`.
registerRouteSlice(routeSlice);

/**
 * ⚠️ **ΟΡΙΟ `next/dynamic` γύρω από τον συγχρονισμό καναλιών** (ADR-744 Κ2, μετρημένο):
 * σύγχρονος, μεγάλωνε το slice της σελίδας **8.656 → 13.853 bytes**. Είναι **κάτω** από
 * το πλέγμα και απαντά «γιατί είναι κλειστές αυτές οι μέρες;» **αφού** ο άνθρωπος τις
 * δει — άρα κανένα ωμό κλειδί δεν προλαβαίνει να φανεί. Ο χώρος κρατιέται με σταθερό
 * ελάχιστο ύψος (καμία μετατόπιση διάταξης).
 */
const StayChannelSync = dynamic(() => import('./StayChannelSync'), {
  ssr: false,
  loading: () => <span aria-hidden className="block min-h-[12rem]" />,
});

function StayCalendarBody({ ownerPropertyId, view, calendar, picker, pricing }: {
  readonly ownerPropertyId: string;
  readonly view: StayCalendarView;
  readonly calendar: StayCalendarController;
  readonly picker: StayCalendarSelectionController;
  readonly pricing: PricedPropertyLike;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [message, setMessage] = React.useState<StayCalendarMessage | null>(null);
  const [warnings, setWarnings] = React.useState<StayPendingWarnings | null>(null);
  const locked = view.kind === 'unreadable';
  const entries = view.kind === 'readable' ? view.entries : [];
  const days = view.kind === 'readable' ? view.days : {};

  const send = async (command: StayCalendarCommand): Promise<void> => {
    const outcome = await calendar.send(command);
    setMessage(stayCalendarMessageOf(outcome));
    // 🏆 Παράκαμψη κανόνων ⇒ ονομασμένη επιβεβαίωση, ποτέ σιωπή (ADR-835 §21).
    setWarnings(outcome.kind === 'rules-unacknowledged' && command.action === 'book'
      ? { command, warnings: outcome.warnings }
      : null);
    if (outcome.kind === 'ok') picker.clear();
  };
  const pick = (day: string, extend: boolean): void => {
    setMessage(null);
    picker.pick(day, extend);
  };

  return (
    <>
      {locked && <p role="alert" className="text-sm text-foreground">{t('property-market:offer.stayCalendar.unreadable')}</p>}
      {view.kind === 'readable' && (
        <>
          <StayCalendarDeclaration declaredAt={view.declaredAt} busy={calendar.busy} locked={locked} onSend={(c) => void send(c)} />
          <StayRulesSettings rules={view.rules} busy={calendar.busy} onSend={(c) => void send(c)} />
        </>
      )}
      <section className="flex flex-col gap-3">
        <StayCalendarMonthNav monthKey={picker.monthKey} onShift={picker.shiftMonth} onToday={() => picker.moveFocus(picker.today)} />
        <StayCalendarGrid
          monthKey={picker.monthKey} entries={entries} days={days} pricing={pricing} selection={picker.selection}
          focusDay={picker.focusDay} onFocusDay={picker.moveFocus} onPick={pick}
        />
        <StayCalendarLegend />
      </section>
      {/* ADR-835 §22 (Στάδιο Γ) — ο συγχρονισμός καναλιών: **κάτω** από το πλέγμα, γιατί
          απαντά «γιατί φαίνονται αυτές οι μέρες κλειστές;» ΑΦΟΥ ο άνθρωπος τις δει. */}
      <StayChannelSync ownerPropertyId={ownerPropertyId} />
      <StayCalendarPanel
        selection={picker.selection}
        meaning={picker.selection === null ? null : selectionMeaning(picker.selection, entries)}
        days={days} busy={calendar.busy} locked={locked} message={message} warnings={warnings}
        onSend={(command) => void send(command)} onClear={picker.clear} onDismissWarnings={() => setWarnings(null)}
      />
    </>
  );
}

/** Ο μήνας ζει **εδώ**, πάνω από τη φόρτωση: αλλαγή μήνα = νέο παράθυρο ανάγνωσης. */
function StayCalendarSession({ ownerPropertyId, pricing }: {
  readonly ownerPropertyId: string;
  readonly pricing: PricedPropertyLike;
}): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const picker = useStayCalendarSelection();
  const calendar = useStayCalendar(ownerPropertyId, picker.monthKey);
  switch (calendar.state.kind) {
    case 'loading':
      return <p className="text-muted-foreground">{t('property-market:offer.stayCalendar.loading')}</p>;
    case 'absent':
      return <p className="text-foreground">{t('property-market:offer.stayCalendar.absent')}</p>;
    case 'failed':
      return (
        <p className="flex items-center gap-3 text-foreground">
          {t('property-market:offer.stayCalendar.failed')}
          <button type="button" onClick={calendar.reload} className="underline">{t('property-market:offer.stayCalendar.retry')}</button>
        </p>
      );
    case 'ready':
      return (
        <StayCalendarBody
          ownerPropertyId={ownerPropertyId} view={calendar.state.view}
          calendar={calendar} picker={picker} pricing={pricing}
        />
      );
  }
}

export function StayCalendarContent({ ownerPropertyId }: { readonly ownerPropertyId: string }): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const { user } = useAuth();
  const lookup = useMyOwnerProperty(ownerPropertyId, user?.uid ?? null);
  const isStay = lookup.state === 'found' && ownerPropertyOfferKinds(lookup.property).includes('leaseShort');
  // Η τιμή βάσης ΟΠΩΣ τη βλέπει ο επιλυτής τιμής — ο ίδιος δρόμος με τη δημόσια προβολή.
  const offers = lookup.state === 'found' ? lookup.property.offers : null;
  const pricing = React.useMemo<PricedPropertyLike>(() => ({ commercial: deriveCommercialAmounts(offers) }), [offers]);

  return (
    <main className="flex w-full flex-col gap-6">
      <nav>
        <Link href={offerDetailHref(ownerPropertyId)} className="text-sm font-medium text-foreground underline">
          {t('property-market:offer.stayCalendar.back')}
        </Link>
      </nav>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">{t('property-market:offer.stayCalendar.title')}</h1>
        {lookup.state === 'found' && <p className="text-muted-foreground">{lookup.property.title}</p>}
        <p className="text-sm text-muted-foreground">{t('property-market:offer.stayCalendar.lead')}</p>
      </header>
      {lookup.state === 'loading' && <p className="text-muted-foreground">{t('property-market:offer.stayCalendar.loading')}</p>}
      {(lookup.state === 'absent' || lookup.state === 'error' || lookup.state === 'anonymous') && (
        <p className="text-foreground">{t('property-market:offer.stayCalendar.absent')}</p>
      )}
      {lookup.state === 'found' && !isStay && <p className="text-foreground">{t('property-market:offer.stayCalendar.notAStay')}</p>}
      {isStay && <StayCalendarSession ownerPropertyId={ownerPropertyId} pricing={pricing} />}
    </main>
  );
}
