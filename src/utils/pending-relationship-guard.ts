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
let _isSubmitting = false;

export const PendingRelationshipGuard = {
  register(submitFn: PendingSubmitFn): void {
    _pendingSubmit = submitFn;
  },

  unregister(): void {
    _pendingSubmit = null;
    _hasPendingData = false;
    _isSubmitting = false;
  },

  setHasPendingData(hasPending: boolean): void {
    _hasPendingData = hasPending;
  },

  get hasPendingData(): boolean {
    return _hasPendingData;
  },

  /**
   * Auto-submit the pending relationship form.
   * Includes a submission lock to prevent duplicate saves.
   */
  async submitPending(): Promise<boolean> {
    // 🛡️ Prevent double submission
    if (_isSubmitting) {
      logger.warn('Submit already in progress — skipping duplicate call');
      return false;
    }

    if (_hasPendingData && _pendingSubmit) {
      _isSubmitting = true;
      logger.info('Auto-submitting pending relationship...');
      try {
        await _pendingSubmit();
        // Clear immediately to prevent any further auto-submits
        _hasPendingData = false;
        logger.info('Pending relationship auto-submitted successfully');
        return true;
      } catch (error) {
        logger.error('Auto-submit failed:', { error });
        return false;
      } finally {
        _isSubmitting = false;
      }
    }
    return false;
  }
};
