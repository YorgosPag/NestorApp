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
  type BuildingCreatedPayload,
  type BuildingDeletedPayload,
  type ProjectCreatedPayload,
  type ProjectDeletedPayload,
  type ContactCreatedPayload,
  type ContactDeletedPayload,
  type UnitCreatedPayload,
  type UnitDeletedPayload,
  // Task payloads
  type TaskCreatedPayload,
  type TaskUpdatedPayload,
  type TaskDeletedPayload,
  // Opportunity payloads
  type OpportunityCreatedPayload,
  type OpportunityUpdatedPayload,
  type OpportunityDeletedPayload,
  // Communication payloads
  type CommunicationCreatedPayload,
  type CommunicationUpdatedPayload,
  type CommunicationDeletedPayload,
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
  // PROJECT CREATE/DELETE REAL-TIME SYNC
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch project created event
   * Notifies all listening components that a new project was created
   */
  dispatchProjectCreated(payload: ProjectCreatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching PROJECT_CREATED:', payload.projectId);

    this.dispatchEvent(REALTIME_EVENTS.PROJECT_CREATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.PROJECT_CREATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to project created events
   */
  subscribeToProjectCreated(
    onCreated: (payload: ProjectCreatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ProjectCreatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page project created:', customEvent.detail.projectId);
        onCreated(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.PROJECT_CREATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as ProjectCreatedPayload;
        console.log('📡 [RealtimeService] Cross-page project created:', payload.projectId);
        onCreated(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse project created event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.PROJECT_CREATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as ProjectCreatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending project created:', payload.projectId);
            onCreated(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.PROJECT_CREATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending project created:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.PROJECT_CREATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.PROJECT_CREATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch project deleted event
   * Notifies all listening components that a project was deleted
   */
  dispatchProjectDeleted(payload: ProjectDeletedPayload): void {
    console.log('📤 [RealtimeService] Dispatching PROJECT_DELETED:', payload.projectId);

    this.dispatchEvent(REALTIME_EVENTS.PROJECT_DELETED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.PROJECT_DELETED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to project deleted events
   */
  subscribeToProjectDeleted(
    onDeleted: (payload: ProjectDeletedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ProjectDeletedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page project deleted:', customEvent.detail.projectId);
        onDeleted(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.PROJECT_DELETED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as ProjectDeletedPayload;
        console.log('📡 [RealtimeService] Cross-page project deleted:', payload.projectId);
        onDeleted(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse project deleted event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.PROJECT_DELETED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as ProjectDeletedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending project deleted:', payload.projectId);
            onDeleted(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.PROJECT_DELETED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending project deleted:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.PROJECT_DELETED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.PROJECT_DELETED, handleCustomEvent);
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
  // BUILDING CREATE/DELETE REAL-TIME SYNC
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch building created event
   * Notifies all listening components that a new building was created
   */
  dispatchBuildingCreated(payload: BuildingCreatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching BUILDING_CREATED:', payload.buildingId);

    this.dispatchEvent(REALTIME_EVENTS.BUILDING_CREATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.BUILDING_CREATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to building created events
   */
  subscribeToBuildingCreated(
    onCreated: (payload: BuildingCreatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<BuildingCreatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page building created:', customEvent.detail.buildingId);
        onCreated(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.BUILDING_CREATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as BuildingCreatedPayload;
        console.log('📡 [RealtimeService] Cross-page building created:', payload.buildingId);
        onCreated(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse building created event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.BUILDING_CREATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as BuildingCreatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending building created:', payload.buildingId);
            onCreated(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.BUILDING_CREATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending building created:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.BUILDING_CREATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.BUILDING_CREATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch building deleted event
   * Notifies all listening components that a building was deleted
   */
  dispatchBuildingDeleted(payload: BuildingDeletedPayload): void {
    console.log('📤 [RealtimeService] Dispatching BUILDING_DELETED:', payload.buildingId);

    this.dispatchEvent(REALTIME_EVENTS.BUILDING_DELETED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.BUILDING_DELETED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to building deleted events
   */
  subscribeToBuildingDeleted(
    onDeleted: (payload: BuildingDeletedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<BuildingDeletedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page building deleted:', customEvent.detail.buildingId);
        onDeleted(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.BUILDING_DELETED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as BuildingDeletedPayload;
        console.log('📡 [RealtimeService] Cross-page building deleted:', payload.buildingId);
        onDeleted(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse building deleted event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.BUILDING_DELETED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as BuildingDeletedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending building deleted:', payload.buildingId);
            onDeleted(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.BUILDING_DELETED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending building deleted:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.BUILDING_DELETED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.BUILDING_DELETED, handleCustomEvent);
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
  // CONTACT CREATE/DELETE REAL-TIME SYNC
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch contact created event
   * Notifies all listening components that a new contact was created
   */
  dispatchContactCreated(payload: ContactCreatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching CONTACT_CREATED:', payload.contactId);

    this.dispatchEvent(REALTIME_EVENTS.CONTACT_CREATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.CONTACT_CREATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to contact created events
   */
  subscribeToContactCreated(
    onCreated: (payload: ContactCreatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ContactCreatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page contact created:', customEvent.detail.contactId);
        onCreated(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.CONTACT_CREATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as ContactCreatedPayload;
        console.log('📡 [RealtimeService] Cross-page contact created:', payload.contactId);
        onCreated(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse contact created event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.CONTACT_CREATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as ContactCreatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending contact created:', payload.contactId);
            onCreated(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.CONTACT_CREATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending contact created:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.CONTACT_CREATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.CONTACT_CREATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch contact deleted event
   * Notifies all listening components that a contact was deleted
   */
  dispatchContactDeleted(payload: ContactDeletedPayload): void {
    console.log('📤 [RealtimeService] Dispatching CONTACT_DELETED:', payload.contactId);

    this.dispatchEvent(REALTIME_EVENTS.CONTACT_DELETED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.CONTACT_DELETED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to contact deleted events
   */
  subscribeToContactDeleted(
    onDeleted: (payload: ContactDeletedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ContactDeletedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page contact deleted:', customEvent.detail.contactId);
        onDeleted(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.CONTACT_DELETED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as ContactDeletedPayload;
        console.log('📡 [RealtimeService] Cross-page contact deleted:', payload.contactId);
        onDeleted(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse contact deleted event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.CONTACT_DELETED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as ContactDeletedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending contact deleted:', payload.contactId);
            onDeleted(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.CONTACT_DELETED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending contact deleted:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.CONTACT_DELETED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.CONTACT_DELETED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // UNIT CREATE/DELETE REAL-TIME SYNC
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch unit created event
   * Notifies all listening components that a new unit was created
   */
  dispatchUnitCreated(payload: UnitCreatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching UNIT_CREATED:', payload.unitId);

    this.dispatchEvent(REALTIME_EVENTS.UNIT_CREATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.UNIT_CREATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to unit created events
   */
  subscribeToUnitCreated(
    onCreated: (payload: UnitCreatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<UnitCreatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page unit created:', customEvent.detail.unitId);
        onCreated(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.UNIT_CREATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as UnitCreatedPayload;
        console.log('📡 [RealtimeService] Cross-page unit created:', payload.unitId);
        onCreated(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse unit created event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.UNIT_CREATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as UnitCreatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending unit created:', payload.unitId);
            onCreated(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.UNIT_CREATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending unit created:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.UNIT_CREATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.UNIT_CREATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch unit deleted event
   * Notifies all listening components that a unit was deleted
   */
  dispatchUnitDeleted(payload: UnitDeletedPayload): void {
    console.log('📤 [RealtimeService] Dispatching UNIT_DELETED:', payload.unitId);

    this.dispatchEvent(REALTIME_EVENTS.UNIT_DELETED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.UNIT_DELETED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to unit deleted events
   */
  subscribeToUnitDeleted(
    onDeleted: (payload: UnitDeletedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<UnitDeletedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page unit deleted:', customEvent.detail.unitId);
        onDeleted(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.UNIT_DELETED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as UnitDeletedPayload;
        console.log('📡 [RealtimeService] Cross-page unit deleted:', payload.unitId);
        onDeleted(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse unit deleted event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.UNIT_DELETED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as UnitDeletedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending unit deleted:', payload.unitId);
            onDeleted(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.UNIT_DELETED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending unit deleted:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.UNIT_DELETED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.UNIT_DELETED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // TASK REAL-TIME SYNC (CRM Tasks)
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch task created event
   * Notifies all listening components that a new CRM task was created
   */
  dispatchTaskCreated(payload: TaskCreatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching TASK_CREATED:', payload.taskId);

    this.dispatchEvent(REALTIME_EVENTS.TASK_CREATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.TASK_CREATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to task created events
   */
  subscribeToTaskCreated(
    onCreated: (payload: TaskCreatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<TaskCreatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page task created:', customEvent.detail.taskId);
        onCreated(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.TASK_CREATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as TaskCreatedPayload;
        console.log('📡 [RealtimeService] Cross-page task created:', payload.taskId);
        onCreated(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse task created event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.TASK_CREATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as TaskCreatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending task created:', payload.taskId);
            onCreated(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.TASK_CREATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending task created:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.TASK_CREATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.TASK_CREATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch task updated event
   * Notifies all listening components that a CRM task was updated
   */
  dispatchTaskUpdated(payload: TaskUpdatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching TASK_UPDATED:', payload.taskId);

    this.dispatchEvent(REALTIME_EVENTS.TASK_UPDATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.TASK_UPDATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to task updated events
   */
  subscribeToTaskUpdates(
    onUpdate: (payload: TaskUpdatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<TaskUpdatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page task update:', customEvent.detail.taskId);
        onUpdate(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.TASK_UPDATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as TaskUpdatedPayload;
        console.log('📡 [RealtimeService] Cross-page task update:', payload.taskId);
        onUpdate(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse task update event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.TASK_UPDATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as TaskUpdatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending task update:', payload.taskId);
            onUpdate(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.TASK_UPDATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending task update:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.TASK_UPDATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.TASK_UPDATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch task deleted event
   * Notifies all listening components that a CRM task was deleted
   */
  dispatchTaskDeleted(payload: TaskDeletedPayload): void {
    console.log('📤 [RealtimeService] Dispatching TASK_DELETED:', payload.taskId);

    this.dispatchEvent(REALTIME_EVENTS.TASK_DELETED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.TASK_DELETED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to task deleted events
   */
  subscribeToTaskDeleted(
    onDeleted: (payload: TaskDeletedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<TaskDeletedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page task deleted:', customEvent.detail.taskId);
        onDeleted(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.TASK_DELETED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as TaskDeletedPayload;
        console.log('📡 [RealtimeService] Cross-page task deleted:', payload.taskId);
        onDeleted(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse task deleted event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.TASK_DELETED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as TaskDeletedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending task deleted:', payload.taskId);
            onDeleted(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.TASK_DELETED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending task deleted:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.TASK_DELETED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.TASK_DELETED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // OPPORTUNITY REAL-TIME SYNC (CRM Opportunities)
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch opportunity created event
   * Notifies all listening components that a new opportunity was created
   */
  dispatchOpportunityCreated(payload: OpportunityCreatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching OPPORTUNITY_CREATED:', payload.opportunityId);

    this.dispatchEvent(REALTIME_EVENTS.OPPORTUNITY_CREATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.OPPORTUNITY_CREATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to opportunity created events
   */
  subscribeToOpportunityCreated(
    onCreated: (payload: OpportunityCreatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<OpportunityCreatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page opportunity created:', customEvent.detail.opportunityId);
        onCreated(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.OPPORTUNITY_CREATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as OpportunityCreatedPayload;
        console.log('📡 [RealtimeService] Cross-page opportunity created:', payload.opportunityId);
        onCreated(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse opportunity created event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.OPPORTUNITY_CREATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as OpportunityCreatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending opportunity created:', payload.opportunityId);
            onCreated(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.OPPORTUNITY_CREATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending opportunity created:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.OPPORTUNITY_CREATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.OPPORTUNITY_CREATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch opportunity updated event
   * Notifies all listening components that an opportunity was updated
   */
  dispatchOpportunityUpdated(payload: OpportunityUpdatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching OPPORTUNITY_UPDATED:', payload.opportunityId);

    this.dispatchEvent(REALTIME_EVENTS.OPPORTUNITY_UPDATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.OPPORTUNITY_UPDATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to opportunity updated events
   */
  subscribeToOpportunityUpdates(
    onUpdate: (payload: OpportunityUpdatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<OpportunityUpdatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page opportunity update:', customEvent.detail.opportunityId);
        onUpdate(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.OPPORTUNITY_UPDATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as OpportunityUpdatedPayload;
        console.log('📡 [RealtimeService] Cross-page opportunity update:', payload.opportunityId);
        onUpdate(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse opportunity update event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.OPPORTUNITY_UPDATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as OpportunityUpdatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending opportunity update:', payload.opportunityId);
            onUpdate(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.OPPORTUNITY_UPDATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending opportunity update:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.OPPORTUNITY_UPDATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.OPPORTUNITY_UPDATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch opportunity deleted event
   * Notifies all listening components that an opportunity was deleted
   */
  dispatchOpportunityDeleted(payload: OpportunityDeletedPayload): void {
    console.log('📤 [RealtimeService] Dispatching OPPORTUNITY_DELETED:', payload.opportunityId);

    this.dispatchEvent(REALTIME_EVENTS.OPPORTUNITY_DELETED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.OPPORTUNITY_DELETED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to opportunity deleted events
   */
  subscribeToOpportunityDeleted(
    onDeleted: (payload: OpportunityDeletedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<OpportunityDeletedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page opportunity deleted:', customEvent.detail.opportunityId);
        onDeleted(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.OPPORTUNITY_DELETED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as OpportunityDeletedPayload;
        console.log('📡 [RealtimeService] Cross-page opportunity deleted:', payload.opportunityId);
        onDeleted(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse opportunity deleted event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.OPPORTUNITY_DELETED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as OpportunityDeletedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending opportunity deleted:', payload.opportunityId);
            onDeleted(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.OPPORTUNITY_DELETED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending opportunity deleted:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.OPPORTUNITY_DELETED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.OPPORTUNITY_DELETED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  // ==========================================================================
  // COMMUNICATION REAL-TIME SYNC (CRM Communications)
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Dispatch communication created event
   * Notifies all listening components that a new communication was logged
   */
  dispatchCommunicationCreated(payload: CommunicationCreatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching COMMUNICATION_CREATED:', payload.communicationId);

    this.dispatchEvent(REALTIME_EVENTS.COMMUNICATION_CREATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.COMMUNICATION_CREATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to communication created events
   */
  subscribeToCommunicationCreated(
    onCreated: (payload: CommunicationCreatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<CommunicationCreatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page communication created:', customEvent.detail.communicationId);
        onCreated(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.COMMUNICATION_CREATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as CommunicationCreatedPayload;
        console.log('📡 [RealtimeService] Cross-page communication created:', payload.communicationId);
        onCreated(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse communication created event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.COMMUNICATION_CREATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as CommunicationCreatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending communication created:', payload.communicationId);
            onCreated(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.COMMUNICATION_CREATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending communication created:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.COMMUNICATION_CREATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.COMMUNICATION_CREATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch communication updated event
   * Notifies all listening components that a communication was updated
   */
  dispatchCommunicationUpdated(payload: CommunicationUpdatedPayload): void {
    console.log('📤 [RealtimeService] Dispatching COMMUNICATION_UPDATED:', payload.communicationId);

    this.dispatchEvent(REALTIME_EVENTS.COMMUNICATION_UPDATED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.COMMUNICATION_UPDATED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to communication updated events
   */
  subscribeToCommunicationUpdates(
    onUpdate: (payload: CommunicationUpdatedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<CommunicationUpdatedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page communication update:', customEvent.detail.communicationId);
        onUpdate(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.COMMUNICATION_UPDATED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as CommunicationUpdatedPayload;
        console.log('📡 [RealtimeService] Cross-page communication update:', payload.communicationId);
        onUpdate(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse communication update event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.COMMUNICATION_UPDATED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as CommunicationUpdatedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending communication update:', payload.communicationId);
            onUpdate(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.COMMUNICATION_UPDATED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending communication update:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.COMMUNICATION_UPDATED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.COMMUNICATION_UPDATED, handleCustomEvent);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }

  /**
   * 🏢 ENTERPRISE: Dispatch communication deleted event
   * Notifies all listening components that a communication was deleted
   */
  dispatchCommunicationDeleted(payload: CommunicationDeletedPayload): void {
    console.log('📤 [RealtimeService] Dispatching COMMUNICATION_DELETED:', payload.communicationId);

    this.dispatchEvent(REALTIME_EVENTS.COMMUNICATION_DELETED, payload);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          REALTIME_STORAGE_KEYS.COMMUNICATION_DELETED,
          JSON.stringify(payload)
        );
      } catch (error) {
        console.warn('⚠️ [RealtimeService] localStorage notification failed:', error);
      }
    }
  }

  /**
   * 🏢 ENTERPRISE: Subscribe to communication deleted events
   */
  subscribeToCommunicationDeleted(
    onDeleted: (payload: CommunicationDeletedPayload) => void,
    options?: { checkPendingOnMount?: boolean }
  ): () => void {
    const { checkPendingOnMount = true } = options || {};

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<CommunicationDeletedPayload>;
      if (customEvent.detail) {
        console.log('📡 [RealtimeService] Same-page communication deleted:', customEvent.detail.communicationId);
        onDeleted(customEvent.detail);
      }
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== REALTIME_STORAGE_KEYS.COMMUNICATION_DELETED || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as CommunicationDeletedPayload;
        console.log('📡 [RealtimeService] Cross-page communication deleted:', payload.communicationId);
        onDeleted(payload);
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to parse communication deleted event:', error);
      }
    };

    if (checkPendingOnMount && typeof window !== 'undefined') {
      try {
        const pendingUpdate = localStorage.getItem(REALTIME_STORAGE_KEYS.COMMUNICATION_DELETED);
        if (pendingUpdate) {
          const payload = JSON.parse(pendingUpdate) as CommunicationDeletedPayload;
          if (Date.now() - payload.timestamp < 5000) {
            console.log('📡 [RealtimeService] Applying pending communication deleted:', payload.communicationId);
            onDeleted(payload);
          }
          localStorage.removeItem(REALTIME_STORAGE_KEYS.COMMUNICATION_DELETED);
        }
      } catch (error) {
        console.error('❌ [RealtimeService] Failed to process pending communication deleted:', error);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(REALTIME_EVENTS.COMMUNICATION_DELETED, handleCustomEvent);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(REALTIME_EVENTS.COMMUNICATION_DELETED, handleCustomEvent);
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
