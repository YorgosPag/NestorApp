import 'server-only';

/**
 * Server-Only Admin Environment Configuration
 *
 * Centralized module for server-only admin environment variables.
 * Used by admin API routes (seed, populate, migrate).
 *
 * IMPORTANT: These are server-only - do NOT prefix with NEXT_PUBLIC_
 *
 * Required .env.local variables:
 *   ADMIN_COMPANY_NAME="Your Company Name"
 *
 * Optional .env.local variables:
 *   ADMIN_PROJECT_NAME="Your Project Name"
 *   ADMIN_DEFAULT_CITY="Your City"
 *
 * @module config/admin-env
 * @serverOnly
 */

// ============================================================================
// REQUIRED ENV VARS (fail-fast on missing)
// ============================================================================

/**
 * Get required admin company name from server-only env var.
 * Throws clear error if not configured.
 *
 * @returns Company name string
 * @throws Error if ADMIN_COMPANY_NAME is not set
 */
export function getRequiredAdminCompanyName(): string {
  const companyName = process.env.ADMIN_COMPANY_NAME;
  if (!companyName) {
    throw new Error(
      '[admin-env] ADMIN_COMPANY_NAME env var is required but not set. ' +
      'Add it to .env.local: ADMIN_COMPANY_NAME="Your Company Name"'
    );
  }
  return companyName;
}

