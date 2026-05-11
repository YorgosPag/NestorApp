/**
 * ADR-344 Phase 4 — y-websocket client wrapper with Firebase Auth.
 *
 * Wraps `WebsocketProvider` from y-websocket so every browser session
 * authenticates against the self-hosted Yjs sync server using a fresh
 * Firebase ID token. The token is re-fetched on reconnect so long
 * sessions survive token expiry without losing the local doc.
 *
 * The collaborative room id is `${companyId}:${drawingId}:${entityId}` —
 * tenant-scoped per ADR-326, drawing- and entity-scoped so different
 * MTEXT entities sync independently.
 *
 * @module text-engine/collab/y-websocket-client
 */

import { WebsocketProvider } from 'y-websocket';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

export interface YWebsocketClientOptions {
  /** Self-hosted Yjs sync server URL (wss://…). */
  readonly serverUrl: string;
  /** Tenant scope. */
  readonly companyId: string;
  /** DXF drawing identifier. */
  readonly drawingId: string;
  /** MTEXT entity enterprise ID. */
  readonly entityId: string;
  /** Y.Doc for this entity. */
  readonly doc: Y.Doc;
  /**
   * Returns a fresh Firebase Auth ID token. Called on connect AND on
   * reconnect — must not be cached at the call site.
   */
  readonly getToken: () => Promise<string>;
}

export interface YWebsocketClient {
  readonly provider: WebsocketProvider;
  readonly awareness: Awareness;
  readonly roomId: string;
  /** Stop syncing and tear down WebSocket + listeners. */
  readonly destroy: () => void;
}

function buildRoomId(o: Pick<YWebsocketClientOptions, 'companyId' | 'drawingId' | 'entityId'>): string {
  return `${o.companyId}:${o.drawingId}:${o.entityId}`;
}

/**
 * Connect this client's Y.Doc to the Yjs sync server.
 *
 * The token is refreshed every time the underlying WebSocket re-opens
 * (initial connect + any auto-reconnect after disconnect). The Y.Doc is
 * NOT cleared on disconnect — local edits queue and replay on reconnect.
 */
export async function connectYWebsocket(
  opts: YWebsocketClientOptions,
): Promise<YWebsocketClient> {
  const roomId = buildRoomId(opts);
  const initialToken = await opts.getToken();

  const provider = new WebsocketProvider(opts.serverUrl, roomId, opts.doc, {
    params: { token: initialToken },
  });

  // Refresh token on every (re)connect — handler must be sync so we
  // mutate params before WebsocketProvider re-opens the socket.
  provider.on('status', (event: { status: 'connected' | 'disconnected' | 'connecting' }) => {
    if (event.status === 'disconnected') {
      // schedule async refresh; next connecting cycle picks up the new value
      opts.getToken().then((fresh) => {
        provider.url = `${opts.serverUrl}?token=${encodeURIComponent(fresh)}`;
      }).catch(() => {/* keep stale token; server will reject and we'll retry */});
    }
  });

  return {
    provider,
    awareness: provider.awareness,
    roomId,
    destroy: () => {
      provider.disconnect();
      provider.destroy();
    },
  };
}
