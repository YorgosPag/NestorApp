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
  /** The current active provider — replaced on token refresh. */
  getProvider(): WebsocketProvider;
  /** Awareness of the current provider — invalidated after refreshToken(). */
  getAwareness(): Awareness;
  readonly roomId: string;
  /**
   * Tear down the current provider and reconnect with a freshly fetched
   * token. Local Y.Doc state is preserved (the doc is reused).
   */
  refreshToken(): Promise<void>;
  /** Stop syncing and tear down WebSocket + listeners. */
  destroy(): void;
}

function buildRoomId(o: Pick<YWebsocketClientOptions, 'companyId' | 'drawingId' | 'entityId'>): string {
  return `${o.companyId}:${o.drawingId}:${o.entityId}`;
}

function buildProvider(opts: YWebsocketClientOptions, roomId: string, token: string): WebsocketProvider {
  return new WebsocketProvider(opts.serverUrl, roomId, opts.doc, {
    params: { token },
  });
}

/**
 * Connect this client's Y.Doc to the Yjs sync server.
 *
 * Token refresh strategy: `WebsocketProvider.url` is read-only in v3, so
 * we cannot rotate the token on an existing provider. Callers invoke
 * `refreshToken()` (typically from a Firebase `onIdTokenChanged` hook or
 * before a known-expiry boundary); that destroys the current provider
 * and rebuilds it pointing at the same Y.Doc. CRDT semantics guarantee
 * the doc state survives this re-connect without conflicts.
 */
export async function connectYWebsocket(
  opts: YWebsocketClientOptions,
): Promise<YWebsocketClient> {
  const roomId = buildRoomId(opts);
  let currentProvider = buildProvider(opts, roomId, await opts.getToken());

  return {
    getProvider: () => currentProvider,
    getAwareness: () => currentProvider.awareness,
    roomId,
    refreshToken: async () => {
      const fresh = await opts.getToken();
      const oldProvider = currentProvider;
      currentProvider = buildProvider(opts, roomId, fresh);
      oldProvider.disconnect();
      oldProvider.destroy();
    },
    destroy: () => {
      currentProvider.disconnect();
      currentProvider.destroy();
    },
  };
}
