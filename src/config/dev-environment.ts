/**
 * =============================================================================
 * DEV ENVIRONMENT CONFIG (SSoT)
 * =============================================================================
 *
 * Centralized configuration for development-only defaults.
 * All dev fallbacks must come from here (no scattered literals).
 *
 * @module config/dev-environment
 */

// eslint-disable-next-line no-console
const warn = (message: string) => console.warn(message);

/**
 * Get dev companyId for tenant isolation in development bypass flows.
 */
export function getDevCompanyId(): string {
  const companyId =
    process.env.DEV_COMPANY_ID ||
    process.env.NEXT_PUBLIC_DEV_COMPANY_ID;

  if (!companyId) {
    warn('[DEV_ENV] DEV_COMPANY_ID not set. Falling back to dev-company.');
    return 'dev-company';
  }

  return companyId;
}
