/**
 * @fileoverview Tenant Configuration — Single Source of Truth
 * @version 1.0.0
 * @since 2026-03-13
 *
 * Centralizes the legacy tenant company ID that was previously hardcoded
 * across 21+ files. New companies will use enterprise IDs (comp_xxx).
 *
 * @see ADR-210 Phase 3: Company Document Materialization
 */

/**
 * Legacy tenant company ID — Single Source of Truth.
 *
 * This is the Firestore document ID for the ΠΑΓΩΝΗΣ company in the
 * `contacts` collection (type='company'). It also serves as the
 * `companyId` in Firebase custom claims for all existing users.
 *
 * **Why not change it?**
 * - Firebase custom claims of ALL users reference this ID
 * - Subcollections (audit_logs, RBAC) already exist under `companies/{this_id}`
 * - Changing it would require re-seeding claims for every user
 *
 * **New companies** will use enterprise IDs via `generateCompanyId()` → `comp_xxx`
 */
export const LEGACY_TENANT_COMPANY_ID = 'pzNUy8ksddGCtcQMqumR';
