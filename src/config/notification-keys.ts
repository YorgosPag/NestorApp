/**
 * ============================================================================
 * NOTIFICATION KEYS — Single Source of Truth (SSoT)
 * ============================================================================
 *
 * Central registry of every i18n key used by the notification system.
 *
 * **Why**: Without an SSoT, notification keys are hardcoded strings scattered
 * across 120+ files. A typo in a key silently shows nothing; renaming a key
 * in a locale file requires grep-and-hope across the whole codebase.
 *
 * **How**: Every `notifications.success|error|info|warning(...)` call site
 * imports from here. Domain hooks in `src/hooks/notifications/` own the
 * "when to fire" logic and reference these keys by typed path.
 *
 * **Contract**:
 * - Each leaf value is the EXACT i18n key (namespace-prefixed when needed)
 * - Keys MUST exist in `src/i18n/locales/{el,en}/**.json`
 * - NEVER hardcode the string at the call site — import the constant
 * - Adding a new notification → add key here FIRST, then in locale files
 *
 * **Registered as SSoT**: `.ssot-registry.json` → `notification-keys` module
 *
 * @module config/notification-keys
 * @see src/hooks/notifications/ — domain-scoped notification dispatchers
 * @see docs/centralized-systems/reference/precommit-checks.md — hardcoded strings check (3.8)
 */

export const NOTIFICATION_KEYS = {
  // ==========================================================================
  // CONTACTS domain
  // ==========================================================================
  contacts: {
    form: {
      createSuccess: 'contacts-form.submission.createSuccess',
      updateSuccess: 'contacts-form.submission.updateSuccess',
      updateError: 'contacts-form.submission.updateError',
      failedUploads: 'contacts-form.submission.failedUploads',
      pendingUploads: 'contacts-form.submission.pendingUploads',
    },
    validation: {
      unknownType: 'contacts-form.validation.unknownType',
      reviewHighlightedFields: 'contacts-form.validation.individual.reviewHighlightedFields',
    },
    duplicate: {
      exactMatch: 'contacts-core.duplicate.exactMatch',
      possibleMatch: 'contacts-core.duplicate.possibleMatch',
      similarMatch: 'contacts-core.duplicate.similarMatch',
    },
  },

  // ==========================================================================
  // PROJECTS domain
  // ==========================================================================
  projects: {
    created: 'projects:messages.created',
    updated: 'projects:messages.updated',
    deleted: 'projects:messages.deleted',
    archived: 'projects:messages.archived',
    exported: 'projects:messages.exported',
    loadingError: 'projects:messages.loadingError',
    address: {
      added: 'projects-data:locations.notifications.added',
      updated: 'projects-data:locations.notifications.updated',
      deleted: 'projects-data:locations.notifications.deleted',
      cleared: 'projects-data:locations.notifications.cleared',
      primaryUpdated: 'projects-data:locations.notifications.primaryUpdated',
      saveError: 'projects-data:locations.notifications.saveError',
      updateError: 'projects-data:locations.notifications.updateError',
      deleteError: 'projects-data:locations.notifications.deleteError',
      clearError: 'projects-data:locations.notifications.clearError',
      soleAddressMustBePrimary: 'projects-data:locations.errors.soleAddressMustBePrimary',
      cityRequired: 'projects-data:locations.errors.cityRequired',
    },
  },
} as const;

// ============================================================================
// Type helpers — extract all leaf values as a union type of valid keys
// ============================================================================

type LeafValues<T> = T extends string
  ? T
  : T extends object
  ? { [K in keyof T]: LeafValues<T[K]> }[keyof T]
  : never;

export type NotificationKey = LeafValues<typeof NOTIFICATION_KEYS>;
