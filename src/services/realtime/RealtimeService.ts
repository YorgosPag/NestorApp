/**
 * Centralized Real-time Service
 *
 * Singleton service that manages Firestore real-time subscriptions
 * and cross-component / cross-tab event dispatch.
 *
 * Data-driven design: a single RealtimeEventMap replaces ~80 one-liner
 * dispatch/subscribe methods with 2 generic type-safe methods.
 */

import {
  collection,
  doc,
  onSnapshot,
  query,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  type RealtimeCollection,
  type RealtimeQueryOptions,
  type RealtimeDocOptions,
  type SubscriptionStatus,
  type RealtimeEventMap,
  REALTIME_EVENTS,
  type BuildingProjectLinkPayload,
  type PropertyBuildingLinkPayload,
} from './types';

const logger = createModuleLogger('RealtimeService');

// ============================================================================
// SUBSCRIPTION REGISTRY
// ============================================================================

interface SubscriptionEntry {
  id: string;
  collection: RealtimeCollection;
  unsubscribe: Unsubscribe;
  status: SubscriptionStatus;
  createdAt: number;
}

type RealtimeDocument = DocumentData & { id: string };

// ============================================================================
// REALTIME SERVICE CLASS
// ============================================================================

class RealtimeServiceCore {
  private static instance: RealtimeServiceCore;
  private subscriptions: Map<string, SubscriptionEntry> = new Map();
  /** Track permission errors to log once per collection, not per retry */
  private permissionErrorsSeen: Set<string> = new Set();

  private constructor() {
    logger.info('Initialized');
  }

  static getInstance(): RealtimeServiceCore {
    if (!RealtimeServiceCore.instance) {
      RealtimeServiceCore.instance = new RealtimeServiceCore();
    }
    return RealtimeServiceCore.instance;
  }

  // ==========================================================================
  // COLLECTION SUBSCRIPTION (Firestore onSnapshot)
  // ==========================================================================

  subscribeToCollection(
    options: RealtimeQueryOptions,
    onData: (data: RealtimeDocument[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const { collection: collectionName, constraints = [], enabled = true } = options;

    if (!enabled) {
      return () => {};
    }

    const subscriptionId = this.generateSubscriptionId(collectionName, constraints);

    if (this.subscriptions.has(subscriptionId)) {
      logger.debug(`Reusing existing subscription: ${subscriptionId}`);
      return () => this.unsubscribe(subscriptionId);
    }

    logger.debug(`Creating subscription: ${subscriptionId}`);

    const collectionRef = collection(db, collectionName);
    const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

    const unsubscribeFn = onSnapshot(
      q,
      (snapshot) => {
        const data: RealtimeDocument[] = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }));
        logger.debug(`${collectionName}: Received ${data.length} documents`);
        onData(data);
      },
      (error) => {
        this.handleSubscriptionError(subscriptionId, collectionName, error, onError);
      }
    );

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      collection: collectionName,
      unsubscribe: unsubscribeFn,
      status: 'active',
      createdAt: Date.now(),
    });

    return () => this.unsubscribe(subscriptionId);
  }

  // ==========================================================================
  // DOCUMENT SUBSCRIPTION (Firestore onSnapshot)
  // ==========================================================================

  subscribeToDocument(
    options: RealtimeDocOptions,
    onData: (data: RealtimeDocument | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const { collection: collectionName, documentId, enabled = true } = options;

    if (!enabled || !documentId) {
      return () => {};
    }

    const subscriptionId = `${collectionName}:doc:${documentId}`;

    if (this.subscriptions.has(subscriptionId)) {
      logger.debug(`Reusing existing doc subscription: ${subscriptionId}`);
      return () => this.unsubscribe(subscriptionId);
    }

    logger.debug(`Creating doc subscription: ${subscriptionId}`);

    const docRef = doc(db, collectionName, documentId);

    const unsubscribeFn = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data: RealtimeDocument = { id: snapshot.id, ...snapshot.data() };
          logger.debug(`${collectionName}/${documentId}: Updated`);
          onData(data);
        } else {
          logger.debug(`${collectionName}/${documentId}: Does not exist`);
          onData(null);
        }
      },
      (error) => {
        this.handleSubscriptionError(subscriptionId, `${collectionName}/${documentId}`, error, onError);
      }
    );

    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      collection: collectionName,
      unsubscribe: unsubscribeFn,
      status: 'active',
      createdAt: Date.now(),
    });

    return () => this.unsubscribe(subscriptionId);
  }

  // ==========================================================================
  // GENERIC DISPATCH — replaces 55 one-liner dispatch methods
  // ==========================================================================

  /**
   * Type-safe event dispatch: fires CustomEvent + writes to localStorage
   * for cross-tab sync.
   *
   * @example
   * RealtimeService.dispatch('PROJECT_UPDATED', { projectId, updates, timestamp: Date.now() });
   */
  dispatch<K extends keyof RealtimeEventMap>(event: K, payload: RealtimeEventMap[K]): void {
    const eventName = REALTIME_EVENTS[event];
    logger.debug(`Dispatching ${event}`);

    const customEvent = new CustomEvent(eventName, { detail: payload, bubbles: true });
    window.dispatchEvent(customEvent);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(eventName, JSON.stringify(payload));
      } catch (error) {
        logger.warn('localStorage notification failed', { error });
      }
    }
  }

  // ==========================================================================
  // GENERIC SUBSCRIBE — replaces 24 one-liner subscribe methods
  // ==========================================================================

  /**
   * Type-safe event subscription: listens for same-page CustomEvent +
   * cross-tab StorageEvent, optionally checks pending localStorage on mount.
   *
   * @example
   * const unsub = RealtimeService.subscribe('PROJECT_UPDATED', (payload) => {
   *   console.log(payload.projectId, payload.updates);
   * });
   */
  subscribe<K extends keyof RealtimeEventMap>(
    event: K,
    callback: (payload: RealtimeEventMap[K]) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const eventName = REALTIME_EVENTS[event];
    const checkPending = options?.checkPendingOnMount ?? true;

    const handleCustomEvent = (evt: Event) => {
      const detail = (evt as CustomEvent<RealtimeEventMap[K]>).detail;
      if (detail) {
        logger.debug(`Same-page ${event}`);
        callback(detail);
      }
    };

    const handleStorageEvent = (evt: StorageEvent) => {
      if (evt.key !== eventName || !evt.newValue) return;
      const parsed = safeJsonParse<RealtimeEventMap[K]>(evt.newValue, null as unknown as RealtimeEventMap[K]);
      if (parsed === null) {
        logger.error(`Failed to parse ${event}`);
        return;
      }
      logger.debug(`Cross-page ${event}`);
      callback(parsed);
    };

    if (checkPending && typeof window !== 'undefined') {
      const pendingRaw = localStorage.getItem(eventName);
      if (pendingRaw) {
        const pending = safeJsonParse<RealtimeEventMap[K] & { timestamp: number }>(pendingRaw, null as unknown as RealtimeEventMap[K] & { timestamp: number });
        if (pending === null) {
          logger.error(`Failed to process pending ${event}`);
        } else {
          if (Date.now() - pending.timestamp < 5000) {
            logger.debug(`Applying pending ${event}`);
            callback(pending);
          }
          localStorage.removeItem(eventName);
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(eventName, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(eventName, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // SPECIAL DISPATCH METHODS (extra logic — kept manually)
  // ==========================================================================

  dispatchBuildingProjectLinked(payload: BuildingProjectLinkPayload): void {
    const event = new CustomEvent(REALTIME_EVENTS.BUILDING_PROJECT_LINKED, {
      detail: payload,
      bubbles: true,
    });
    window.dispatchEvent(event);
    window.dispatchEvent(
      new CustomEvent(REALTIME_EVENTS.NAVIGATION_REFRESH, {
        detail: { timestamp: Date.now() },
        bubbles: true,
      })
    );
  }

  dispatchPropertyBuildingLinked(payload: PropertyBuildingLinkPayload): void {
    const event = new CustomEvent(REALTIME_EVENTS.UNIT_BUILDING_LINKED, {
      detail: payload,
      bubbles: true,
    });
    window.dispatchEvent(event);
    window.dispatchEvent(
      new CustomEvent(REALTIME_EVENTS.NAVIGATION_REFRESH, {
        detail: { timestamp: Date.now() },
        bubbles: true,
      })
    );
  }

  // ==========================================================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================================================

  private unsubscribe(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (entry) {
      logger.debug(`Unsubscribing: ${subscriptionId}`);
      entry.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  unsubscribeCollection(collectionName: RealtimeCollection): void {
    for (const [id, entry] of this.subscriptions) {
      if (entry.collection === collectionName) {
        this.unsubscribe(id);
      }
    }
  }

  unsubscribeAll(): void {
    logger.debug(`Unsubscribing from all (${this.subscriptions.size} subscriptions)`);
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id);
    }
  }

  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getSubscriptionStatus(subscriptionId: string): SubscriptionStatus {
    return this.subscriptions.get(subscriptionId)?.status || 'idle';
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private generateSubscriptionId(
    collectionName: RealtimeCollection,
    constraints: QueryConstraint[]
  ): string {
    const constraintStr = constraints.length > 0 ? `:${constraints.length}constraints` : '';
    return `${collectionName}${constraintStr}:${Date.now()}`;
  }

  /**
   * Centralized error handler for Firestore onSnapshot subscriptions.
   *
   * - permission-denied: log ONCE per source, auto-unsubscribe (stops retry flood)
   * - other errors: log normally, keep subscription alive for transient issues
   */
  private handleSubscriptionError(
    subscriptionId: string,
    source: string,
    error: Error,
    onError?: (error: Error) => void
  ): void {
    const isPermissionDenied =
      error.message?.includes('Missing or insufficient permissions') ||
      error.message?.includes('permission-denied') ||
      (error as { code?: string }).code === 'permission-denied';

    if (isPermissionDenied) {
      // Log once per source to prevent console flood
      if (!this.permissionErrorsSeen.has(source)) {
        this.permissionErrorsSeen.add(source);
        logger.warn(`${source}: permission denied — auto-unsubscribed (Firestore rules may need update)`);
      }
      // Auto-unsubscribe to stop the retry loop that floods the console
      this.updateSubscriptionStatus(subscriptionId, 'error');
      this.unsubscribe(subscriptionId);
      onError?.(error);
      return;
    }

    // Non-permission errors: log and keep alive (may be transient)
    logger.error(`${source} error`, { error });
    this.updateSubscriptionStatus(subscriptionId, 'error');
    onError?.(error);
  }

  private updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (entry) {
      entry.status = status;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const RealtimeService = RealtimeServiceCore.getInstance();

export default RealtimeService;
