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
  // DXF IMPORT domain (ADR-635 Φ3 — Revit-style import warnings)
  // ==========================================================================
  dxfImport: {
    importedWithWarnings: 'dxf-viewer:import.warnings.summary',
  },

  // ==========================================================================
  // PROJECTS domain
  // ==========================================================================
  projects: {
    created: 'projects:messages.created',
    updated: 'projects:messages.updated',
    deleted: 'projects:messages.deleted',
    movedToTrash: 'projects:messages.movedToTrash',
    restored: 'projects:messages.restored',
    permanentlyDeleted: 'projects:messages.permanentlyDeleted',
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
  // PARKING domain
  // ==========================================================================
  parking: {
    created: 'parking:messages.created',
    updated: 'parking:messages.updated',
    createError: 'parking:messages.createError',
    updateError: 'parking:messages.updateError',
  },

  // ==========================================================================
  // PROPERTIES domain
  // ==========================================================================
  properties: {
    linkedSpaces: {
      parkingLinked: 'properties:linkedSpaces.notifications.parkingLinked',
      storageLinked: 'properties:linkedSpaces.notifications.storageLinked',
      spaceRemoved: 'properties:linkedSpaces.notifications.spaceRemoved',
      updated: 'properties:linkedSpaces.notifications.updated',
    },
  },

  // ==========================================================================
  // BIM 3D VIEWER domain (ADR-366 §B.5 + C.2)
  // ==========================================================================
  bim3d: {
    diagnostic: {
      /** Super-admin gets notified when a user submits a performance HUD snapshot */
      received: 'bim3d:performance.notification.diagnosticReceived',
    },
    comment: {
      /** User is @-mentioned in a BIM comment */
      mentioned: 'bim3d:comments.notification.mentioned',
      /** Comment is assigned to user */
      assigned: 'bim3d:comments.notification.assigned',
      /** New reply on a comment the user authored or is assigned to */
      replied: 'bim3d:comments.notification.replied',
      /** Comment status changed (e.g. Open → Resolved) */
      statusChanged: 'bim3d:comments.notification.statusChanged',
      /** Comment archived (30-day auto or admin manual) */
      archived: 'bim3d:comments.notification.archived',
    },
    animation: {
      /** Render job started (queued → rendering) */
      renderStarted: 'bim3d:animation.notification.renderStarted',
      /** Render finished successfully — MP4 ready for download */
      renderCompleted: 'bim3d:animation.notification.renderCompleted',
      /** Render failed mid-way (encoder error, GPU crash, etc.) */
      renderFailed: 'bim3d:animation.notification.renderFailed',
      /** User cancelled render — checkpoint persisted, can retry */
      renderCancelled: 'bim3d:animation.notification.renderCancelled',
      /** Animation document saved to Firestore */
      saveSuccess: 'bim3d:animation.notification.saveSuccess',
      /** Animation save failed */
      saveError: 'bim3d:animation.notification.saveError',
      /** Export blocked — need ≥2 waypoints */
      exportNeedsTwoWaypoints: 'bim3d:animation.notification.exportNeedsTwoWaypoints',
      /** Export blocked — companyId/projectId unavailable */
      exportContextMissing: 'bim3d:animation.notification.exportContextMissing',
    },
  },

  // ==========================================================================
  // FILES domain
  // ==========================================================================
  files: {
    upload: {
      success: 'files:upload.success',
      fileReady: 'files:upload.toast.uploadSuccess',
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
      movedToTrash: 'files:trash.movedToTrash',
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
