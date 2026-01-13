/**
 * 🔐 SESSION TYPES - ENTERPRISE SESSION MANAGEMENT
 *
 * Type definitions for active session tracking and management.
 * Following enterprise security standards (Google, Microsoft, Okta).
 *
 * @module services/session/session.types
 * @enterprise-ready true
 * @security-critical true
 * @gdpr-compliant true
 */

// ============================================================================
// DEVICE INFORMATION TYPES
// ============================================================================

/**
 * Device type classification
 * Enterprise pattern: Explicit device categorization for security analytics
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

/**
 * Operating system detection
 */
export type OperatingSystem =
  | 'Windows'
  | 'macOS'
  | 'Linux'
  | 'iOS'
  | 'Android'
  | 'ChromeOS'
  | 'Unknown';

/**
 * Browser detection
 */
export type BrowserType =
  | 'Chrome'
  | 'Firefox'
  | 'Safari'
  | 'Edge'
  | 'Opera'
  | 'Unknown';

/**
 * Device information captured on session creation
 * GDPR: Contains only necessary technical data
 */
export interface SessionDeviceInfo {
  /** Device type classification */
  type: DeviceType;
  /** Browser name and version */
  browser: string;
  /** Browser type for icons */
  browserType: BrowserType;
  /** Operating system */
  os: OperatingSystem;
  /** OS version (e.g., "11", "14.2") */
  osVersion: string;
  /** Full user agent string (for debugging) */
  userAgent: string;
  /** Screen resolution (optional) */
  screenResolution?: string;
  /** Device language */
  language: string;
}

// ============================================================================
// LOCATION TYPES (GDPR COMPLIANT)
// ============================================================================

/**
 * Session location information
 * GDPR: City-level only, IP hashed, marked as approximate
 */
export interface SessionLocation {
  /** Hashed IP address (SHA-256, first 8 chars) - GDPR compliant */
  ipHash: string;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode: string;
  /** Country name (localized) */
  countryName: string;
  /** City name (approximate) */
  city: string;
  /** Region/State (optional) */
  region?: string;
  /** Timezone */
  timezone: string;
  /** Flag: Always true to indicate approximate location */
  isApproximate: true;
}

// ============================================================================
// SESSION STATUS & METADATA
// ============================================================================

/**
 * Session status states
 */
export type SessionStatus = 'active' | 'revoked' | 'expired' | 'suspicious';

/**
 * Login method used to create session
 */
export type LoginMethod = 'email' | 'google' | 'microsoft' | 'apple' | 'phone';

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** Method used for authentication */
  loginMethod: LoginMethod;
  /** Whether "remember me" was selected */
  rememberMe: boolean;
  /** Whether 2FA was used */
  twoFactorUsed: boolean;
  /** App version at session creation */
  appVersion: string;
  /** Session creation source */
  source: 'web' | 'mobile-app' | 'api' | 'cli';
}

// ============================================================================
// SESSION TIMESTAMPS
// ============================================================================

/**
 * Session timestamp information
 * Enterprise pattern: Full audit trail
 */
export interface SessionTimestamps {
  /** When session was created */
  createdAt: Date;
  /** Last activity timestamp */
  lastActiveAt: Date;
  /** When session expires */
  expiresAt: Date;
  /** When session was revoked (if applicable) */
  revokedAt?: Date;
}

// ============================================================================
// MAIN SESSION INTERFACE
// ============================================================================

/**
 * Complete session record
 * Enterprise-grade session tracking following Google/Microsoft patterns
 */
export interface UserSession {
  /** Unique session identifier */
  id: string;
  /** User ID this session belongs to */
  userId: string;
  /** Device information */
  deviceInfo: SessionDeviceInfo;
  /** Location information (GDPR compliant) */
  location: SessionLocation;
  /** Timestamp information */
  timestamps: SessionTimestamps;
  /** Current session status */
  status: SessionStatus;
  /** Whether this is the current device's session */
  isCurrent: boolean;
  /** Session metadata */
  metadata: SessionMetadata;
  /** Revocation reason (if revoked) */
  revocationReason?: string;
  /** Who revoked the session (if revoked by admin) */
  revokedBy?: string;
}

// ============================================================================
// SESSION SERVICE INTERFACES
// ============================================================================

/**
 * Session creation input
 */
export interface CreateSessionInput {
  userId: string;
  loginMethod: LoginMethod;
  rememberMe?: boolean;
  twoFactorUsed?: boolean;
}

/**
 * Session update input
 */
export interface UpdateSessionInput {
  lastActiveAt?: Date;
  status?: SessionStatus;
  revocationReason?: string;
  revokedBy?: string;
}

/**
 * Session query filters
 */
export interface SessionQueryFilters {
  /** Filter by status */
  status?: SessionStatus;
  /** Filter by device type */
  deviceType?: DeviceType;
  /** Filter by login method */
  loginMethod?: LoginMethod;
  /** Only active sessions */
  activeOnly?: boolean;
  /** Limit results */
  limit?: number;
}

/**
 * Session statistics
 */
export interface SessionStatistics {
  /** Total sessions for user */
  totalSessions: number;
  /** Currently active sessions */
  activeSessions: number;
  /** Sessions by device type */
  byDeviceType: Record<DeviceType, number>;
  /** Sessions by login method */
  byLoginMethod: Record<LoginMethod, number>;
  /** Most recent login */
  lastLogin: Date | null;
  /** Unique locations count */
  uniqueLocations: number;
}

// ============================================================================
// SESSION EVENTS (FOR NOTIFICATIONS)
// ============================================================================

/**
 * Session event types for notifications
 */
export type SessionEventType =
  | 'new_login'
  | 'session_revoked'
  | 'suspicious_activity'
  | 'password_changed'
  | 'all_sessions_revoked';

/**
 * Session event for audit/notifications
 */
export interface SessionEvent {
  /** Event type */
  type: SessionEventType;
  /** Session involved */
  sessionId: string;
  /** User involved */
  userId: string;
  /** Event timestamp */
  timestamp: Date;
  /** Device info at time of event */
  deviceInfo: SessionDeviceInfo;
  /** Location at time of event */
  location: SessionLocation;
  /** Additional event details */
  details?: Record<string, unknown>;
}

// ============================================================================
// UI DISPLAY TYPES
// ============================================================================

/**
 * Session for UI display (simplified)
 */
export interface SessionDisplayItem {
  /** Session ID */
  id: string;
  /** Display label (e.g., "Chrome on Windows") */
  displayLabel: string;
  /** Location display (e.g., "Athens, Greece") */
  locationDisplay: string;
  /** Last active relative time (e.g., "2 hours ago") */
  lastActiveRelative: string;
  /** Is this the current session */
  isCurrent: boolean;
  /** Session status */
  status: SessionStatus;
  /** Device type for icon */
  deviceType: DeviceType;
  /** Browser type for icon */
  browserType: BrowserType;
  /** Raw timestamps for sorting */
  timestamps: SessionTimestamps;
}

/**
 * Session management action result
 */
export interface SessionActionResult {
  /** Whether action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Affected session IDs */
  affectedSessions: string[];
  /** Action performed */
  action: 'revoke' | 'revoke_all' | 'extend' | 'update';
}
