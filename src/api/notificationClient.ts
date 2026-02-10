// api/notificationClient.ts
// ✅ ENTERPRISE: REST/SSE/WS client με ETag, backoff, heartbeat, polling fallback

import { ListResponse, AckRequest, ActionRequest, UserPreferences } from '@/types/notification';
import { ListResponseSchema, NotificationSchema, UserPreferencesSchema } from '@/schemas/notification';

export type ClientOptions = {
  baseUrl: string; // e.g. '/api/notifications'
  token?: string;  // bearer token if needed
  fetchImpl?: typeof fetch;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const jitter = (ms: number) => Math.round(ms * (0.5 + Math.random()));

export class NotificationClient {
  private base: string;
  private token?: string;
  private fetcher: typeof fetch;
  private etag?: string;

  constructor(opts: ClientOptions) {
    this.base = opts.baseUrl.replace(/\/$/, '');
    this.token = opts.token;
    // ✅ FIX: SSR-safe fetch binding (check if window exists)
    this.fetcher = opts.fetchImpl ?? (typeof window !== 'undefined' ? fetch.bind(window) : fetch);
  }

  private headers(extra?: Record<string, string>) {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(this.etag ? { 'If-None-Match': this.etag } : {}),
      ...extra,
    };
  }

  async list(params?: { cursor?: string; limit?: number; tags?: string[]; unseenOnly?: boolean }): Promise<ListResponse> {
    // ✅ SSR-safe: Build URL without location.origin
    // 🏢 ENTERPRISE: Use environment-configured development URL
    const fallbackUrl = process.env.NEXT_PUBLIC_DEV_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = new URL(this.base, typeof window !== 'undefined' ? location.origin : fallbackUrl);
    if (params?.cursor) url.searchParams.set('cursor', params.cursor);
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    if (params?.unseenOnly) url.searchParams.set('unseen', '1');
    if (params?.tags?.length) url.searchParams.set('tags', params.tags.join(','));

    const resp = await this.fetcher(url.toString(), { headers: this.headers() });
    if (resp.status === 304) return { items: [], cursor: undefined, etag: this.etag };
    if (!resp.ok) throw new Error(`list failed: ${resp.status}`);
    const etag = resp.headers.get('ETag') ?? undefined;
    if (etag) this.etag = etag;
    const json = await resp.json();
    const parsed = ListResponseSchema.parse(json);
    // runtime validate items too
    parsed.items.forEach(i => NotificationSchema.parse(i));
    // 🏢 ENTERPRISE: Type-safe cursor handling (cursor is string | undefined)
    return { items: parsed.items, cursor: parsed.cursor as string | undefined, etag } as ListResponse;
  }

  async ack(body: AckRequest) {
    const resp = await this.fetcher(`${this.base}/ack`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`ack failed: ${resp.status}`);
  }

  async act(body: ActionRequest) {
    const resp = await this.fetcher(`${this.base}/action`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`action failed: ${resp.status}`);
  }

  async getPrefs(): Promise<UserPreferences> {
    const r = await this.fetcher(`${this.base}/preferences`, { headers: this.headers() });
    if (!r.ok) throw new Error(`prefs failed: ${r.status}`);
    const json = await r.json();
    const parsed = UserPreferencesSchema.parse(json);
    return parsed as UserPreferences;
  }

  async setPrefs(p: Partial<UserPreferences>): Promise<void> {
    const r = await this.fetcher(`${this.base}/preferences`, { method: 'PUT', headers: this.headers(), body: JSON.stringify(p) });
    if (!r.ok) throw new Error(`setPrefs failed: ${r.status}`);
  }

  /** WebSocket with heartbeat + backoff. Falls back to SSE, then polling. */
  async subscribe(
    onEvent: (n: unknown) => void,
    opts: { wsUrl?: string; sseUrl?: string; pollMs?: number } = {}
  ) {
    // ✅ SSR-safe: Only run in browser
    if (typeof window === 'undefined') {
      console.warn('NotificationClient.subscribe() called during SSR - skipping');
      return;
    }

    const { wsUrl, sseUrl, pollMs = 30000 } = opts;
    let attempt = 0;

    const tryWS = () => new Promise<void>((resolve, reject) => {
      if (!wsUrl) return reject(new Error('no ws'));
      const ws = new WebSocket(wsUrl, this.token ? [this.token] : undefined);
      let alive = true;
      let hb: number | undefined;

      const ping = () => { try { ws.send(JSON.stringify({ type: 'ping' })); } catch { } };
      const startHB = () => { hb = window.setInterval(() => { if (!alive) ws.close(); alive = false; ping(); }, 15000); };

      ws.onopen = () => { alive = true; startHB(); resolve(); };
      ws.onmessage = (e) => {
        alive = true;
        try { onEvent(JSON.parse(e.data)); } catch { /* ignore */ }
      };
      ws.onclose = () => { if (hb) clearInterval(hb); reject(new Error('ws closed')); };
      ws.onerror = () => { if (hb) clearInterval(hb); reject(new Error('ws error')); };
    });

    const trySSE = () => new Promise<void>((resolve, reject) => {
      if (!sseUrl) return reject(new Error('no sse'));
      const ev = new EventSource(sseUrl, { withCredentials: !!this.token });
      ev.onopen = () => resolve();
      ev.onerror = () => { ev.close(); reject(new Error('sse error')); };
      ev.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch { } };
    });

    const tryPoll = async () => {
      // naive poll-only. In production keep a cursor and call list repeatedly.
      while (true) {
        try { const { items } = await this.list({ unseenOnly: true }); items.forEach(onEvent); } catch { }
        await sleep(pollMs);
      }
    };

    while (true) {
      try { await tryWS(); return; } catch { }
      try {
        await trySSE(); return;
      } catch { }
      // Final fallback: polling loop
      await tryPoll();
      // if poll returns, retry after backoff
      attempt++;
      await sleep(jitter(Math.min(60000, 1000 * 2 ** attempt)));
    }
  }
}
