// ============================================================================
// PENDING RELATIONSHIP GUARD
// ============================================================================
//
// 🏢 ENTERPRISE: Module-level registry for unsaved relationship form data
// Solves UX issue: user fills relationship form but clicks main "Save" without
// clicking "Add" inside the relationship form → data is lost.
//
// Pattern: Service Locator (module singleton)
// Used by: ContactRelationshipManager (registers), ContactDetails (triggers)
//
// ============================================================================

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('PendingRelationshipGuard');

type PendingSubmitFn = () => Promise<void>;

/** Module-level singleton state */
let _pendingSubmit: PendingSubmitFn | null = null;
let _hasPendingData = false;

/**
 * 🛡️ PendingRelationshipGuard
 *
 * Tracks whether the relationship form has unsaved data and provides
 * a mechanism to auto-submit it when the parent contact is saved.
 *
 * Flow:
 * 1. ContactRelationshipManager registers its handleSubmit callback
 * 2. RelationshipForm marks dirty state when targetContactId is set
 * 3. ContactDetails.handleSaveEdit calls submitPending() before saving
 * 4. If pending data exists → auto-submits → then saves contact
 */
export const PendingRelationshipGuard = {
  /**
   * Register the submit callback (called by ContactRelationshipManager)
   */
  register(submitFn: PendingSubmitFn): void {
    _pendingSubmit = submitFn;
  },

  /**
   * Unregister (called on unmount)
   */
  unregister(): void {
    _pendingSubmit = null;
    _hasPendingData = false;
  },

  /**
   * Mark form as having unsaved data
   */
  setHasPendingData(hasPending: boolean): void {
    _hasPendingData = hasPending;
  },

  /**
   * Check if there's unsaved relationship data
   */
  get hasPendingData(): boolean {
    return _hasPendingData;
  },

  /**
   * Auto-submit the pending relationship form
   * Returns true if a relationship was submitted, false otherwise
   */
  async submitPending(): Promise<boolean> {
    if (_hasPendingData && _pendingSubmit) {
      logger.info('Auto-submitting pending relationship...');
      try {
        await _pendingSubmit();
        _hasPendingData = false;
        logger.info('Pending relationship auto-submitted successfully');
        return true;
      } catch (error) {
        logger.error('Auto-submit failed:', { error });
        // Don't block the main save — the user will see the error in the form
        return false;
      }
    }
    return false;
  }
};
