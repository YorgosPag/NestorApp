/**
 * 🔐 ENTERPRISE SESSION SERVICE
 *
 * Enterprise-grade session management service for tracking and managing
 * user sessions across devices. Follows Google/Microsoft/Okta patterns.
 *
 * Features:
 * - Device fingerprinting and tracking
 * - Location detection (GDPR compliant)
 * - Session lifecycle management
 * - Multi-device session control
 * - Security event notifications
 * - Audit trail logging
 *
 * @module services/session/EnterpriseSessionService
 * @enterprise-ready true
 * @security-critical true
 * @gdpr-compliant true
 */

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
  SessionDeviceInfo,
  SessionLocation,
  SessionStatus,
  SessionMetadata,
  SessionTimestamps,
  CreateSessionInput,
  SessionQueryFilters,
  SessionStatistics,
  SessionDisplayItem,
  SessionActionResult,
  DeviceType,
  BrowserType,
  OperatingSystem,
  LoginMethod
} from './session.types';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EnterpriseSessionService');

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default session duration in hours */
const DEFAULT_SESSION_DURATION_HOURS = 24;

/** Extended session duration (remember me) in days */
const EXTENDED_SESSION_DURATION_DAYS = 30;

/** Maximum concurrent sessions per user */
const MAX_CONCURRENT_SESSIONS = 10;

/** Session activity update threshold (minutes) */
const ACTIVITY_UPDATE_THRESHOLD_MINUTES = 5;

/** App version for session metadata */
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

// ============================================================================
// DEVICE DETECTION UTILITIES
// ============================================================================

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();

  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    return 'mobile';
  }
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  if (/windows|macintosh|linux|cros/i.test(ua)) {
    return 'desktop';
  }

  return 'unknown';
}

/**
 * Detect browser type from user agent
 */
function detectBrowser(userAgent: string): { type: BrowserType; version: string } {
  const ua = userAgent;

  // Order matters - Edge must be checked before Chrome
  if (/Edg/i.test(ua)) {
    const match = ua.match(/Edg\/(\d+)/);
    return { type: 'Edge', version: match?.[1] || 'Unknown' };
  }
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) {
    const match = ua.match(/Chrome\/(\d+)/);
    return { type: 'Chrome', version: match?.[1] || 'Unknown' };
  }
  if (/Firefox/i.test(ua)) {
    const match = ua.match(/Firefox\/(\d+)/);
    return { type: 'Firefox', version: match?.[1] || 'Unknown' };
  }
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    const match = ua.match(/Version\/(\d+)/);
    return { type: 'Safari', version: match?.[1] || 'Unknown' };
  }
  if (/OPR|Opera/i.test(ua)) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/);
    return { type: 'Opera', version: match?.[1] || 'Unknown' };
  }

  return { type: 'Unknown', version: 'Unknown' };
}

/**
 * Detect operating system from user agent
 */
function detectOS(userAgent: string): { os: OperatingSystem; version: string } {
  const ua = userAgent;

  if (/Windows NT 10/i.test(ua)) {
    return { os: 'Windows', version: '10/11' };
  }
  if (/Windows/i.test(ua)) {
    return { os: 'Windows', version: 'Unknown' };
  }
  if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    const version = match?.[1]?.replace('_', '.') || 'Unknown';
    return { os: 'macOS', version };
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS (\d+[._]\d+)/);
    const version = match?.[1]?.replace('_', '.') || 'Unknown';
    return { os: 'iOS', version };
  }
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    return { os: 'Android', version: match?.[1] || 'Unknown' };
  }
  if (/CrOS/i.test(ua)) {
    return { os: 'ChromeOS', version: 'Unknown' };
  }
  if (/Linux/i.test(ua)) {
    return { os: 'Linux', version: 'Unknown' };
  }

  return { os: 'Unknown', version: 'Unknown' };
}

/**
 * Get device information from browser
 */
function getDeviceInfo(): SessionDeviceInfo {
  if (typeof navigator === 'undefined') {
    return {
      type: 'unknown',
      browser: 'Server',
      browserType: 'Unknown',
      os: 'Unknown',
      osVersion: 'Unknown',
      userAgent: 'Server-side',
      language: 'en'
    };
  }

  const userAgent = navigator.userAgent;
  const browser = detectBrowser(userAgent);
  const osInfo = detectOS(userAgent);

  return {
    type: detectDeviceType(userAgent),
    browser: `${browser.type} ${browser.version}`,
    browserType: browser.type,
    os: osInfo.os,
    osVersion: osInfo.version,
    userAgent,
    screenResolution: typeof screen !== 'undefined'
      ? `${screen.width}x${screen.height}`
      : undefined,
    language: navigator.language || 'en'
  };
}

// ============================================================================
// LOCATION UTILITIES (GDPR COMPLIANT)
// ============================================================================

/**
 * Hash IP address for GDPR compliance
 * Uses SHA-256, returns first 8 characters
 */
async function hashIP(ip: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback for environments without crypto
    return ip.split('.').slice(0, 2).join('.') + '.x.x';
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'enterprise-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.substring(0, 8);
}

/**
 * Get approximate location from IP (GDPR compliant)
 * Uses timezone as fallback for location approximation
 */
async function getApproximateLocation(): Promise<SessionLocation> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Default location based on timezone
  const defaultLocation: SessionLocation = {
    ipHash: 'unknown',
    countryCode: 'GR', // Default to Greece
    countryName: 'Ελλάδα',
    city: 'Unknown',
    timezone,
    isApproximate: true
  };

  try {
    // Try to get location from a privacy-respecting service
    // In production, this would use a server-side IP geolocation service
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });

    if (!response.ok) {
      return defaultLocation;
    }

    const data = await response.json();

    return {
      ipHash: await hashIP(data.ip || 'unknown'),
      countryCode: data.country_code || 'GR',
      countryName: data.country_name || 'Unknown',
      city: data.city || 'Unknown',
      region: data.region || undefined,
      timezone: data.timezone || timezone,
      isApproximate: true
    };
  } catch {
    // Silently fail and use default
    return defaultLocation;
  }
}

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
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

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
    RealtimeService.dispatchSessionCreated({
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
      RealtimeService.dispatchSessionDeleted({
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
        error: error instanceof Error ? error.message : 'Unknown error',
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
      sessions.push(this.mapDocToSession(data));
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
      sessions.push(this.mapDocToSession(data));
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
    const activeSessions = allSessions.filter(s => s.status === 'active');

    const byDeviceType: Record<DeviceType, number> = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      unknown: 0
    };

    const byLoginMethod: Record<LoginMethod, number> = {
      email: 0,
      google: 0,
      microsoft: 0,
      apple: 0,
      phone: 0
    };

    const uniqueLocations = new Set<string>();

    for (const session of allSessions) {
      byDeviceType[session.deviceInfo.type]++;
      byLoginMethod[session.metadata.loginMethod]++;
      uniqueLocations.add(`${session.location.city}-${session.location.countryCode}`);
    }

    const lastLogin = allSessions.length > 0
      ? allSessions[0].timestamps.createdAt
      : null;

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      byDeviceType,
      byLoginMethod,
      lastLogin,
      uniqueLocations: uniqueLocations.size
    };
  }

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  /**
   * Get sessions formatted for UI display
   */
  async getSessionsForDisplay(userId: string): Promise<SessionDisplayItem[]> {
    const sessions = await this.getActiveSessions(userId);

    return sessions.map(session => ({
      id: session.id,
      displayLabel: `${session.deviceInfo.browser} on ${session.deviceInfo.os}`,
      locationDisplay: `${session.location.city}, ${session.location.countryName}`,
      lastActiveRelative: this.getRelativeTime(session.timestamps.lastActiveAt),
      isCurrent: session.isCurrent,
      status: session.status,
      deviceType: session.deviceInfo.type,
      browserType: session.deviceInfo.browserType,
      timestamps: session.timestamps
    }));
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
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

  /**
   * Map Firestore document to UserSession
   */
  private mapDocToSession(data: Record<string, unknown>): UserSession {
    return {
      id: data.id as string,
      userId: data.userId as string,
      deviceInfo: data.deviceInfo as SessionDeviceInfo,
      location: data.location as SessionLocation,
      timestamps: {
        createdAt: (data.timestamps as Record<string, unknown>).createdAt instanceof Timestamp
          ? ((data.timestamps as Record<string, unknown>).createdAt as Timestamp).toDate()
          : new Date((data.timestamps as Record<string, unknown>).createdAt as string),
        lastActiveAt: (data.timestamps as Record<string, unknown>).lastActiveAt instanceof Timestamp
          ? ((data.timestamps as Record<string, unknown>).lastActiveAt as Timestamp).toDate()
          : new Date((data.timestamps as Record<string, unknown>).lastActiveAt as string),
        expiresAt: (data.timestamps as Record<string, unknown>).expiresAt instanceof Timestamp
          ? ((data.timestamps as Record<string, unknown>).expiresAt as Timestamp).toDate()
          : new Date((data.timestamps as Record<string, unknown>).expiresAt as string),
        revokedAt: (data.timestamps as Record<string, unknown>).revokedAt instanceof Timestamp
          ? ((data.timestamps as Record<string, unknown>).revokedAt as Timestamp).toDate()
          : undefined
      },
      status: data.status as SessionStatus,
      isCurrent: data.isCurrent as boolean,
      metadata: data.metadata as SessionMetadata,
      revocationReason: data.revocationReason as string | undefined,
      revokedBy: data.revokedBy as string | undefined
    };
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'Τώρα';
    }
    if (diffMins < 60) {
      return `${diffMins} λεπτά πριν`;
    }
    if (diffHours < 24) {
      return `${diffHours} ώρες πριν`;
    }
    if (diffDays < 7) {
      return `${diffDays} ημέρες πριν`;
    }

    return date.toLocaleDateString('el-GR');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default EnterpriseSessionService;

/** Singleton instance */
export const sessionService = EnterpriseSessionService.getInstance();
