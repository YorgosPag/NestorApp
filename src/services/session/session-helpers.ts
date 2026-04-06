/**
 * 🔐 SESSION HELPERS — Pure functions for session data mapping & display
 *
 * Extracted from EnterpriseSessionService (ADR-065).
 *
 * @module services/session/session-helpers
 * @see EnterpriseSessionService.ts
 */

import { formatDateShort } from '@/lib/intl-utils';
import { normalizeToDate } from '@/lib/date-local';
import type {
  UserSession,
  SessionDeviceInfo,
  SessionStatus,
  SessionMetadata,
  SessionLocation,
  SessionStatistics,
  SessionDisplayItem,
  DeviceType,
  LoginMethod
} from './session.types';

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_SESSION_DURATION_HOURS = 24;
export const EXTENDED_SESSION_DURATION_DAYS = 30;
export const MAX_CONCURRENT_SESSIONS = 10;

// ============================================================================
// DATA MAPPING
// ============================================================================

/**
 * Map Firestore document to UserSession
 */
export function mapDocToSession(data: Record<string, unknown>): UserSession {
  return {
    id: data.id as string,
    userId: data.userId as string,
    deviceInfo: data.deviceInfo as SessionDeviceInfo,
    location: data.location as SessionLocation,
    timestamps: {
      createdAt: normalizeToDate((data.timestamps as Record<string, unknown>).createdAt) ?? new Date(),
      lastActiveAt: normalizeToDate((data.timestamps as Record<string, unknown>).lastActiveAt) ?? new Date(),
      expiresAt: normalizeToDate((data.timestamps as Record<string, unknown>).expiresAt) ?? new Date(),
      revokedAt: normalizeToDate((data.timestamps as Record<string, unknown>).revokedAt) ?? undefined
    },
    status: data.status as SessionStatus,
    isCurrent: data.isCurrent as boolean,
    metadata: data.metadata as SessionMetadata,
    revocationReason: data.revocationReason as string | undefined,
    revokedBy: data.revokedBy as string | undefined
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get relative time string (Greek)
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Τώρα';
  if (diffMins < 60) return `${diffMins} λεπτά πριν`;
  if (diffHours < 24) return `${diffHours} ώρες πριν`;
  if (diffDays < 7) return `${diffDays} ημέρες πριν`;

  return formatDateShort(date);
}

/**
 * Format sessions for UI display
 */
export function formatSessionsForDisplay(sessions: UserSession[]): SessionDisplayItem[] {
  return sessions.map(session => ({
    id: session.id,
    displayLabel: `${session.deviceInfo.browser} on ${session.deviceInfo.os}`,
    locationDisplay: `${session.location.city}, ${session.location.countryName}`,
    lastActiveRelative: getRelativeTime(session.timestamps.lastActiveAt),
    isCurrent: session.isCurrent,
    status: session.status,
    deviceType: session.deviceInfo.type,
    browserType: session.deviceInfo.browserType,
    timestamps: session.timestamps
  }));
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Compute session statistics from a list of sessions
 */
export function computeSessionStatistics(allSessions: UserSession[]): SessionStatistics {
  const activeSessions = allSessions.filter(s => s.status === 'active');

  const byDeviceType: Record<DeviceType, number> = {
    desktop: 0, mobile: 0, tablet: 0, unknown: 0
  };

  const byLoginMethod: Record<LoginMethod, number> = {
    email: 0, google: 0, microsoft: 0, apple: 0, phone: 0
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
