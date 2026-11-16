'use client';

/**
 * ADR-915 §45.19 Φ6β — **«Οι εκκρεμότητές μου»**: κάθε ημερομηνία του επαγγελματία (παράδοση εγγράφου · υπογραφή
 * μεταβίβασης), από **όλα** τα γραφεία, η κοντινότερη πρώτη (Procore «My Open Items», Consolidated).
 *
 * 🔑 Η λίστα έρχεται **έτοιμη και ταξινομημένη** από τον server (ο οικοδεσπότης κάθε είδους, `openItem`) — καμία
 *    δεύτερη κρίση εδώ. «Δεν φορτώθηκε» ≠ «καμία εκκρεμότητα» (ADR-787 §2.7).
 * 🔑 Ο σύνδεσμος πάει στον χώρο της σελίδας· αν η συμμετοχή ζει σε άλλο γραφείο, η σελίδα της ανακατευθύνει στο σπίτι
 *    της (409 `ENGAGEMENT_ELSEWHERE`) — κανένα μάντεμα διεύθυνσης εδώ.
 * 🔑 Βαθμίδα = εικονίδιο + λέξη + χρώμα (CHECK 3.41), η όψη από το κοινό `DUE_COUNTDOWN_LOOK`.
 *
 * @module components/conveyance/my-cases/MyOpenItemsSection
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { DUE_COUNTDOWN_LOOK } from '@/components/shared/due-countdown-look';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { MyOpenItemsList } from '@/hooks/useMyCases';
import { myCaseHref, type CaseHome } from '@/lib/conveyance/conveyance-routes';
import type { IssuanceLateness, IssuanceLatenessTier } from '@/lib/document-validity/issuance-delivery-due';
import { formatDate } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { EngagementOpenItem, EngagementOpenItemDue } from '@/types/my-engagements';

type Translate = ReturnType<typeof useTranslation>['t'];

const K = 'engagement.myCases.openItems.';

const OPEN_ITEMS_KEYS = {
  title: `${K}title`,
  lead: `${K}lead`,
  loading: `${K}loading`,
  loadError: `${K}loadError`,
  empty: `${K}empty`,
  office: `${K}office`,
  unnamedOffice: `${K}unnamedOffice`,
  open: `${K}open`,
} as const;

/** Κυριολεκτικά κλειδιά (CHECK 3.34) — `Record` στις ρίζες: νέο είδος ή βαθμίδα δεν μεταγλωττίζεται χωρίς λέξη. */
const DUE_KEYS: Readonly<Record<EngagementOpenItemDue, string>> = {
  delivery: `${K}due.delivery`,
  signing: `${K}due.signing`,
};

const COUNTDOWN_KEYS: Readonly<Record<EngagementOpenItemDue, Readonly<Record<IssuanceLatenessTier, string>>>> = {
  delivery: {
    overdue: `${K}countdown.delivery.overdue`,
    'due-today': `${K}countdown.delivery.due-today`,
    'due-soon': `${K}countdown.delivery.due-soon`,
    'on-track': `${K}countdown.delivery.on-track`,
    'no-due-date': `${K}countdown.delivery.no-due-date`,
  },
  signing: {
    overdue: `${K}countdown.signing.overdue`,
    'due-today': `${K}countdown.signing.due-today`,
    'due-soon': `${K}countdown.signing.due-soon`,
    'on-track': `${K}countdown.signing.on-track`,
    'no-due-date': `${K}countdown.signing.no-due-date`,
  },
};

/** Η λέξη της βαθμίδας για **αυτό** το είδος ημερομηνίας — οι αριθμητικές με `{count}` (πληθυντικός ICU). */
function countdownText(t: Translate, due: EngagementOpenItemDue, countdown: IssuanceLateness): string {
  const key = COUNTDOWN_KEYS[due][countdown.tier];
  switch (countdown.tier) {
    case 'overdue': return t(key, { count: countdown.days });
    case 'due-soon': return t(key, { count: countdown.daysLeft });
    default: return t(key);
  }
}

function OpenItemRow({ item, home }: { readonly item: EngagementOpenItem; readonly home: CaseHome }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const look = DUE_COUNTDOWN_LOOK[item.countdown.tier];
  const Icon = look.icon;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <article className="min-w-0">
        <h3 className="m-0 truncate text-sm font-medium text-foreground">{item.propertyName ?? t('engagement.myCases.untitled')}</h3>
        <p className={cn('m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', colors.text.muted)}>
          <span>{t(DUE_KEYS[item.due], { date: formatDate(item.dueOn) })}</span>
          <Badge variant={look.badge} className="gap-1 font-normal">
            <Icon className="size-3" aria-hidden="true" />
            {countdownText(t, item.due, item.countdown)}
          </Badge>
          <span>{t(OPEN_ITEMS_KEYS.office, { office: item.hostName ?? t(OPEN_ITEMS_KEYS.unnamedOffice) })}</span>
        </p>
      </article>
      <Link href={myCaseHref(item.engagementId, home)} className="text-sm font-medium text-foreground underline">{t(OPEN_ITEMS_KEYS.open)}</Link>
    </li>
  );
}

function OpenItemsBody({ state, home }: { readonly state: MyOpenItemsList; readonly home: CaseHome }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  if (state.state === 'loading') return <p className={cn('text-sm', colors.text.muted)}>{t(OPEN_ITEMS_KEYS.loading)}</p>;
  if (state.state === 'error') return <p className="text-sm text-destructive">{t(OPEN_ITEMS_KEYS.loadError)}</p>;
  if (state.items.length === 0) return <p className={cn('text-sm', colors.text.muted)}>{t(OPEN_ITEMS_KEYS.empty)}</p>;
  return (
    <ol className="divide-y divide-border">
      {state.items.map((item) => <OpenItemRow key={item.engagementId} item={item} home={home} />)}
    </ol>
  );
}

export function MyOpenItemsSection({ state, home }: { readonly state: MyOpenItemsList; readonly home: CaseHome }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <section aria-labelledby="my-open-items-title" className="space-y-2">
      <header>
        <h2 id="my-open-items-title" className="m-0 text-base font-semibold text-foreground">{t(OPEN_ITEMS_KEYS.title)}</h2>
        <p className={cn('m-0 text-sm', colors.text.muted)}>{t(OPEN_ITEMS_KEYS.lead)}</p>
      </header>
      <OpenItemsBody state={state} home={home} />
    </section>
  );
}
