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
  REALTIME_STORAGE_KEYS,
  type BuildingProjectLinkPayload,
  type UnitBuildingLinkPayload,
  type ProjectUpdatedPayload,
  type BuildingUpdatedPayload,
  type UnitUpdatedPayload,
  type ContactUpdatedPayload,
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

  /**
   * 🏢 ENTERPRISE: Dispatch project updated event (CENTRALIZED)
   *
   * Single source of truth for project updates across all pages:
   * - Navigation (/navigation)
   * - Audit (/audit)
   * - DXF Viewer (/dxf/viewer)
   * - Any future page that needs project data
   *
   * Features:
   * 1. Same-page sync via CustomEvent
   * 2. Cross-page sync via localStorage (storage events)
   * 3. Pending update check for page loads
   */
  dispatchProjectUpdated(payload: ProjectUpdatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching PROJECT_UPDATED:', payload.projectId);

    // 1. Same-page real-time update via CustomEvent
    this.dispatchEvent(REALTIME_EVENTS.PROJECT_UPDATED, payload);

    // 2. Cross-page sync via localStorage (client-side only)
    // Storage events propagate to OTHER tabs automatically
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.PROJECT_UPDATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage write failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to project updates (CENTRALIZED)
   *
   * Creates listeners for both same-page and cross-page updates.
   * Returns cleanup function for React useEffect.
   *
   * @param onUpdate - Callback when project is updated
   * @param options - Optional configuration
   */
  subscribeToProjectUpdates(
    onUpdate: (payload: ProjectUpdatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    // 1. Same-page listener (CustomEvent)
    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ProjectUpdatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page project update:', customEvent.detail.projectId);
        onUpdate(customEvent.detail);
      }
    };

    // 2. Cross-page listener (localStorage storage event)
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.PROJECT_UPDATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as ProjectUpdatedPayload;
        console.log('📡 [RealtimeService] Cross-page project update:', payload.projectId);
        onUpdate(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse storage event:', error);
      }
    };

    // 3. Check for pending updates on mount (client-side only)
    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.PROJECT_UPDATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as ProjectUpdatedPayload;
          // Only apply if update was recent (within last 5 seconds)
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending project update:', payload.projectId);
            onUpdate(payload);
          }
          // Clear after processing
          localStorage.removeItem(REALTIME_STORAGE_KEYS.PROJECT_UPDATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending update:', error);
      }
    }

    // Register listeners (client-side only)
    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.PROJECT_UPDATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    // Return cleanup function
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.PROJECT_UPDATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // BUILDING REAL-TIME SYNC
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch building updated event (CENTRALIZED)
   *
   * Single source of truth for building updates across all pages.
   * NOTE: Data is saved to Firestore, localStorage is ONLY for cross-tab notification.
   */
  dispatchBuildingUpdated(payload: BuildingUpdatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching BUILDING_UPDATED:', payload.buildingId);

    // 1. Same-page real-time update via CustomEvent
    this.dispatchEvent(REALTIME_EVENTS.BUILDING_UPDATED, payload);

    // 2. Cross-page notification via localStorage (client-side only)
    // NOTE: This does NOT store data - it only triggers storage events in other tabs
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.BUILDING_UPDATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to building updates (CENTRALIZED)
   */
  subscribeToBuildingUpdates(
    onUpdate: (payload: BuildingUpdatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<BuildingUpdatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page building update:', customEvent.detail.buildingId);
        onUpdate(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.BUILDING_UPDATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as BuildingUpdatedPayload;
        console.log('📡 [RealtimeService] Cross-page building update:', payload.buildingId);
        onUpdate(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse building storage event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.BUILDING_UPDATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as BuildingUpdatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending building update:', payload.buildingId);
            onUpdate(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.BUILDING_UPDATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending building update:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.BUILDING_UPDATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.BUILDING_UPDATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // UNIT REAL-TIME SYNC
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch unit updated event (CENTRALIZED)
   *
   * Single source of truth for unit updates across all pages.
   * NOTE: Data is saved to Firestore, localStorage is ONLY for cross-tab notification.
   */
  dispatchUnitUpdated(payload: UnitUpdatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching UNIT_UPDATED:', payload.unitId);

    // 1. Same-page real-time update via CustomEvent
    this.dispatchEvent(REALTIME_EVENTS.UNIT_UPDATED, payload);

    // 2. Cross-page notification via localStorage (client-side only)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.UNIT_UPDATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to unit updates (CENTRALIZED)
   */
  subscribeToUnitUpdates(
    onUpdate: (payload: UnitUpdatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<UnitUpdatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page unit update:', customEvent.detail.unitId);
        onUpdate(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.UNIT_UPDATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as UnitUpdatedPayload;
        console.log('📡 [RealtimeService] Cross-page unit update:', payload.unitId);
        onUpdate(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse unit storage event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.UNIT_UPDATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as UnitUpdatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending unit update:', payload.unitId);
            onUpdate(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.UNIT_UPDATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending unit update:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.UNIT_UPDATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.UNIT_UPDATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // CONTACT REAL-TIME SYNC
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch contact updated event (CENTRALIZED)
   *
   * Single source of truth for contact updates across all pages.
   * NOTE: Data is saved to Firestore, localStorage is ONLY for cross-tab notification.
   */
  dispatchContactUpdated(payload: ContactUpdatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching CONTACT_UPDATED:', payload.contactId);

    // 1. Same-page real-time update via CustomEvent
    this.dispatchEvent(REALTIME_EVENTS.CONTACT_UPDATED, payload);

    // 2. Cross-page notification via localStorage (client-side only)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.CONTACT_UPDATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to contact updates (CENTRALIZED)
   */
  subscribeToContactUpdates(
    onUpdate: (payload: ContactUpdatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ContactUpdatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page contact update:', customEvent.detail.contactId);
        onUpdate(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.CONTACT_UPDATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as ContactUpdatedPayload;
        console.log('📡 [RealtimeService] Cross-page contact update:', payload.contactId);
        onUpdate(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse contact storage event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.CONTACT_UPDATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as ContactUpdatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending contact update:', payload.contactId);
            onUpdate(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.CONTACT_UPDATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending contact update:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.CONTACT_UPDATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.CONTACT_UPDATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
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
