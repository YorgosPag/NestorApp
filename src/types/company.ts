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
import type { OrganizationCapabilities } from '@/types/organization-capability';

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
 * The legal identity (επωνυμία, ΑΦΜ, ΔΟΥ, ΚΑΔ, entity type) lives in the
 * per-tenant company profile (`accounting_settings/{companyId}` — SSoT, ADR-439).
 * This document holds tenant-level configuration and metadata; its `name` is a
 * derived display cache of that profile (no self-contact for the tenant).
 */
export interface CompanyDocument {
  /** Firestore document ID (legacy: raw Firestore ID, new: comp_xxx) */
  readonly id: string;
  /** Human-readable display name — derived cache from the per-tenant company profile (ADR-439) */
  readonly name: string;
  /** Optional FK → external `contacts` record (NOT a self-contact; usually null) */
  readonly contactId: string;
  /** Company lifecycle status */
  readonly status: CompanyStatus;
  /** Subscription plan */
  readonly plan: CompanyPlan;
  /** Company-level settings */
  readonly settings: CompanySettings;
  /**
   * **Ρυθμιζόμενες ικανότητες του οργανισμού** — με κύκλο ζωής (ADR-824).
   *
   * 🔴 **ΔΕΝ ΕΙΝΑΙ `settings.features`, ΚΑΙ Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ.** Εκείνο
   * είναι `Record<string, boolean>` — **ανοιχτό** σύνολο κλειδιών, χωρίς αυθεντία,
   * χωρίς κύκλο ζωής, χωρίς αιτιολογία. Ένα **ρυθμιζόμενο δικαίωμα** σε σάκο σημαιών
   * λειτουργεί μέχρι να ρωτήσει κάποιος *«ποιος το άναψε και πότε;»* — το σχήμα της
   * λίστας email του ADR-801 §2. Εδώ κάθε εγγραφή φέρει **κατάσταση, απόφαση,
   * αποφασίζοντα, στιγμή και λόγο ανάκλησης**.
   *
   * ⛔ **ΚΑΙ ΔΕΝ ΕΙΝΑΙ `companyType` enum** (ADR-824 §4.1): στην Ελλάδα είναι
   * **συνηθέστατο** ένα τεχνικό γραφείο να κατέχει **και** μεσιτική άδεια. Ένα enum
   * τύπου κάνει αυτή την πραγματικότητα **μη εκφράσιμη**, και η αναπόφευκτη θεραπεία
   * είναι ένα `'mixed'` — τιμή που σημαίνει *«ρώτα αλλού»*.
   *
   * 🔑 **Ο κανόνας: «τι ΕΙΣΑΙ» είναι ΑΝΟΙΧΤΟ σύνολο· «τι ΕΠΙΤΡΕΠΕΣΑΙ» είναι ΚΛΕΙΣΤΟ.**
   * Μοντελοποιείς πάντα το κλειστό. Το ADR-798 έχει ήδη αυτό το δίδυμο για τον
   * **άνθρωπο** *(επάγγελμα ανοιχτό ⇄ `globalRole` κλειστό)*· εδώ επαναλαμβάνεται για
   * τον **οργανισμό**.
   *
   * ⚠️ **Προαιρετικό**: κάθε εταιρεία που υπάρχει σήμερα **δεν το έχει**, και η
   * απουσία σημαίνει `unrequested` για **κάθε** ικανότητα — δες `capabilityStatusOf`.
   */
  readonly capabilities?: OrganizationCapabilities;
  /** When this document was created */
  readonly createdAt: Timestamp;
  /** Last update timestamp */
  readonly updatedAt: Timestamp;
  /** UID of the user who created this document */
  readonly createdBy: string;
  /** UID of the user who last modified this document (entity-audit convention, ADR-210) */
  readonly _lastModifiedBy?: string;
  /** Display name of the last modifier — audit trail (null when unknown/system) */
  readonly _lastModifiedByName?: string | null;
  /** Last modification timestamp (entity-audit convention) */
  readonly _lastModifiedAt?: Timestamp;
}

// =============================================================================
// HELPER TYPES
// =============================================================================
