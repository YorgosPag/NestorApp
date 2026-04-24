/**
 * 🔒 Centralized Security Policy Configuration
 *
 * Single source of truth for security policies including:
 * - MFA requirements per role
 * - Session policies
 * - Access control policies
 *
 * @module lib/auth/security-policy
 * @version 1.0.0
 * @since 2026-01-29 - PR-1B MFA Enforcement
 *
 * @enterprise Local_Protocol: ZERO hardcoded security config in individual modules
 */

// =============================================================================
// MFA POLICY CONFIGURATION
// =============================================================================

/**
 * Admin roles that exist in the system.
 * These are the roles that can access admin APIs.
 */
export const ADMIN_ROLES = ['admin', 'broker', 'builder'] as const;

/**
 * Admin role type derived from registry.
 */
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * Roles that REQUIRE MFA enrollment for access.
 *
 * @enterprise Business rule: All admin-level roles must have MFA enabled
 * for compliance with security standards.
 *
 * @see PR-1B: MFA Enforcement
 */
export const MFA_REQUIRED_ROLES: readonly AdminRole[] = [
  'admin',
  'broker',
  'builder',
] as const;

/**
 * Check if a role requires MFA enrollment.
 *
 * @param role - The admin role to check
 * @returns true if the role requires MFA enrollment
 *
 * @example
 * ```typescript
 * if (roleRequiresMfa('admin')) {
 *   // Enforce MFA check
 * }
 * ```
 */
export function roleRequiresMfa(role: AdminRole): boolean {
  return MFA_REQUIRED_ROLES.includes(role);
}

/**
 * Check if a string is a valid admin role.
 */
export function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

// =============================================================================
// SESSION POLICY CONFIGURATION
// =============================================================================

/**
 * Session policy settings.
 */
export const SESSION_POLICY = {
  /**
   * Maximum session duration in hours.
   * After this time, user must re-authenticate.
   */
  MAX_SESSION_HOURS: 24,

  /**
   * Idle timeout in minutes.
   * After this time of inactivity, session is invalidated.
   */
  IDLE_TIMEOUT_MINUTES: 30,

  /**
   * MFA session validity in hours.
   * After this time, MFA must be re-verified.
   * Set to 0 to require MFA on every session.
   */
  MFA_SESSION_HOURS: 8,
} as const;

// =============================================================================
// SESSION COOKIE POLICY (SSoT)
// =============================================================================

/**
 * Session cookie configuration (Firebase __session cookie).
 * Centralized to avoid hardcoded values across the codebase.
 */
export const SESSION_COOKIE_CONFIG = {
  /** Firebase session cookie name (required by Firebase hosting/Vercel) */
  NAME: '__session',
  /** Cookie path scope */
  PATH: '/',
  /** SameSite policy for session cookie */
  SAME_SITE: 'lax',
  /** HTTP-only cookie (not accessible by JS) */
  HTTP_ONLY: true,
} as const;

/**
 * Get session cookie duration in milliseconds.
 * Uses centralized SESSION_POLICY.MAX_SESSION_HOURS.
 */
export function getSessionCookieDurationMs(): number {
  const hours = SESSION_POLICY.MAX_SESSION_HOURS;
  const minutesPerHour = 60;
  const secondsPerMinute = 60;
  const msPerSecond = 1000;
  return hours * minutesPerHour * secondsPerMinute * msPerSecond;
}


