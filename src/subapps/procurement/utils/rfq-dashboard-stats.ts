/**
 * =============================================================================
 * ΟΙ ΚΑΡΤΕΣ ΤΗΣ ΣΕΛΙΔΑΣ RFQ — τι μετρούν και τι κάνει το κλικ (ADR-330 §5.1 S3.3)
 * =============================================================================
 *
 * 🔑 **Δόγμα S3.1/S3.2**: κάρτα με λίστα **ακριβώς από κάτω** = φίλτρο επί τόπου (`pressed`)·
 * κάρτα που ονομάζει **μία** εγγραφή = την ανοίγει· καθαρό σύνολο χωρίς λίστα να φιλτράρει = **όχι** clickable
 * (affordance inflation). Μηδέν ⇒ όχι φίλτρο (drill σε άδεια λίστα = αδιέξοδο) — εκτός αν είναι ήδη πατημένη.
 *
 * 🔑 **Η κάρτα μετρά ό,τι δείχνει η λίστα**: γραμμές = η υποσυλλογή `rfqs/{id}/lines` (Q29) που απαριθμεί το
 * `RfqLinesPanel` — όχι το legacy `rfq.lines`· προσκλήσεις = τα **ίδια** κατηγορήματα (`INVITE_FOCUS_PREDICATES`)
 * που φιλτράρουν τη λίστα.
 *
 * @module subapps/procurement/utils/rfq-dashboard-stats
 */

import {
  FileText, Clock, CheckCircle, TrendingDown, TrendingUp,
  ArrowDownUp, Sparkles, List, CalendarClock, Hourglass, AlertCircle,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { StatusDrill } from '@/components/projects/procurement/clients/useStatusDrillParam';
import { normalizeToMillisOrNull, deadlineDaysLeft } from '@/lib/date-local';
import { formatCurrency, formatDate, formatDeadlineRelative } from '@/lib/intl-formatting';
import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';
import { quoteVendorDisplayName, quoteVendorLabel } from '@/subapps/procurement/utils/quote-vendor-identity';
import type { VendorInvite } from '@/subapps/procurement/types/vendor-invite';
import type { QuoteComparisonResult } from '@/subapps/procurement/types/comparison';
import type { RFQ } from '@/subapps/procurement/types/rfq';
import type { RfqLine } from '@/subapps/procurement/types/rfq-line';
import type { RfqTabValue } from '@/subapps/procurement/hooks/useRfqUrlState';
import { INVITE_FOCUS_PREDICATES, inviteResponded, type InviteFocus } from './vendor-invite-status';

/** Κάτω από τόσες ημέρες η προθεσμία είναι «κοντά» (προειδοποίηση). */
export const RFQ_DEADLINE_NEAR_DAYS = 3;

export interface RfqDashboardInput {
  readonly rfq: RFQ | null;
  /** Η υποσυλλογή `rfqs/{id}/lines` — ό,τι απαριθμεί το `RfqLinesPanel`. */
  readonly lines: readonly RfqLine[];
  readonly linesLoading: boolean;
  /** Ενεργές προσφορές (χωρίς `superseded`) — ό,τι απαριθμεί η `QuoteList`. */
  readonly quotes: readonly Quote[];
  readonly invites: readonly VendorInvite[];
  readonly comparison: QuoteComparisonResult | null;
  readonly activeTab: RfqTabValue;
  readonly nowMs: number;
  readonly quoteFilter: StatusDrill<QuoteStatus>;
  readonly inviteFilter: StatusDrill<InviteFocus>;
  /** Ανοίγει μία προσφορά (καρτέλα «Προσφορές» + δεξί παράθυρο). */
  readonly onOpenQuote: (quoteId: string) => void;
  readonly t: TFunction;
}

/** Η προθεσμία του RFQ σε ms — μέσω του SSoT `normalizeToMillisOrNull` (Timestamp **ή** ISO). */
export function rfqDeadlineMs(rfq: Pick<RFQ, 'deadlineDate'> | null): number | null {
  return rfq?.deadlineDate ? normalizeToMillisOrNull(rfq.deadlineDate) : null;
}

/** Πόσες προσκλήσεις «χρειάζονται προσοχή» — ο ΙΔΙΟΣ αριθμός σε κάρτα **και** badge καρτέλας. */
export function countInvitesNeedingAttention(
  invites: readonly VendorInvite[], deadlineMs: number | null, nowMs: number,
): number {
  return invites.filter((i) => INVITE_FOCUS_PREDICATES.attention(i, deadlineMs, nowMs)).length;
}

/** Κάρτα-φίλτρο εναλλαγής: πατημένη ⇔ το φίλτρο είναι ακριβώς αυτή η τιμή· κλικ ξανά ⇒ αφαίρεση. */
function filterCard<S extends string>(
  drill: StatusDrill<S>, value: S, count: number,
): Pick<DashboardStat, 'pressed' | 'onActivate'> {
  const pressed = drill.statuses.length === 1 && drill.statuses[0] === value;
  if (count === 0 && !pressed) return {};
  return { pressed, onActivate: () => drill.set(pressed ? [] : [value]) };
}

interface PricedQuote {
  readonly id: string; readonly displayNumber: string; readonly total: number; readonly vendorName: string | null;
}

function pricedQuotes(quotes: readonly Quote[]): PricedQuote[] {
  return quotes.flatMap((q) => {
    const total = q.totals?.total;
    if (typeof total !== 'number' || total <= 0) return [];
    return [{ id: q.id, displayNumber: q.displayNumber, total, vendorName: quoteVendorDisplayName(q) }];
  });
}

function extremeQuote(priced: readonly PricedQuote[], pick: 'min' | 'max'): PricedQuote | null {
  return priced.reduce<PricedQuote | null>((acc, q) => {
    if (!acc) return q;
    return (pick === 'min' ? q.total < acc.total : q.total > acc.total) ? q : acc;
  }, null);
}

/** Κάρτα που ονομάζει **μία** προσφορά ⇒ την ανοίγει (πρότυπο «Apparent low» του BuildingConnected). */
function quoteCard(
  title: string, quote: PricedQuote | null, icon: DashboardStat['icon'], color: DashboardStat['color'],
  onOpenQuote: (id: string) => void, t: TFunction,
): DashboardStat {
  if (!quote) return { title, value: '—', icon, color };
  return {
    title, value: formatCurrency(quote.total, 'EUR', { maximumFractionDigits: 0 }),
    description: quoteVendorLabel(quote.vendorName, t, quote.displayNumber), icon, color,
    onActivate: () => onOpenQuote(quote.id),
  };
}

function quotesTab({ quotes, quoteFilter, onOpenQuote, t }: RfqDashboardInput): DashboardStat[] {
  const underReview = quotes.filter((q) => q.status === 'under_review').length;
  const accepted = quotes.filter((q) => q.status === 'accepted').length;
  const best = extremeQuote(pricedQuotes(quotes), 'min');
  return [
    { title: t('rfqs.dashboard.quotes.total'), value: quotes.length, icon: FileText, color: 'blue' },
    { title: t('rfqs.dashboard.quotes.underReview'), value: underReview, icon: Clock, color: 'orange',
      ...filterCard(quoteFilter, 'under_review', underReview) },
    { title: t('rfqs.dashboard.quotes.accepted'), value: accepted, icon: CheckCircle, color: 'green',
      ...filterCard(quoteFilter, 'accepted', accepted) },
    quoteCard(t('rfqs.dashboard.quotes.bestPrice'), best, TrendingDown, 'cyan', onOpenQuote, t),
  ];
}

function comparisonTab({ quotes, comparison, onOpenQuote, t }: RfqDashboardInput): DashboardStat[] {
  const priced = pricedQuotes(quotes);
  const best = extremeQuote(priced, 'min');
  const worst = extremeQuote(priced, 'max');
  const diff = best && worst ? worst.total - best.total : null;
  const recId = comparison?.recommendation?.quoteId ?? null;
  const recEntry = recId ? comparison?.quotes.find((e) => e.quoteId === recId) ?? null : null;
  return [
    quoteCard(t('rfqs.dashboard.comparison.bestPrice'), best, TrendingDown, 'green', onOpenQuote, t),
    quoteCard(t('rfqs.dashboard.comparison.worstPrice'), worst, TrendingUp, 'red', onOpenQuote, t),
    { title: t('rfqs.dashboard.comparison.priceDiff'),
      value: diff !== null ? formatCurrency(diff, 'EUR', { maximumFractionDigits: 0 }) : '—',
      icon: ArrowDownUp, color: 'orange' },
    { title: t('rfqs.dashboard.comparison.recommendation'), value: recEntry ? quoteVendorLabel(recEntry.vendorName, t, recEntry.displayNumber) : '—',
      icon: Sparkles, color: 'purple', ...(recEntry ? { onActivate: () => onOpenQuote(recEntry.quoteId) } : {}) },
  ];
}

/** Προέλευση γραμμών — μόνο ό,τι ισχύει («Από επιμετρήσεις», όχι «1 από επιμετρήσεις · 0 χειροκίνητες»). */
function linesSourceText(lines: readonly RfqLine[], t: TFunction): string | undefined {
  const boq = lines.filter((l) => l.source === 'boq').length;
  const adHoc = lines.length - boq;
  if (lines.length === 0) return undefined;
  if (adHoc === 0) return t('rfqs.dashboard.setup.linesAllBoq');
  if (boq === 0) return t('rfqs.dashboard.setup.linesAllAdHoc');
  return t('rfqs.dashboard.setup.linesBySource', { boq, adHoc });
}

function linesCard({ lines, linesLoading, t }: RfqDashboardInput): DashboardStat {
  return {
    title: t('rfqs.dashboard.setup.totalLines'), value: lines.length, icon: List, color: 'blue',
    loading: linesLoading, description: linesSourceText(lines, t),
  };
}

/** Αντίστροφη μέτρηση της προθεσμίας — ο κανόνας ημερών είναι του SSoT `deadlineDaysLeft` (προς τα πάνω). */
function deadlineCard({ rfq, nowMs, t }: RfqDashboardInput): DashboardStat {
  const title = t('rfqs.dashboard.setup.deadline');
  const ms = rfqDeadlineMs(rfq);
  if (ms === null) {
    return { title, value: '—', description: t('rfqs.dashboard.setup.deadlineNotSet'), icon: CalendarClock, color: 'gray' };
  }
  const daysLeft = deadlineDaysLeft(ms, nowMs);
  const color: DashboardStat['color'] = daysLeft === null ? 'red' : daysLeft <= RFQ_DEADLINE_NEAR_DAYS ? 'orange' : 'blue';
  return {
    title, icon: CalendarClock, color,
    value: daysLeft === null ? t('rfqs.dashboard.setup.deadlinePassed') : formatDeadlineRelative(ms),
    description: formatDate(ms),
  };
}

function setupTab(input: RfqDashboardInput): DashboardStat[] {
  const { rfq, invites, inviteFilter, nowMs, t } = input;
  const deadlineMs = rfqDeadlineMs(rfq);
  const awaiting = invites.filter((i) => INVITE_FOCUS_PREDICATES.awaiting(i, deadlineMs, nowMs)).length;
  const attention = countInvitesNeedingAttention(invites, deadlineMs, nowMs);
  const responded = invites.filter(inviteResponded).length;
  return [
    linesCard(input),
    deadlineCard(input),
    { title: t('rfqs.dashboard.setup.awaiting'), value: awaiting, icon: Hourglass, color: 'purple',
      description: invites.length > 0
        ? t('rfqs.dashboard.setup.responded', { responded, invited: invites.length })
        : undefined,
      ...filterCard(inviteFilter, 'awaiting', awaiting) },
    { title: t('rfqs.dashboard.setup.attention'), value: attention, icon: AlertCircle,
      color: attention > 0 ? 'yellow' : 'gray', ...filterCard(inviteFilter, 'attention', attention) },
  ];
}

export function buildRfqDashboardStats(input: RfqDashboardInput): DashboardStat[] {
  switch (input.activeTab) {
    case 'quotes':     return quotesTab(input);
    case 'comparison': return comparisonTab(input);
    case 'setup':      return setupTab(input);
    default:           return [];
  }
}
