'use client';

import { useEffect, useRef } from 'react';
import { where } from 'firebase/firestore';
import { toast } from 'sonner';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import type { Quote } from '@/subapps/procurement/types/quote';

const FRESH_WINDOW_MS = 60_000;
const AGGREGATE_WINDOW_MS = 5_000;
const AGGREGATE_THRESHOLD = 3;

export type LiveChangeEventType =
  | 'quote_added'
  | 'quote_confirmed'
  | 'quote_awarded'
  | 'quote_rejected'
  | 'line_edited';

export interface LiveChangeEvent {
  type: LiveChangeEventType;
  quoteId: string;
  vendor: string | null;
  total: number | null;
  actor: string | null;
  timestamp: number;
}

interface UseLiveChangeToastsOptions {
  rfqId: string;
  currentUserId: string | null;
  enabled?: boolean;
  onView?: (event: LiveChangeEvent) => void;
}

export function useLiveChangeToasts({
  rfqId,
  currentUserId,
  enabled = true,
  onView,
}: UseLiveChangeToastsOptions): void {
  const { t } = useTranslation('quotes');
  const previousByIdRef = useRef<Map<string, Quote>>(new Map());
  const initialDeliveredRef = useRef(false);
  const recentEventsRef = useRef<LiveChangeEvent[]>([]);

  useEffect(() => {
    if (!enabled || !rfqId) return;

    initialDeliveredRef.current = false;
    previousByIdRef.current = new Map();
    recentEventsRef.current = [];

    const unsubscribe = firestoreQueryService.subscribe<Quote>(
      'QUOTES',
      (result) => {
        const docs = result.documents as Quote[];
        const nextById = new Map(docs.map((q) => [q.id, q]));

        if (!initialDeliveredRef.current) {
          previousByIdRef.current = nextById;
          initialDeliveredRef.current = true;
          return;
        }

        const events = diffQuotes(previousByIdRef.current, nextById, currentUserId);
        previousByIdRef.current = nextById;
        if (events.length === 0) return;

        const now = Date.now();
        recentEventsRef.current = recentEventsRef.current.filter(
          (e) => now - e.timestamp < AGGREGATE_WINDOW_MS,
        );
        recentEventsRef.current.push(...events);

        if (recentEventsRef.current.length >= AGGREGATE_THRESHOLD) {
          const actorCounts = new Map<string, number>();
          for (const e of recentEventsRef.current) {
            const a = e.actor ?? '—';
            actorCounts.set(a, (actorCounts.get(a) ?? 0) + 1);
          }
          const [topActor, count] = [...actorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
          toast.info(
            t('rfqs.live.aggregated', { defaultValue: '', actor: topActor, count }),
            { duration: 5_000 },
          );
          recentEventsRef.current = [];
          return;
        }

        for (const event of events) {
          showToastForEvent(event, t, onView);
        }
      },
      () => {
        /* non-blocking — subscription errors are surfaced by primary hook */
      },
      { constraints: [where('rfqId', '==', rfqId)] },
    );

    return () => unsubscribe();
  }, [rfqId, currentUserId, enabled, onView, t]);
}

function diffQuotes(
  prev: Map<string, Quote>,
  next: Map<string, Quote>,
  currentUserId: string | null,
): LiveChangeEvent[] {
  const events: LiveChangeEvent[] = [];
  const now = Date.now();

  for (const [id, quote] of next) {
    const updatedByOther = quote.createdBy && quote.createdBy !== currentUserId;
    const updatedAtMs = quote.updatedAt?.toMillis?.() ?? 0;
    const isFresh = now - updatedAtMs < FRESH_WINDOW_MS;

    const before = prev.get(id);
    if (!before) {
      if (updatedByOther && isFresh) {
        events.push(buildEvent('quote_added', quote));
      }
      continue;
    }
    if (before.status !== quote.status && updatedByOther && isFresh) {
      const type = mapStatusChange(quote.status);
      if (type) events.push(buildEvent(type, quote));
    }
  }
  return events;
}

function mapStatusChange(status: Quote['status']): LiveChangeEventType | null {
  switch (status) {
    case 'under_review': return 'quote_confirmed';
    case 'accepted':     return 'quote_awarded';
    case 'rejected':     return 'quote_rejected';
    default:             return null;
  }
}

function buildEvent(type: LiveChangeEventType, quote: Quote): LiveChangeEvent {
  return {
    type,
    quoteId: quote.id,
    vendor: quote.extractedData?.vendorName?.value ?? null,
    total: quote.totals?.total ?? null,
    actor: quote.createdBy ?? null,
    timestamp: Date.now(),
  };
}

function showToastForEvent(
  event: LiveChangeEvent,
  t: ReturnType<typeof useTranslation>['t'],
  onView?: (event: LiveChangeEvent) => void,
): void {
  const keyByType: Record<LiveChangeEventType, string> = {
    quote_added:     'rfqs.live.newQuote',
    quote_confirmed: 'rfqs.live.quoteConfirmed',
    quote_awarded:   'rfqs.live.quoteAwarded',
    quote_rejected:  'rfqs.live.quoteRejected',
    line_edited:     'rfqs.live.lineEdited',
  };
  const message = t(keyByType[event.type], {
    defaultValue: '',
    vendor: event.vendor ?? '—',
    total: event.total != null ? formatCurrency(event.total) : '',
    actor: event.actor ?? '—',
  });
  toast.info(message, {
    duration: 5_000,
    action: onView
      ? {
          label: t('rfqs.live.viewAction', { defaultValue: '' }),
          onClick: () => onView(event),
        }
      : undefined,
  });
}
