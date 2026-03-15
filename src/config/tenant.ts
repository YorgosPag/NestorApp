/**
 * @fileoverview Tenant Configuration — Single Source of Truth
 * @version 2.0.0
 * @since 2026-03-13
 *
 * Enterprise company ID for the ΠΑΓΩΝΗΣ tenant.
 * Migrated from legacy Firestore auto-ID to enterprise format on 2026-03-13.
 *
 * @see ADR-210 Phase 4: Legacy Company ID Migration
 */

/**
 * Tenant company ID — Single Source of Truth.
 *
 * This is the enterprise ID for the ΠΑΓΩΝΗΣ company document
 * at `companies/{TENANT_COMPANY_ID}` in Firestore.
 *
 * Also stored in:
 * - Firebase custom claims: `token.companyId`
 * - Firestore `/users/{uid}.companyId`
 *
 * Migration history:
 * - Pre-2026-03-13: `pzNUy8ksddGCtcQMqumR` (Firestore auto-ID)
 * - Post-2026-03-13: `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` (enterprise ID)
 */
export const TENANT_COMPANY_ID = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

/**
 * @deprecated Use TENANT_COMPANY_ID instead. Kept for backward compatibility
 * during transition period. Will be removed in a future cleanup.
 */
export const LEGACY_TENANT_COMPANY_ID = TENANT_COMPANY_ID;

/**
 * Get the company ID for server-side operations.
 *
 * Resolution order:
 * 1. `NEXT_PUBLIC_DEFAULT_COMPANY_ID` env var (allows override per environment)
 * 2. `TENANT_COMPANY_ID` constant (hardcoded SSoT)
 *
 * Use this function in ALL server-side code (webhooks, API routes, services)
 * instead of reading `process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID` directly.
 *
 * @returns The enterprise company ID
 */
export function getCompanyId(): string {
  return process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || TENANT_COMPANY_ID;
}
