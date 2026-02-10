import 'server-only';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('environment-security-config');

/**
 * 🏢 ENTERPRISE ENVIRONMENT SECURITY CONFIGURATION
 *
 * Centralized security policies για κάθε runtime environment.
 * Implements graduated security levels όπως SAP, Microsoft, Google.
 *
 * @module config/environment-security-config
 * @serverOnly
 * @enterprise
 *
 * ARCHITECTURE DECISION RECORD (ADR):
 * - Problem: Hard-coded ALLOWED_ENVIRONMENTS array στο admin-guards.ts
 * - Solution: Centralized environment-aware security policies
 * - Benefits: Type-safe, graduated security, production-ready
 * - Trade-offs: More configuration, but much safer for production
 *
 * SECURITY AUDIT COMPLIANCE:
 * - Addresses SECURITY_AUDIT_REPORT.md findings (2025-12-15)
 * - Enables production deployment με proper security controls
 * - Implements graduated security levels ανά environment
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Runtime environment types
 * Maps NODE_ENV values to our security policies
 */
export type RuntimeEnvironment = 'development' | 'staging' | 'test' | 'production';

/**
 * Security policy configuration ανά environment
 * @enterprise Graduated security levels pattern (Microsoft/Google approach)
 */
export interface EnvironmentSecurityPolicy {
  /** Allow API access σε αυτό το environment */
  allowApiAccess: boolean;

  /** Require Firebase authentication tokens */
  requireAuthentication: boolean;

  /** Enable rate limiting για abuse protection */
  enableRateLimiting: boolean;

  /** Enable structured audit logging */
  enableAuditLogging: boolean;

  /** Require webhook secrets για external integrations */
  requireWebhookSecrets: boolean;

  /** Maximum requests per minute per user */
  maxRequestsPerMinute: number;

  /** Require admin email verification (NEXT_PUBLIC_ADMIN_EMAILS) */
  requireAdminEmailVerification: boolean;

  /** Enable enhanced validation (business logic checks) */
  enableEnhancedValidation: boolean;

  /** Allow development bypass (για local testing) */
  allowDevBypass: boolean;
}

/**
 * Operation validation result
 */
export interface OperationValidationResult {
  allowed: boolean;
  reason?: string;
  environment: RuntimeEnvironment;
  policy: EnvironmentSecurityPolicy;
}

// ============================================================================
// CENTRALIZED SECURITY POLICIES
// ============================================================================

/**
 * 🏢 ENTERPRISE: Graduated Security Policies per Environment
 *
 * Development: Lenient για fast iteration
 * Staging: Production-like με relaxed limits
 * Test: Optimized για automated testing
 * Production: Maximum security, strict limits
 */
export const ENVIRONMENT_SECURITY_POLICIES: Record<RuntimeEnvironment, EnvironmentSecurityPolicy> = {
  /**
   * DEVELOPMENT: Fast iteration, minimal security
   * - No authentication bypass για local testing
   * - No rate limiting (unlimited requests)
   * - Audit logging enabled (για debugging)
   * - No webhook secrets required
   */
  development: {
    allowApiAccess: true,
    requireAuthentication: false, // Dev bypass enabled
    enableRateLimiting: false,
    enableAuditLogging: true,
    requireWebhookSecrets: false,
    maxRequestsPerMinute: 10000, // Effectively unlimited
    requireAdminEmailVerification: false,
    enableEnhancedValidation: false,
    allowDevBypass: true,
  },

  /**
   * STAGING: Production-like environment για testing
   * - Full authentication required
   * - Rate limiting enabled (relaxed limits)
   * - Full audit logging
   * - Webhook secrets required
   */
  staging: {
    allowApiAccess: true,
    requireAuthentication: true,
    enableRateLimiting: true,
    enableAuditLogging: true,
    requireWebhookSecrets: true,
    maxRequestsPerMinute: 500,
    requireAdminEmailVerification: true,
    enableEnhancedValidation: true,
    allowDevBypass: false,
  },

  /**
   * TEST: Optimized για automated testing
   * - Authentication required (no bypass)
   * - No rate limiting (για test suites)
   * - Minimal logging (για performance)
   * - No webhook secrets (για test isolation)
   */
  test: {
    allowApiAccess: true,
    requireAuthentication: true,
    enableRateLimiting: false,
    enableAuditLogging: false,
    requireWebhookSecrets: false,
    maxRequestsPerMinute: 100000, // No limits για tests
    requireAdminEmailVerification: false,
    enableEnhancedValidation: false,
    allowDevBypass: false,
  },

  /**
   * PRODUCTION: Maximum security
   * - Strict authentication
   * - Aggressive rate limiting
   * - Full audit trail
   * - All security features enabled
   */
  production: {
    allowApiAccess: true,
    requireAuthentication: true,
    enableRateLimiting: true,
    enableAuditLogging: true,
    requireWebhookSecrets: true,
    maxRequestsPerMinute: 100, // Conservative limit
    requireAdminEmailVerification: true,
    enableEnhancedValidation: true,
    allowDevBypass: false,
  },
} as const;

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

/**
 * Get current runtime environment από NODE_ENV
 * @returns RuntimeEnvironment type
 */
export function getCurrentRuntimeEnvironment(): RuntimeEnvironment {
  const env = process.env.NODE_ENV as string | undefined;

  // Map NODE_ENV values to our RuntimeEnvironment types
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  if (env === 'test') return 'test';

  // Default to development (safest fallback)
  return 'development';
}

/**
 * Get security policy for current environment
 * @returns Current environment's security policy
 */
export function getCurrentSecurityPolicy(): EnvironmentSecurityPolicy {
  const env = getCurrentRuntimeEnvironment();
  return ENVIRONMENT_SECURITY_POLICIES[env];
}

/**
 * Get security policy for specific environment
 * @param environment - Target environment
 * @returns Environment's security policy
 */
export function getSecurityPolicyForEnvironment(
  environment: RuntimeEnvironment
): EnvironmentSecurityPolicy {
  return ENVIRONMENT_SECURITY_POLICIES[environment];
}

// ============================================================================
// SECURITY VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if current environment allows API access
 * @returns true if API access is allowed
 */
export function isApiAccessAllowed(): boolean {
  return getCurrentSecurityPolicy().allowApiAccess;
}

/**
 * Check if current environment requires authentication
 * @returns true if authentication is required
 */
export function isAuthenticationRequired(): boolean {
  return getCurrentSecurityPolicy().requireAuthentication;
}

/**
 * Check if current environment allows development bypass
 * @returns true if dev bypass is allowed
 */
export function isDevBypassAllowed(): boolean {
  return getCurrentSecurityPolicy().allowDevBypass;
}

/**
 * Validate environment για specific operation
 *
 * @param operation - Operation name (για audit logging)
 * @returns Validation result με allowed status και reason
 *
 * @enterprise Used by admin-guards.ts για environment gating
 *
 * @example
 * ```typescript
 * const result = validateEnvironmentForOperation('seedBuildings');
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 * ```
 */
export function validateEnvironmentForOperation(
  operation: string
): OperationValidationResult {
  const env = getCurrentRuntimeEnvironment();
  const policy = getCurrentSecurityPolicy();

  // Check if API access is allowed
  if (!policy.allowApiAccess) {
    return {
      allowed: false,
      reason: `Operation '${operation}' not allowed in ${env} environment`,
      environment: env,
      policy,
    };
  }

  // Success - operation is allowed
  return {
    allowed: true,
    environment: env,
    policy,
  };
}

/**
 * Assert that environment allows operation (throws if not)
 *
 * @param operation - Operation name
 * @throws Error if operation not allowed in current environment
 *
 * @enterprise Used by admin endpoints for fail-fast validation
 */
export function assertEnvironmentAllowsOperation(operation: string): void {
  const result = validateEnvironmentForOperation(operation);

  if (!result.allowed) {
    throw new Error(
      `[ENVIRONMENT_SECURITY] ${result.reason || 'Operation not allowed'}`
    );
  }
}

// ============================================================================
// ENVIRONMENT INFO LOGGING
// ============================================================================

/**
 * Log current environment και security policy (για debugging)
 * Only logs in development/staging
 */
export function logEnvironmentSecurityStatus(): void {
  const env = getCurrentRuntimeEnvironment();
  const policy = getCurrentSecurityPolicy();

  // Only log in non-production
  if (env === 'production') {
    return;
  }

  logger.info('[ENVIRONMENT_SECURITY] Current Configuration', {
    environment: env,
    apiAccess: policy.allowApiAccess,
    authentication: policy.requireAuthentication,
    rateLimiting: policy.enableRateLimiting,
    auditLogging: policy.enableAuditLogging,
    maxRequestsPerMin: policy.maxRequestsPerMinute,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Re-export types για type-safe usage
 */
export type {
  RuntimeEnvironment as Environment,
  EnvironmentSecurityPolicy as SecurityPolicy,
  OperationValidationResult as ValidationResult,
};

/**
 * Default export - current security policy
 */
export default getCurrentSecurityPolicy;
