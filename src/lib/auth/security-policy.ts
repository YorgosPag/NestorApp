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
 * 🔴 **ΤΟ ΛΕΞΙΛΟΓΙΟ ΔΙΑΧΕΙΡΙΣΤΗ ΑΦΑΙΡΕΘΗΚΕ ΑΠΟ ΕΔΩ** (ADR-801 Φάση 3).
 *
 * Ζούσαν εδώ `ADMIN_ROLES = ['admin','broker','builder']`, ο τύπος `AdminRole`,
 * τα `MFA_REQUIRED_ROLES`, το `roleRequiresMfa()` και το `isAdminRole()` — **με
 * μηδέν καταναλωτές**, μετρημένα: κανένα αρχείο του δέντρου δεν τα εισήγαγε
 * ποτέ (μόνο τα `SESSION_COOKIE_CONFIG` / `getSessionCookieDurationMs` από
 * αυτό το αρχείο έχουν χρήστες).
 *
 * ⚠️ **Δεν ήταν αδρανή — ήταν ΔΟΛΩΜΑ.** Το λεξιλόγιό τους (`admin`·`broker`·
 * `builder`) ανήκει σε **παλαιότερο** σύστημα ρόλων, ενώ τα claims του Firebase
 * λένε `super_admin`·`company_admin`·`internal_user`·`external_user`. Ένα
 * `isAdminRole('company_admin')` επέστρεφε **`false`** — δηλαδή ο πρώτος που θα
 * το εμπιστευόταν θα έκλεινε σιωπηλά έξω **κάθε** διαχειριστή εταιρείας, και το
 * σφάλμα θα έμοιαζε με «λάθος δικαιώματα» αντί για «λάθος λίστα». Το
 * `mcp-identity.ts` είχε **ήδη** γράψει αυτή την προειδοποίηση σε σχόλιο· ένα
 * σχόλιο δεν είναι φρουρός (μάθημα CHECK 3.36).
 *
 * ⇒ Η **μόνη** αυθεντία για το «επιτρέπεται;» είναι ο `lib/auth/authority.ts`.
 * ⚠️ **ΜΗΝ ξαναφέρεις σύνολο ρόλων σε αυτό το αρχείο** — εδώ ζει η πολιτική
 *    **συνεδρίας**, όχι η εξουσιοδότηση.
 */

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


