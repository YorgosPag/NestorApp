/**
 * =============================================================================
 * 🏢 ENTERPRISE: Error Dialog Tour Configuration
 * =============================================================================
 *
 * @enterprise SAP/Microsoft/Salesforce Pattern - Guided User Onboarding
 *
 * This file defines the tour configuration for the Error Dialog.
 * The tour guides users through the 7 action buttons available when an error occurs.
 *
 * @see ProductTour.types.ts for type definitions
 */

import { createTourConfig, createButtonStep } from '@/components/ui/ProductTour';
import type { TourConfig } from '@/components/ui/ProductTour';

/**
 * 🏢 ENTERPRISE: Tour configuration for the Error Dialog
 *
 * Steps:
 * 1. Intro - Overview of error handling options
 * 2. Retry button
 * 3. Back button
 * 4. Home button
 * 5. Copy Details button
 * 6. Email button
 * 7. Notify Admin button
 * 8. Anonymous Report button
 */
export const ERROR_DIALOG_TOUR_ID = 'error-dialog-tour';
export const ERROR_DIALOG_TOUR_PERSISTENCE_KEY = 'error-dialog-tour-v1';

/**
 * IDs for the error dialog buttons (must match the actual button IDs in ErrorBoundary)
 */
export const ERROR_DIALOG_BUTTON_IDS = {
  retry: 'error-dialog-retry-btn',
  back: 'error-dialog-back-btn',
  home: 'error-dialog-home-btn',
  copy: 'error-dialog-copy-btn',
  email: 'error-dialog-email-btn',
  notify: 'error-dialog-notify-btn',
  report: 'error-dialog-report-btn',
  helpButton: 'error-dialog-help-btn',
} as const;

/**
 * Create the error dialog tour configuration
 */
export function createErrorDialogTourConfig(
  options?: {
    onComplete?: () => void;
    onSkip?: () => void;
  }
): TourConfig {
  return createTourConfig({
    tourId: ERROR_DIALOG_TOUR_ID,
    persistenceKey: ERROR_DIALOG_TOUR_PERSISTENCE_KEY,
    showDontShowAgain: true,
    showStepIndicators: true,
    showSkipButton: true,

    steps: [
      // Step 1: Retry button
      createButtonStep(
        'retry',
        ERROR_DIALOG_BUTTON_IDS.retry,
        'productTour.errorDialog.retry.title',
        'productTour.errorDialog.retry.description',
        'bottom'
      ),

      // Step 2: Back button
      createButtonStep(
        'back',
        ERROR_DIALOG_BUTTON_IDS.back,
        'productTour.errorDialog.back.title',
        'productTour.errorDialog.back.description',
        'bottom'
      ),

      // Step 3: Home button
      createButtonStep(
        'home',
        ERROR_DIALOG_BUTTON_IDS.home,
        'productTour.errorDialog.home.title',
        'productTour.errorDialog.home.description',
        'bottom'
      ),

      // Step 4: Copy Details button
      createButtonStep(
        'copy',
        ERROR_DIALOG_BUTTON_IDS.copy,
        'productTour.errorDialog.copy.title',
        'productTour.errorDialog.copy.description',
        'top'
      ),

      // Step 5: Email button
      createButtonStep(
        'email',
        ERROR_DIALOG_BUTTON_IDS.email,
        'productTour.errorDialog.email.title',
        'productTour.errorDialog.email.description',
        'top'
      ),

      // Step 6: Notify Admin button
      createButtonStep(
        'notify',
        ERROR_DIALOG_BUTTON_IDS.notify,
        'productTour.errorDialog.notify.title',
        'productTour.errorDialog.notify.description',
        'top'
      ),

      // Step 7: Anonymous Report button
      createButtonStep(
        'report',
        ERROR_DIALOG_BUTTON_IDS.report,
        'productTour.errorDialog.report.title',
        'productTour.errorDialog.report.description',
        'top'
      ),
    ],

    onComplete: options?.onComplete,
    onSkip: options?.onSkip,
  });
}

/**
 * Default tour config for immediate use
 */
export const errorDialogTourConfig = createErrorDialogTourConfig();
