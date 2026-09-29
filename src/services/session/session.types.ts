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

import type { SessionEndReason } from './session-lifecycle';
import type { IpPlace } from '@/lib/geo/ip-place.types';

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
 * Η τοποθεσία μιας συνεδρίας — **επιλυμένη στον server**, από την IP του αιτήματος, με τοπική βάση GeoIP (ADR-894).
 *
 * GDPR: επίπεδο πόλης το πολύ· η IP **δεν** αποθηκεύεται ποτέ, μόνο το αποτύπωμά της με **μυστικό** αλάτι
 * (`clientIpFingerprint`, ADR-876 §5). Κωδικός χώρας αντί για όνομα — το όνομα αποδίδεται στην οθόνη.
 */
export interface SessionLocation extends IpPlace {
  /** `clientIpFingerprint(ip)` — για σύγκριση «άλλαξε δίκτυο;», ποτέ η ίδια η IP· `null` χωρίς διεύθυνση. */
  ipFingerprint: string | null;
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
  /** Η τοποθεσία στη σύνδεση (GDPR compliant) */
  location: SessionLocation;
  /**
   * Η **τελευταία** τοποθεσία, όταν η συσκευή άλλαξε δίκτυο μετά τη σύνδεση (ADR-894 §4). Απούσα = ίδια με τη σύνδεση.
   * Το GitHub δείχνει μόνο την πρώτη· ένας κλεμμένος υπολογιστής που συνεχίζει από άλλη πόλη **φαίνεται** εδώ.
   */
  lastLocation?: SessionLocation;
  /** Timestamp information */
  timestamps: SessionTimestamps;
  /** Current session status */
  status: SessionStatus;
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
 * Ό,τι ξέρει **μόνο** ο browser για τη συσκευή του — τα υπόλοιπα (UA, IP, τοποθεσία) τα διαβάζει ο server
 * από το ίδιο το αίτημα, ώστε να μη μπορούν να πλαστογραφηθούν (ADR-894 §4).
 */
export interface ClientDeviceHints {
  screenResolution?: string;
  language?: string;
}

/**
 * `POST /api/auth/active-sessions` — «αυτός ο browser είναι ενεργός». `sessionId` = η εγγραφή που
 * θυμάται ο browser (αν θυμάται)· ο server την αγγίζει αν ζει, αλλιώς φτιάχνει νέα.
 */
export interface SyncActiveSessionInput extends ClientDeviceHints {
  sessionId: string | null;
  loginMethod: LoginMethod;
}

export interface SyncActiveSessionResult {
  sessionId: string;
  created: boolean;
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
  /** Browser + έκδοση (π.χ. «Chrome 140») — η φράση «X σε Y» συντίθεται στην οθόνη, μέσω i18n */
  browser: string;
  /** Λειτουργικό σύστημα */
  os: OperatingSystem;
  /** Η πιο πρόσφατη γνωστή τοποθεσία — αποδίδεται στη γλώσσα του αναγνώστη από την οθόνη, ποτέ εδώ */
  location: SessionLocation;
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

/** ADR-894 §10 Β2 — μια συνεδρία που **τελείωσε** (Google «Your devices»: 28 ημέρες). */
export interface EndedSessionDisplayItem extends SessionDisplayItem {
  /** Γιατί τελείωσε — κλειστό σύνολο (`session-lifecycle.ts`), κείμενο από το locale. */
  endReason: SessionEndReason;
  /** Πότε τελείωσε. */
  endedAt: Date;
}

/** Η λίστα συσκευών από **ένα** ερώτημα: ζωντανές + όσες τελείωσαν στο παράθυρο. */
export interface SessionsOverviewDisplay {
  live: SessionDisplayItem[];
  ended: EndedSessionDisplayItem[];
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
  /**
   * ADR-894 §10 Β1 — ανακλήθηκαν **όλες** οι συνδέσεις και αυτή η συσκευή **δεν** πήρε νέο κλειδί (χωρίς
   * Bearer, ή αποτυχία υιοθέτησης) ⇒ η οθόνη στέλνει στη σύνδεση. Η πράξη **έγινε**.
   */
  signInRequired?: boolean;
}
