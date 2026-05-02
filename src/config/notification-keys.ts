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
    companyIdentity: {
      unsafeClear: 'common-shared.contacts.companyIdentityImpact.unsafeClear',
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

  // ==========================================================================
  // PROCUREMENT domain (ADR-327: Quote Management & Comparison System)
  // ==========================================================================
  procurement: {
    quote: {
      submittedViaPortal: 'quotes:quotes.notifications.quoteSubmittedViaPortal',
      vendorDeclined: 'quotes:quotes.notifications.vendorDeclined',
      vendorEdited: 'quotes:quotes.notifications.vendorEdited',
      inviteSent: 'quotes:quotes.notifications.inviteSent',
      inviteFailed: 'quotes:quotes.notifications.inviteFailed',
    },
  },

  // ==========================================================================
  // BUILDINGS domain
  // ==========================================================================
  buildings: {
    created: 'building:dialog.messages.success',
    updated: 'building:dialog.messages.updateSuccess',
    createError: 'building:dialog.messages.error',
    updateError: 'building:dialog.messages.updateError',
    floor: {
      created: 'building:dialog.addFloor.messages.success',
      createError: 'building:dialog.addFloor.messages.error',
      duplicate: 'building:dialog.addFloor.messages.duplicate',
    },
  },

  // ==========================================================================
  // FILES domain
  // ==========================================================================
  files: {
    upload: {
      success: 'files:upload.success',
      notAuthenticated: 'files:upload.errors.notAuthenticated',
      authFailed: 'files:upload.errors.authFailed',
      partialSuccess: 'files:upload.errors.partialSuccess',
      allFailed: 'files:upload.errors.allFailed',
      generic: 'files:upload.errors.generic',
    },
    list: {
      renameSuccess: 'files:list.renameSuccess',
      renameError: 'files:list.renameError',
      deleteSuccess: 'files:list.deleteSuccess',
      deleteError: 'files:list.deleteError',
      unlinkSuccess: 'files:list.unlinkSuccess',
      unlinkError: 'files:list.unlinkError',
    },
    technical: {
      pathUnavailable: 'files:technical.pathUnavailable',
      pathCopied: 'files:technical.pathCopied',
      copyError: 'common:copy.copyError',
    },
    trash: {
      restoreSuccess: 'files:trash.restoreSuccess',
      restoreError: 'files:trash.restoreError',
    },
    archived: {
      unarchiveSuccess: 'files:archived.unarchiveSuccess',
      unarchiveError: 'files:archived.unarchiveError',
    },
    batch: {
      // archiveSuccess/archivePartialSuccess/archiveNoChanges owned by showArchiveResultFeedback()
      // SSoT registry module "archive-feedback" — do not add here
      archiveError: 'files:batch.archiveError',
      unarchiveSuccess: 'files:batch.unarchiveSuccess',
      unarchiveError: 'files:batch.unarchiveError',
      noAIClassifiableFiles: 'files:batch.noAIClassifiableFiles',
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
