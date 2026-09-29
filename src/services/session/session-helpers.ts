/**
 * 🔐 SESSION HELPERS — Pure functions for session data mapping & display
 *
 * Extracted from EnterpriseSessionService (ADR-065). ADR-894: η τοποθεσία είναι **κωδικοί** από τον server·
 * το «τρέχουσα συσκευή» **υπολογίζεται** εδώ (δεν αποθηκεύεται)· ο σχετικός χρόνος από το `intl-formatting`.
 *
 * @module services/session/session-helpers
 * @see EnterpriseSessionService.ts
 */

import { normalizeToDate } from '@/lib/date-local';
import { formatRelativeTime } from '@/lib/intl-formatting';
import type { GeoIpSource, IpPlaceBasis, IpPlacePrecision } from '@/lib/geo/ip-place.types';
import { isSessionAlive, type EndedSession } from './session-lifecycle';
import type {
  UserSession,
  SessionDeviceInfo,
  SessionStatus,
  SessionMetadata,
  SessionLocation,
  SessionStatistics,
  SessionDisplayItem,
  EndedSessionDisplayItem,
  DeviceType,
  LoginMethod
} from './session.types';

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_SESSION_DURATION_HOURS = 24;
export const EXTENDED_SESSION_DURATION_DAYS = 30;
export const MAX_CONCURRENT_SESSIONS = 10;
/**
 * Πόσο ζει το έγγραφο **μετά** τη λήξη/ανάκλησή του, πριν το σβήσει η πολιτική TTL του Firestore (`purgeAt`).
 * Πρότυπο: η ορατότητα του security log του GitHub (~90 ημέρες). ADR-894 §5.
 */
export const SESSION_RETENTION_DAYS = 90;

// ============================================================================
// DATA MAPPING
// ============================================================================

const PRECISIONS: readonly IpPlacePrecision[] = ['city', 'country', 'none'];
const BASES: readonly IpPlaceBasis[] = [
  'geoip', 'no-match', 'non-public-address', 'no-address', 'database-unavailable', 'legacy',
];

export const LEGACY_LOCATION: SessionLocation = {
  countryCode: null, city: null, region: null, precision: 'none', basis: 'legacy', source: null, ipFingerprint: null,
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function readSource(value: unknown): GeoIpSource | null {
  if (!value || typeof value !== 'object') return null;
  const { database, edition } = value as Record<string, unknown>;
  return typeof database === 'string' && typeof edition === 'string' ? { database, edition } : null;
}

/**
 * Ανεκτική ανάγνωση. Έγγραφο **πριν** από το ADR-894 (τοποθεσία από τον browser, χωρίς `precision`)
 * ⇒ `legacy`: δεν δείχνεται ως γνώση, γιατί ήταν πλαστογραφήσιμη και είχε σκληρή εφεδρεία «GR».
 */
export function readSessionLocation(value: unknown): SessionLocation {
  if (!value || typeof value !== 'object') return LEGACY_LOCATION;
  const raw = value as Record<string, unknown>;
  const precision = PRECISIONS.find((p) => p === raw.precision);
  const basis = BASES.find((b) => b === raw.basis);
  if (!precision || !basis) return LEGACY_LOCATION;
  return {
    countryCode: stringOrNull(raw.countryCode),
    city: stringOrNull(raw.city),
    region: stringOrNull(raw.region),
    precision,
    basis,
    source: readSource(raw.source),
    ipFingerprint: stringOrNull(raw.ipFingerprint),
  };
}

/**
 * Map Firestore document to UserSession
 */
export function mapDocToSession(data: Record<string, unknown>): UserSession {
  const timestamps = (data.timestamps ?? {}) as Record<string, unknown>;
  return {
    id: data.id as string,
    userId: data.userId as string,
    deviceInfo: data.deviceInfo as SessionDeviceInfo,
    location: readSessionLocation(data.location),
    ...(data.lastLocation ? { lastLocation: readSessionLocation(data.lastLocation) } : {}),
    timestamps: {
      createdAt: normalizeToDate(timestamps.createdAt) ?? new Date(),
      lastActiveAt: normalizeToDate(timestamps.lastActiveAt) ?? new Date(),
      expiresAt: normalizeToDate(timestamps.expiresAt) ?? new Date(),
      revokedAt: normalizeToDate(timestamps.revokedAt) ?? undefined
    },
    status: data.status as SessionStatus,
    metadata: data.metadata as SessionMetadata,
    revocationReason: data.revocationReason as string | undefined,
    revokedBy: data.revokedBy as string | undefined
  };
}

/** «Ενεργή» = κατάσταση `active` **και** όχι ληγμένη — ο ΙΔΙΟΣ κριτής με τον server (`session-lifecycle.ts`). */
export function isSessionLive(session: UserSession, now: Date = new Date()): boolean {
  return isSessionAlive(
    { status: session.status, expiresAtMs: session.timestamps.expiresAt.getTime() },
    now.getTime(),
  );
}

/** Η πιο πρόσφατη γνωστή τοποθεσία. */
export function currentLocationOf(session: UserSession): SessionLocation {
  return session.lastLocation ?? session.location;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Format sessions for UI display. `currentSessionId` = η εγγραφή **αυτού** του browser — η «τρέχουσα
 * συσκευή» είναι αλήθεια του θεατή, όχι του εγγράφου (ADR-894 §4).
 */
export function formatSessionsForDisplay(
  sessions: UserSession[],
  currentSessionId: string | null
): SessionDisplayItem[] {
  return sessions.map(session => ({
    id: session.id,
    browser: session.deviceInfo.browser,
    os: session.deviceInfo.os,
    location: currentLocationOf(session),
    lastActiveRelative: formatRelativeTime(session.timestamps.lastActiveAt),
    isCurrent: session.id === currentSessionId,
    status: session.status,
    deviceType: session.deviceInfo.type,
    browserType: session.deviceInfo.browserType,
    timestamps: session.timestamps
  }));
}

/** ADR-894 §10 Β2 — οι τελειωμένες, με λόγο και στιγμή τέλους (δεν είναι ποτέ «τρέχουσα»). */
export function formatEndedSessionsForDisplay(ended: readonly EndedSession<UserSession>[]): EndedSessionDisplayItem[] {
  return ended.map(({ session, reason, endedAt }) => ({
    ...formatSessionsForDisplay([session], null)[0],
    endReason: reason,
    endedAt,
  }));
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Compute session statistics from a list of sessions
 */
export function computeSessionStatistics(allSessions: UserSession[]): SessionStatistics {
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
    // Μόνο ό,τι **ξέρουμε** μετρά ως τοποθεσία — δέκα «άγνωστες» δεν είναι δέκα μέρη.
    const place = currentLocationOf(session);
    if (place.countryCode) uniqueLocations.add(`${place.city ?? ''}-${place.countryCode}`);
  }

  const lastLogin = allSessions.length > 0
    ? allSessions[0].timestamps.createdAt
    : null;

  return {
    totalSessions: allSessions.length,
    activeSessions: allSessions.filter(s => isSessionLive(s)).length,
    byDeviceType,
    byLoginMethod,
    lastLogin,
    uniqueLocations: uniqueLocations.size
  };
}
