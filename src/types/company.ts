/**
 * @fileoverview Company Document Types — ADR-210 Phase 3
 * @version 1.0.0
 * @since 2026-03-13
 *
 * Defines the shape of a real `companies/{id}` document in Firestore.
 * Previously, company documents were "phantom" — they existed only because
 * subcollections (audit_logs, RBAC) were written under their path.
 *
 * @see ADR-210: Enterprise ID Standardization
 */

import type { Timestamp } from 'firebase/firestore';
import type { OrgStructure } from '@/types/org/org-structure';

// =============================================================================
// COMPANY DOCUMENT
// =============================================================================

/**
 * Company status lifecycle.
 *
 * - `active`: Normal operation
 * - `suspended`: Temporarily disabled (e.g., payment issue)
 * - `archived`: Soft-deleted, read-only
 */
export type CompanyStatus = 'active' | 'suspended' | 'archived';

/**
 * Subscription plan tiers.
 */
export type CompanyPlan = 'free' | 'starter' | 'professional' | 'enterprise';

/**
 * Company-level settings stored in the company document.
 */
export interface CompanySettings {
  /** Default locale for this company's UI */
  readonly defaultLocale: 'el' | 'en';
  /** IANA timezone (e.g., 'Europe/Athens') */
  readonly timezone: string;
  /** Feature flags scoped to this company */
  readonly features: Record<string, boolean>;
  /** Org structure: departments, members, routing rules (ADR-326) */
  readonly orgStructure?: OrgStructure;
}

/**
 * A materialized company document in Firestore.
 *
 * Path: `companies/{id}`
 *
 * Links to the contact record via `contactId` (FK → `contacts` collection).
 * The contact record holds the business details (name, VAT, phones, address).
 * This document holds tenant-level configuration and metadata.
 */
export interface CompanyDocument {
  /** Firestore document ID (legacy: raw Firestore ID, new: comp_xxx) */
  readonly id: string;
  /** Human-readable company name (denormalized from contact for quick access) */
  readonly name: string;
  /** FK → contacts collection (the contact with type='company') */
  readonly contactId: string;
  /** Company lifecycle status */
  readonly status: CompanyStatus;
  /** Subscription plan */
  readonly plan: CompanyPlan;
  /** Company-level settings */
  readonly settings: CompanySettings;
  /** When this document was created */
  readonly createdAt: Timestamp;
  /** Last update timestamp */
  readonly updatedAt: Timestamp;
  /** UID of the user who created this document */
  readonly createdBy: string;
}

// =============================================================================
// HELPER TYPES
// =============================================================================
