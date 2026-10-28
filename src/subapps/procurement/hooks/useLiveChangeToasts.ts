'use client';

/**
 * @fileoverview Ζωντανές ειδοποιήσεις αλλαγών RFQ από **άλλους** (ADR-328 §5.J.5 — μοτίβο Google Docs / Linear).
 *
 * - **Καμία δεύτερη συνδρομή**: διαβάζει τις προσφορές που ήδη φέρνει το `useQuotes` (onSnapshot) της σελίδας.
 * - **Ποιος**: `updatedBy` → όνομα από το SSoT `resolveUserDisplayName` (`users/{uid}`)· ποτέ ωμό uid.
 * - **Ριπή → ένα νέο**: τα γεγονότα μαζεύονται για `FLUSH_DELAY_MS` και συγχωνεύονται (`coalesceLiveChanges`).
 * - **Κρυφή καρτέλα**: τίποτα δεν εξαφανίζεται αθέατο — κρατιούνται και, στην επιστροφή, βγαίνει **περίληψη**.
 *
 * @adr ADR-328 §5.J.5
 */

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/hooks/useAuth';
import { resolveUserDisplayName } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { Quote } from '@/subapps/procurement/types/quote';
import {
  coalesceLiveChanges,
  diffQuoteChanges,
  liveToastActorId,
  type LiveChangeEvent,
  type LiveChangeToast,
} from '@/subapps/procurement/utils/live-change-events';
import { isVendorActorId, quoteVendorLabel } from '@/subapps/procurement/utils/quote-vendor-identity';

/** Παράθυρο ριπής: καλύπτει τις διαδοχικές εγγραφές μίας πράξης (π.χ. νικητής `under_review` → `accepted`). */
const FLUSH_DELAY_MS = 1_200;
/** Οι απορρίψεις των χαμένων γράφονται σειριακά μετά τον νικητή — ηχώ της ανάθεσης για τόσο χρόνο. */
const AWARD_ECHO_MS = 15_000;
const TOAST_DURATION_MS = 5_000;

type T = ReturnType<typeof useTranslation>['t'];

interface UseLiveChangeToastsOptions {
  rfqId: string;
  /** Οι προσφορές του RFQ όπως τις δίνει το `useQuotes` (ζωντανή εικόνα). */
  quotes: readonly Quote[];
  /** `false` όσο φορτώνει η πρώτη εικόνα — η πρώτη πλήρης εικόνα είναι η βάση, όχι αλλαγή. */
  ready: boolean;
  /** «Δες» → άνοιγμα της προσφοράς. */
  onView?: (quoteId: string) => void;
}

export function useLiveChangeToasts({ rfqId, quotes, ready, onView }: UseLiveChangeToastsOptions): void {
  const { t } = useTranslation('quotes');
  const { user } = useAuth();
  const currentUserId = user?.uid ?? null;
  const baselineRef = useRef<Map<string, Quote> | null>(null);
  const bufferRef = useRef<LiveChangeEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awardedAtRef = useRef<Map<string, number>>(new Map());
  /** Αυξάνει σε αλλαγή RFQ / unmount ⇒ ονόματα που λύθηκαν αργά για παλιά γενιά δεν εμφανίζονται. */
  const generationRef = useRef(0);
  const presenterRef = useRef({ t, onView });

  useEffect(() => {
    presenterRef.current = { t, onView };
  }, [t, onView]);

  const flush = useCallback(() => {
    timerRef.current = null;
    if (document.hidden || bufferRef.current.length === 0) return;
    const toasts = coalesceLiveChanges(bufferRef.current, recentAwardActors(awardedAtRef.current));
    bufferRef.current = [];
    rememberAwards(toasts, awardedAtRef.current);
    const generation = generationRef.current;
    void presentToasts(toasts, () => presenterRef.current, () => generationRef.current === generation);
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current === null && !document.hidden) timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    generationRef.current += 1;
    baselineRef.current = null;
    bufferRef.current = [];
    awardedAtRef.current.clear();
  }, [rfqId]);

  useEffect(() => {
    if (!ready) return;
    const prev = baselineRef.current;
    baselineRef.current = new Map(quotes.map((q) => [q.id, q]));
    if (!prev) return;
    const events = diffQuoteChanges(prev, quotes, { currentUserId, nowMs: Date.now() });
    if (events.length === 0) return;
    bufferRef.current.push(...events);
    schedule();
  }, [quotes, ready, currentUserId, schedule]);

  useEffect(() => {
    document.addEventListener('visibilitychange', schedule);
    return () => {
      document.removeEventListener('visibilitychange', schedule);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      generationRef.current += 1;
    };
  }, [schedule]);
}

function recentAwardActors(awardedAt: Map<string, number>): Set<string> {
  const now = Date.now();
  for (const [actorId, at] of awardedAt) if (now - at > AWARD_ECHO_MS) awardedAt.delete(actorId);
  return new Set(awardedAt.keys());
}

function rememberAwards(toasts: readonly LiveChangeToast[], awardedAt: Map<string, number>): void {
  for (const plan of toasts) {
    if (plan.kind === 'single' && plan.event.type === 'quote_awarded') awardedAt.set(plan.event.actorId, Date.now());
  }
}

/** Ονόματα των ενεργών (εσωτερικοί χρήστες μόνο — ο προμηθευτής δεν ζει στο `users/{uid}`). */
async function resolveActorNames(toasts: readonly LiveChangeToast[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const plan of toasts) {
    const actorId = liveToastActorId(plan);
    if (actorId && !isVendorActorId(actorId)) ids.add(actorId);
  }
  const pairs = await Promise.all([...ids].map(async (id) => [id, await resolveUserDisplayName(id)] as const));
  return new Map(pairs.filter(([, name]) => name !== ''));
}

async function presentToasts(
  toasts: readonly LiveChangeToast[],
  presenter: () => { t: T; onView?: (quoteId: string) => void },
  isCurrent: () => boolean,
): Promise<void> {
  if (toasts.length === 0) return;
  const names = await resolveActorNames(toasts);
  if (!isCurrent()) return;
  const { t, onView } = presenter();
  for (const plan of toasts) {
    const focus = plan.kind === 'single' ? plan.event : plan.focus;
    toast.info(liveToastMessage(plan, names, t), {
      duration: TOAST_DURATION_MS,
      action: onView ? { label: t('rfqs.live.viewAction', { defaultValue: '' }), onClick: () => onView(focus.quoteId) } : undefined,
    });
  }
}

const NAMED_KEY = {
  quote_confirmed: 'rfqs.live.quoteConfirmed',
  quote_awarded: 'rfqs.live.quoteAwarded',
  quote_rejected: 'rfqs.live.quoteRejected',
} as const;

/** Όνομα άγνωστο (π.χ. χωρίς προφίλ) ⇒ απρόσωπη διατύπωση — ποτέ uid, ποτέ «Η/Ο —». */
const UNATTRIBUTED_KEY = {
  quote_confirmed: 'rfqs.live.unattributed.quoteConfirmed',
  quote_awarded: 'rfqs.live.unattributed.quoteAwarded',
  quote_rejected: 'rfqs.live.unattributed.quoteRejected',
} as const;

function liveToastMessage(plan: LiveChangeToast, names: ReadonlyMap<string, string>, t: T): string {
  if (plan.kind === 'newQuotes') return t('rfqs.live.newQuotesAggregated', { defaultValue: '', count: plan.count });
  const actor = names.get(plan.kind === 'actorBurst' ? plan.actorId : plan.event.actorId);
  if (plan.kind === 'actorBurst') {
    return actor
      ? t('rfqs.live.aggregated', { defaultValue: '', actor, count: plan.count })
      : t('rfqs.live.unattributed.aggregated', { defaultValue: '', count: plan.count });
  }
  const { event } = plan;
  const vendor = quoteVendorLabel(event.vendor, t, event.quoteNumber);
  if (event.type === 'quote_added') {
    return event.total
      ? t('rfqs.live.newQuote', { defaultValue: '', vendor, total: formatCurrency(event.total) })
      : t('rfqs.live.newQuoteNoTotal', { defaultValue: '', vendor });
  }
  return actor
    ? t(NAMED_KEY[event.type], { defaultValue: '', actor, vendor })
    : t(UNATTRIBUTED_KEY[event.type], { defaultValue: '', vendor });
}
