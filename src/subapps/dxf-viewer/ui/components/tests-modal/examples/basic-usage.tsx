/**
 * Basic Usage Example - TestsModal
 *
 * This example demonstrates the simplest way to integrate TestsModal
 * into your React application.
 *
 * Perfect for: Quick integration, minimal setup, getting started
 */

import React, { useState } from 'react';
import { TestsModal } from '../../TestsModal';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens'; // 🏢 ENTERPRISE: Centralized typography tokens

export function BasicUsageExample() {
  // 1. State to control modal visibility
  const [isTestsOpen, setIsTestsOpen] = useState(false);
  const colors = useSemanticColors();

  // 2. Notification handler (simple console.log version)
  const showNotification = (message: string, type?: 'success' | 'info' | 'warning' | 'error') => {
    console.log(`[${type || 'info'}] ${message}`);
  };

  // 3. Render UI
  return (
    <div className="p-4">
      <h1 className={`${PANEL_LAYOUT.TYPOGRAPHY['2XL']} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>DXF Viewer App</h1>

      {/* Button to open tests modal */}
      <button
        onClick={() => setIsTestsOpen(true)}
        className={`px-4 py-2 ${colors.bg.purpleButton} ${colors.text.WHITE} rounded-lg ${PANEL_LAYOUT.TRANSITION.COLORS} ${HOVER_BACKGROUND_EFFECTS.PURPLE_BUTTON}`}
      >
        🧪 Run Tests
      </button>

      {/* Tests Modal */}
      <TestsModal
        isOpen={isTestsOpen}
        onClose={() => setIsTestsOpen(false)}
        showCopyableNotification={showNotification}
      />
    </div>
  );
}

/**
 * Expected Behavior:
 *
 * 1. User clicks "🧪 Run Tests" button
 * 2. Modal opens in the center of the screen
 * 3. User can:
 *    - Switch between tabs (Automated, Unit & E2E, Standalone)
 *    - Run individual tests
 *    - Run all tests at once
 *    - Drag modal to reposition
 * 4. Notifications appear in console
 * 5. User clicks X to close modal
 */

/**
 * Minimal Props Explained:
 *
 * @prop isOpen - boolean
 *   Controls modal visibility
 *   true = modal visible, false = modal hidden
 *
 * @prop onClose - () => void
 *   Callback when user clicks X button
 *   Usually: setIsTestsOpen(false)
 *
 * @prop showCopyableNotification - (message: string, type?: string) => void
 *   Notification handler for test results
 *   Can be: console.log, toast library, custom notification system
 */

/**
 * Integration Steps:
 *
 * Step 1: Import TestsModal
 *   import { TestsModal } from './components/tests-modal/TestsModal';
 *
 * Step 2: Add state
 *   const [isTestsOpen, setIsTestsOpen] = useState(false);
 *
 * Step 3: Add notification handler
 *   const showNotification = (msg, type) => console.log(`[${type}] ${msg}`);
 *
 * Step 4: Render modal
 *   <TestsModal isOpen={isTestsOpen} onClose={...} showCopyableNotification={...} />
 *
 * Done! ✅
 */

/**
 * Troubleshooting:
 *
 * Q: Modal doesn't open?
 * A: Check that isOpen state is true. Add console.log(isTestsOpen) before <TestsModal>
 *
 * Q: Notifications don't appear?
 * A: Check that showCopyableNotification is called. Add console.log inside the function.
 *
 * Q: TypeScript errors?
 * A: Ensure you have the correct types:
 *    type NotificationFn = (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
 */
