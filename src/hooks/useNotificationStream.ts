// hooks/useNotificationStream.ts
// ✅ ENTERPRISE: Συνδυάζει initial fetch + real-time stream + dedup

import { useEffect, useMemo } from 'react';
import { NotificationClient } from '@/api/notificationClient';
import { useNotificationCenter } from '@/stores/notificationCenter';
import type { Notification } from '@/types/notification';

export type StreamOptions = {
  baseUrl: string;
  token?: string;
  pageSize?: number;
  wsUrl?: string;
  sseUrl?: string;
  pollMs?: number;
};

/**
 * Συνδυάζει initial fetch + real-time stream + dedup.
 * Επαναχρησιμοποιεί το Zustand store για κατανάλωση από Bell/Drawer.
 */
export function useNotificationStream(opts: StreamOptions) {
  const center = useNotificationCenter();

  // ✅ SSR-safe: Only create client in browser
  const client = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new NotificationClient({ baseUrl: opts.baseUrl, token: opts.token });
  }, [opts.baseUrl, opts.token]);

  useEffect(() => {
    // Skip if no client (SSR)
    if (!client) return;

    let abort = new AbortController();
    let cancelled = false;
    const loadInitial = async () => {
      try {
        center.setStatus('loading');
        const { items, cursor } = await client.list({ limit: opts.pageSize ?? 50 });
        if (cancelled) return;
        center.ingest(items as Notification[]);
        center.setCursor(cursor);
        center.setStatus('ready');
      } catch (e: any) {
        center.setError(String(e?.message ?? e));
        center.setStatus('error');
      }
    };

    loadInitial();

    client.subscribe((evt) => {
      // αναμένουμε { type: 'notification', data: Notification } ή σκέτο Notification
      const data = (evt as any)?.data ?? evt;
      if (data && (data as any).id) center.addOrUpdate(data as Notification);
    }, { wsUrl: opts.wsUrl, sseUrl: opts.sseUrl, pollMs: opts.pollMs }).catch(() => {/* noop */ });

    return () => { cancelled = true; abort.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.baseUrl, opts.token, opts.wsUrl, opts.sseUrl, opts.pollMs]);

  const loadMore = async () => {
    if (!client) return; // SSR-safe
    const cursor = useNotificationCenter.getState().cursor;
    const { items, cursor: next } = await client.list({ cursor, limit: opts.pageSize ?? 50 });
    center.ingest(items as Notification[]);
    center.setCursor(next);
  };

  const markReadRemote = async (ids?: string[]) => {
    if (!client) return; // SSR-safe
    const seenAt = new Date().toISOString();
    center.markRead(ids);
    try { await client.ack({ ids: ids ?? useNotificationCenter.getState().order, seenAt }); } catch {/* best-effort */ }
  };

  const performAction = async (id: string, actionId: string, payload?: Record<string, unknown>) => {
    if (!client) return; // SSR-safe
    await client.act({ id, actionId, payload });
  };

  return { loadMore, markReadRemote, performAction };
}
