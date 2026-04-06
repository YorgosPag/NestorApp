/**
 * 🔐 ENTERPRISE SESSION SERVICE
 *
 * Enterprise-grade session management service for tracking and managing
 * user sessions across devices. Follows Google/Microsoft/Okta patterns.
 *
 * Split into SRP modules (ADR-065):
 * - session-device-detection.ts — device/browser/OS detection, location
 * - session-helpers.ts — pure functions: data mapping, display, statistics
 *
 * @module services/session/EnterpriseSessionService
 */

import { generateSessionId } from '@/services/enterprise-id.service';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { SUBCOLLECTIONS, COLLECTIONS } from '@/config/firestore-collections';
import type {
  UserSession,
  SessionStatus,
  SessionTimestamps,
  CreateSessionInput,
  SessionQueryFilters,
  SessionStatistics,
  SessionDisplayItem,
  SessionActionResult,
  SessionMetadata
} from './session.types';
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { getDeviceInfo, getApproximateLocation } from './session-device-detection';
import {
  DEFAULT_SESSION_DURATION_HOURS,
  EXTENDED_SESSION_DURATION_DAYS,
  MAX_CONCURRENT_SESSIONS,
  mapDocToSession,
  formatSessionsForDisplay,
  computeSessionStatistics
} from './session-helpers';

const logger = createModuleLogger('EnterpriseSessionService');

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

// ============================================================================
// ENTERPRISE SESSION SERVICE
// ============================================================================

/**
 * Enterprise Session Service
 * Singleton service for managing user sessions
 */
export class EnterpriseSessionService {
  private static instance: EnterpriseSessionService;
  private db: Firestore | null = null;
  private initialized = false;
  private currentSessionId: string | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EnterpriseSessionService {
    if (!EnterpriseSessionService.instance) {
      EnterpriseSessionService.instance = new EnterpriseSessionService();
    }
    return EnterpriseSessionService.instance;
  }

  /**
   * Initialize service with Firestore
   */
  initialize(firestore: Firestore): void {
    this.db = firestore;
    this.initialized = true;
    logger.info('🔐 EnterpriseSessionService initialized');
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('EnterpriseSessionService not initialized. Call initialize(firestore) first.');
    }
  }

  /**
   * Get sessions subcollection reference for a user
   */
  private getSessionsCollection(userId: string) {
    this.ensureInitialized();
    return collection(
      this.db!,
      COLLECTIONS.USERS,
      userId,
      SUBCOLLECTIONS.USER_SESSIONS
    );
  }

  // ==========================================================================
  // SESSION LIFECYCLE
  // ==========================================================================

  /**
   * Create a new session on login
   */
  async createSession(input: CreateSessionInput): Promise<UserSession> {
    this.ensureInitialized();

    const { userId, loginMethod, rememberMe = false, twoFactorUsed = false } = input;

    // Check for max concurrent sessions
    const activeSessions = await this.getActiveSessions(userId);
    if (activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
      // Revoke oldest session
      const oldestSession = activeSessions.sort(
        (a, b) => a.timestamps.createdAt.getTime() - b.timestamps.createdAt.getTime()
      )[0];
      await this.revokeSession(userId, oldestSession.id, 'auto_revoked_max_sessions');
    }

    // Generate session ID
    const sessionId = generateSessionId();

    // Get device and location info
    const deviceInfo = getDeviceInfo();
    const location = await getApproximateLocation();

    // Calculate expiration
    const now = new Date();
    const expirationHours = rememberMe
      ? EXTENDED_SESSION_DURATION_DAYS * 24
      : DEFAULT_SESSION_DURATION_HOURS;
    const expiresAt = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);

    const timestamps: SessionTimestamps = {
      createdAt: now,
      lastActiveAt: now,
      expiresAt
    };

    const metadata: SessionMetadata = {
      loginMethod,
      rememberMe,
      twoFactorUsed,
      appVersion: APP_VERSION,
      source: 'web'
    };

    const session: UserSession = {
      id: sessionId,
      userId,
      deviceInfo,
      location,
      timestamps,
      status: 'active',
      isCurrent: true,
      metadata
    };

    // Save to Firestore
    const sessionsRef = this.getSessionsCollection(userId);
    await setDoc(doc(sessionsRef, sessionId), {
      ...session,
      timestamps: {
        createdAt: Timestamp.fromDate(timestamps.createdAt),
        lastActiveAt: Timestamp.fromDate(timestamps.lastActiveAt),
        expiresAt: Timestamp.fromDate(timestamps.expiresAt)
      }
    });

    // Store current session ID
    this.currentSessionId = sessionId;

    // Mark other sessions as not current
    await this.markOtherSessionsNotCurrent(userId, sessionId);

    logger.info(`🔐 Session created: ${sessionId} for user ${userId}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatch('SESSION_CREATED',{
      sessionId,
      session: {
        userId,
        deviceInfo: `${deviceInfo.browser} on ${deviceInfo.os}`,
      },
      timestamp: Date.now(),
    });

    return session;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(userId: string, sessionId?: string): Promise<void> {
    this.ensureInitialized();

    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) {
      return;
    }

    const sessionsRef = this.getSessionsCollection(userId);
    const sessionRef = doc(sessionsRef, targetSessionId);

    try {
      await updateDoc(sessionRef, {
        'timestamps.lastActiveAt': Timestamp.fromDate(new Date())
      });
    } catch (error) {
      logger.warn('Failed to update session activity:', error);
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    reason?: string
  ): Promise<SessionActionResult> {
    this.ensureInitialized();

    try {
      const sessionsRef = this.getSessionsCollection(userId);
      const sessionRef = doc(sessionsRef, sessionId);

      await updateDoc(sessionRef, {
        status: 'revoked' as SessionStatus,
        'timestamps.revokedAt': Timestamp.fromDate(new Date()),
        revocationReason: reason || 'user_requested'
      });

      logger.info(`🔐 Session revoked: ${sessionId}`);

      // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
      RealtimeService.dispatch('SESSION_DELETED',{
        sessionId,
        timestamp: Date.now(),
      });

      return {
        success: true,
        affectedSessions: [sessionId],
        action: 'revoke'
      };
    } catch (error) {
      logger.error('Failed to revoke session:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        affectedSessions: [],
        action: 'revoke'
      };
    }
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllOtherSessions(userId: string): Promise<SessionActionResult> {
    this.ensureInitialized();

    try {
      const activeSessions = await this.getActiveSessions(userId);
      const sessionsToRevoke = activeSessions.filter(s => !s.isCurrent);

      const batch = writeBatch(this.db!);
      const sessionsRef = this.getSessionsCollection(userId);

      for (const session of sessionsToRevoke) {
        const sessionRef = doc(sessionsRef, session.id);
        batch.update(sessionRef, {
          status: 'revoked' as SessionStatus,
          'timestamps.revokedAt': Timestamp.fromDate(new Date()),
          revocationReason: 'revoked_all_other'
        });
      }

      await batch.commit();

      logger.info(`🔐 Revoked ${sessionsToRevoke.length} other sessions for user ${userId}`);

      return {
        success: true,
        affectedSessions: sessionsToRevoke.map(s => s.id),
        action: 'revoke_all'
      };
    } catch (error) {
      logger.error('Failed to revoke all sessions:', error);
      return {
        success: false,
        error: getErrorMessage(error),
        affectedSessions: [],
        action: 'revoke_all'
      };
    }
  }

  /**
   * End current session (logout)
   */
  async endCurrentSession(userId: string): Promise<void> {
    if (this.currentSessionId) {
      await this.revokeSession(userId, this.currentSessionId, 'logout');
      this.currentSessionId = null;
    }
  }

  // ==========================================================================
  // SESSION QUERIES
  // ==========================================================================

  /**
   * Get all active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<UserSession[]> {
    this.ensureInitialized();

    const sessionsRef = this.getSessionsCollection(userId);
    const q = query(
      sessionsRef,
      where('status', '==', 'active'),
      orderBy('timestamps.lastActiveAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const sessions: UserSession[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      sessions.push(mapDocToSession(data));
    });

    return sessions;
  }

  /**
   * Get all sessions for a user (including revoked/expired)
   */
  async getAllSessions(
    userId: string,
    filters?: SessionQueryFilters
  ): Promise<UserSession[]> {
    this.ensureInitialized();

    const sessionsRef = this.getSessionsCollection(userId);
    let q = query(sessionsRef, orderBy('timestamps.createdAt', 'desc'));

    if (filters?.limit) {
      q = query(q, limit(filters.limit));
    }

    const snapshot = await getDocs(q);
    let sessions: UserSession[] = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      sessions.push(mapDocToSession(data));
    });

    // Apply client-side filters
    if (filters?.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }
    if (filters?.activeOnly) {
      sessions = sessions.filter(s => s.status === 'active');
    }
    if (filters?.deviceType) {
      sessions = sessions.filter(s => s.deviceInfo.type === filters.deviceType);
    }

    return sessions;
  }

  /**
   * Get session statistics for a user
   */
  async getSessionStatistics(userId: string): Promise<SessionStatistics> {
    const allSessions = await this.getAllSessions(userId);
    return computeSessionStatistics(allSessions);
  }

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  /**
   * Get sessions formatted for UI display
   */
  async getSessionsForDisplay(userId: string): Promise<SessionDisplayItem[]> {
    const sessions = await this.getActiveSessions(userId);
    return formatSessionsForDisplay(sessions);
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Subscribe to session events for cross-tab sync (ADR-228 Tier 1).
   * When a session is revoked (e.g., admin force-logout), other tabs react.
   */
  static subscribeToSessionEvents(
    currentSessionId: string,
    onSessionRevoked: () => void
  ): () => void {
    const unsubDeleted = RealtimeService.subscribe('SESSION_DELETED', (payload) => {
      if (payload.sessionId === currentSessionId) {
        logger.warn('Current session revoked — triggering logout');
        onSessionRevoked();
      }
    });

    return unsubDeleted;
  }

  /**
   * Set current session ID (for restoring from storage)
   */
  setCurrentSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Mark other sessions as not current
   */
  private async markOtherSessionsNotCurrent(
    userId: string,
    currentSessionId: string
  ): Promise<void> {
    const sessionsRef = this.getSessionsCollection(userId);
    const q = query(
      sessionsRef,
      where('status', '==', 'active'),
      where('isCurrent', '==', true)
    );

    const snapshot = await getDocs(q);
    const batch = writeBatch(this.db!);

    snapshot.forEach(docSnap => {
      if (docSnap.id !== currentSessionId) {
        batch.update(docSnap.ref, { isCurrent: false });
      }
    });

    await batch.commit();
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EnterpriseSessionService;

/** Singleton instance */
export const sessionService = EnterpriseSessionService.getInstance();
