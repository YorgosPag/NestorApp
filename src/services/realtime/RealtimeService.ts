/**
 * Centralized Real-time Event Bus
 *
 * Singleton service for cross-component / cross-tab event dispatch via
 * CustomEvent + localStorage. Data-driven design: a single RealtimeEventMap
 * replaces ~80 one-liner dispatch/subscribe methods with 2 generic
 * type-safe methods.
 *
 * ADR-355: Firestore real-time subscriptions live in `firestoreQueryService`
 * (tenant-aware, switcher-aware, auth-gated). This service no longer wraps
 * `onSnapshot`. The event-bus role (cross-tab sync, link/cascade signals) is
 * orthogonal and remains here.
 */

import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  type RealtimeEventMap,
  REALTIME_EVENTS,
  type BuildingProjectLinkPayload,
  type PropertyBuildingLinkPayload,
} from './types';

const logger = createModuleLogger('RealtimeService');

class RealtimeServiceCore {
  private static instance: RealtimeServiceCore;

  private constructor() {
    logger.info('Initialized');
  }

  static getInstance(): RealtimeServiceCore {
    if (!RealtimeServiceCore.instance) {
      RealtimeServiceCore.instance = new RealtimeServiceCore();
    }
    return RealtimeServiceCore.instance;
  }

  /**
   * Type-safe event dispatch: fires CustomEvent + writes to localStorage
   * for cross-tab sync.
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

  /**
   * Type-safe event subscription: listens for same-page CustomEvent +
   * cross-tab StorageEvent, optionally checks pending localStorage on mount.
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
    const event = new CustomEvent(REALTIME_EVENTS.PROPERTY_BUILDING_LINKED, {
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
}

export const RealtimeService = RealtimeServiceCore.getInstance();

export default RealtimeService;
