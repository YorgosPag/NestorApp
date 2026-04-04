/**
 * 🏢 Guard Confirm/Cancel Handler Factory
 *
 * Creates confirm/cancel handlers for deferred-submission guard dialogs.
 * Eliminates boilerplate — all 4 guards (name cascade, address impact,
 * company identity, communication impact) use the same pattern.
 *
 * @module utils/contactForm/guard-confirm-factory
 * @enterprise ADR-278 — DRY guard handlers
 */

import type React from 'react';
import { getErrorMessage } from '@/lib/error-utils';

// ============================================================================
// TYPES
// ============================================================================

interface GuardHandlerDeps {
  setDialogState: (state: null) => void;
  deferredSubmitRef: React.MutableRefObject<(() => Promise<void>) | null>;
  confirmedRef: React.MutableRefObject<boolean>;
  setLoading: (loading: boolean) => void;
  onContactAdded: () => void;
  notifyError: (message: string) => void;
}

export interface GuardHandlers {
  confirm: () => Promise<void>;
  cancel: () => void;
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create confirm/cancel handlers for a guard dialog.
 * All guards follow the same deferred-submission pattern.
 */
export function createGuardHandlers(deps: GuardHandlerDeps): GuardHandlers {
  return {
    confirm: async () => {
      deps.setDialogState(null);
      deps.setLoading(true);
      try {
        if (deps.deferredSubmitRef.current) {
          await deps.deferredSubmitRef.current();
          deps.deferredSubmitRef.current = null;
          deps.onContactAdded();
        }
      } catch (error) {
        deps.notifyError(getErrorMessage(error, 'contacts-form.submission.updateError'));
      } finally {
        deps.setLoading(false);
      }
    },
    cancel: () => {
      deps.setDialogState(null);
      deps.deferredSubmitRef.current = null;
      deps.confirmedRef.current = false;
    },
  };
}
