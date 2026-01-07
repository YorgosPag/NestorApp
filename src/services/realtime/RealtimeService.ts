/**
 * 🏢 ENTERPRISE: Centralized Real-time Service
 *
 * Singleton service that manages Firestore real-time subscriptions.
 * Based on the proven pattern from useProjectFloorplans.ts
 *
 * Features:
 * - Type-safe onSnapshot subscriptions
 * - Automatic cleanup on unsubscribe
 * - Event dispatch for cross-component communication
 * - Subscription deduplication
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
import {
  type RealtimeCollection,
  type RealtimeQueryOptions,
  type RealtimeDocOptions,
  type SubscriptionStatus,
  REALTIME_EVENTS,
  type BuildingProjectLinkPayload,
  type UnitBuildingLinkPayload,
} from './types';

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

// ============================================================================
// REALTIME SERVICE CLASS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Singleton Real-time Service
 */
class RealtimeServiceCore {
  private static instance: RealtimeServiceCore;
  private subscriptions: Map<string, SubscriptionEntry> = new Map();

  private constructor() {
    // Private constructor for singleton
    console.log('🔔 [RealtimeService] Initialized');
  }

  static getInstance(): RealtimeServiceCore {
    if (!RealtimeServiceCore.instance) {
      RealtimeServiceCore.instance = new RealtimeServiceCore();
    }
    return RealtimeServiceCore.instance;
  }

  // ==========================================================================
  // COLLECTION SUBSCRIPTION
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Subscribe to a collection query with real-time updates
   */
  subscribeToCollection<T extends DocumentData>(
    options: RealtimeQueryOptions,
    onData: (data: T[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const { collection: collectionName, constraints = [], enabled = true } = options;

    if (!enabled) {
      return () => {}; // No-op unsubscribe
    }

    const subscriptionId = this.generateSubscriptionId(collectionName, constraints);

    // Check for existing subscription
    if (this.subscriptions.has(subscriptionId)) {
      console.log(`🔄 [RealtimeService] Reusing existing subscription: ${subscriptionId}`);
      return () => this.unsubscribe(subscriptionId);
    }

    console.log(`🔔 [RealtimeService] Creating subscription: ${subscriptionId}`);

    const collectionRef = collection(db, collectionName);
    const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        })) as T[];

        console.log(`📡 [RealtimeService] ${collectionName}: Received ${data.length} documents`);
        onData(data);
      },
      (error) => {
        console.error(`❌ [RealtimeService] ${collectionName} error:`, error);
        this.updateSubscriptionStatus(subscriptionId, 'error');
        onError?.(error);
      }
    );

    // Register subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      collection: collectionName,
      unsubscribe,
      status: 'active',
      createdAt: Date.now(),
    });

    return () => this.unsubscribe(subscriptionId);
  }

  // ==========================================================================
  // DOCUMENT SUBSCRIPTION
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Subscribe to a single document with real-time updates
   */
  subscribeToDocument<T extends DocumentData>(
    options: RealtimeDocOptions,
    onData: (data: T | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const { collection: collectionName, documentId, enabled = true } = options;

    if (!enabled || !documentId) {
      return () => {}; // No-op unsubscribe
    }

    const subscriptionId = `${collectionName}:doc:${documentId}`;

    // Check for existing subscription
    if (this.subscriptions.has(subscriptionId)) {
      console.log(`🔄 [RealtimeService] Reusing existing doc subscription: ${subscriptionId}`);
      return () => this.unsubscribe(subscriptionId);
    }

    console.log(`🔔 [RealtimeService] Creating doc subscription: ${subscriptionId}`);

    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = { id: snapshot.id, ...snapshot.data() } as T;
          console.log(`📡 [RealtimeService] ${collectionName}/${documentId}: Updated`);
          onData(data);
        } else {
          console.log(`📡 [RealtimeService] ${collectionName}/${documentId}: Does not exist`);
          onData(null);
        }
      },
      (error) => {
        console.error(`❌ [RealtimeService] ${collectionName}/${documentId} error:`, error);
        this.updateSubscriptionStatus(subscriptionId, 'error');
        onError?.(error);
      }
    );

    // Register subscription
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      collection: collectionName,
      unsubscribe,
      status: 'active',
      createdAt: Date.now(),
    });

    return () => this.unsubscribe(subscriptionId);
  }

  // ==========================================================================
  // EVENT DISPATCH
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch real-time event for cross-component communication
   */
  dispatchEvent<T>(eventType: string, payload: T): void {
    console.log(`📤 [RealtimeService] Dispatching event: ${eventType}`, payload);

    const event = new CustomEvent(eventType, {
      detail: payload,
      bubbles: true,
    });

    window.dispatchEvent(event);
  }

  /**
   * 🏢 ENTERPRISE: Dispatch building-project link event
   */
  dispatchBuildingProjectLinked(payload: BuildingProjectLinkPayload): void {
    this.dispatchEvent(REALTIME_EVENTS.BUILDING_PROJECT_LINKED, payload);
    // Also trigger navigation refresh
    this.dispatchEvent(REALTIME_EVENTS.NAVIGATION_REFRESH, { timestamp: Date.now() });
  }

  /**
   * 🏢 ENTERPRISE: Dispatch unit-building link event
   */
  dispatchUnitBuildingLinked(payload: UnitBuildingLinkPayload): void {
    this.dispatchEvent(REALTIME_EVENTS.UNIT_BUILDING_LINKED, payload);
    // Also trigger navigation refresh
    this.dispatchEvent(REALTIME_EVENTS.NAVIGATION_REFRESH, { timestamp: Date.now() });
  }

  // ==========================================================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Unsubscribe from a specific subscription
   */
  private unsubscribe(subscriptionId: string): void {
    const entry = this.subscriptions.get(subscriptionId);
    if (entry) {
      console.log(`🔕 [RealtimeService] Unsubscribing: ${subscriptionId}`);
      entry.unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * 🏢 ENTERPRISE: Unsubscribe from all subscriptions for a collection
   */
  unsubscribeCollection(collectionName: RealtimeCollection): void {
    for (const [id, entry] of this.subscriptions) {
      if (entry.collection === collectionName) {
        this.unsubscribe(id);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    console.log(`🔕 [RealtimeService] Unsubscribing from all (${this.subscriptions.size} subscriptions)`);
    for (const [id] of this.subscriptions) {
      this.unsubscribe(id);
    }
  }

  /**
   * 🏢 ENTERPRISE: Get active subscription count
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * 🏢 ENTERPRISE: Get subscription status
   */
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
    // Generate unique ID based on collection and constraints
    const constraintStr = constraints.length > 0 ? `:${constraints.length}constraints` : '';
    return `${collectionName}${constraintStr}:${Date.now()}`;
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
