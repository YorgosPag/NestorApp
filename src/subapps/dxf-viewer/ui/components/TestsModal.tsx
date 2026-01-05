'use client';

/**
 * 🧪 TESTS MODAL - Main Container
 *
 * ✅ REFACTORED Phase 1: Custom hooks extracted (state management, drag & drop, test execution)
 * ✅ REFACTORED Phase 2: Tab components extracted (TestTabs, AutomatedTestsTab, UnitTestsTab, StandaloneTestsTab)
 * ✅ REFACTORED Phase 3: Test definitions moved to constants/ (automatedTests.ts, debugTools.ts)
 *
 * 📊 Final Result: 950 lines → ~100 lines (89% reduction!)
 */

import React from 'react';
import { X, FlaskConical, Lightbulb } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

// Custom hooks (extracted)
import { useTestState } from './tests-modal/hooks/useTestState';
import { useDraggableModal } from './tests-modal/hooks/useDraggableModal';
import { useApiTests } from './tests-modal/hooks/useApiTests';
import { useTestExecution } from './tests-modal/hooks/useTestExecution';
import { useStandaloneTests } from './tests-modal/hooks/useStandaloneTests';

// Components (extracted)
import { TestTabs } from './tests-modal/components/TestTabs';
import { AutomatedTestsTab } from './tests-modal/components/AutomatedTestsTab';
import { UnitTestsTab } from './tests-modal/components/UnitTestsTab';
import { StandaloneTestsTab } from './tests-modal/components/StandaloneTestsTab';

// Constants (extracted)
import { getAutomatedTests } from './tests-modal/constants/automatedTests';
import { getDebugTools } from './tests-modal/constants/debugTools';

// Types
import type { TestsModalProps } from './tests-modal/types/tests.types';

export const TestsModal: React.FC<TestsModalProps> = ({
  isOpen,
  onClose,
  showCopyableNotification
}) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // ============================================================================
  // STATE MANAGEMENT (using custom hooks)
  // ============================================================================
  const testState = useTestState();
  const draggable = useDraggableModal(isOpen);
  const { handleRunTest, handleRunAllTests } = useTestExecution(showCopyableNotification, testState);
  const apiTests = useApiTests(showCopyableNotification, testState);
  const standaloneTests = useStandaloneTests(showCopyableNotification, testState);

  if (!isOpen) return null;

  // ============================================================================
  // TEST DEFINITIONS (using factory functions from constants/)
  // ============================================================================
  const runAllTestsGroup = getAutomatedTests(showCopyableNotification);

  const individualToolsGroup = getDebugTools(showCopyableNotification);

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className={`fixed inset-0 ${colors.bg.modalBackdropLight} ${PANEL_LAYOUT.Z_INDEX['50']} ${PANEL_LAYOUT.SPACING.LG}`}>
      <div
        ref={draggable.modalRef}
        className={`absolute ${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col`}
        style={{
          left: `${draggable.position.x}px`,
          top: `${draggable.position.y}px`,
          cursor: draggable.isDragging ? 'grabbing' : 'auto'
        }}
      >
        {/* Header - Draggable */}
        <header
          className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.LG} ${getDirectionalBorder('muted', 'bottom')} ${PANEL_LAYOUT.CURSOR.GRAB} active:${PANEL_LAYOUT.CURSOR.GRABBING}`}
          onMouseDown={draggable.handleMouseDown}
        >
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <FlaskConical className={`${iconSizes.lg} ${colors.text.accent}`} />
            <h2 className={`${PANEL_LAYOUT.TYPOGRAPHY.XL} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${colors.text.primary}`}>DXF Viewer Tests</h2>
            <span className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.text.tertiary} ${PANEL_LAYOUT.MARGIN.LEFT_SM}`}>Drag to move</span>
          </div>
          <button
            onClick={onClose}
            className={`${PANEL_LAYOUT.SPACING.XS} rounded ${PANEL_LAYOUT.TRANSITION.COLORS} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
          >
            <X className={`${iconSizes.lg} ${colors.text.muted}`} />
          </button>
        </header>

        {/* Tabs */}
        <TestTabs
          activeTab={testState.activeTab}
          onTabChange={testState.setActiveTab}
        />

        {/* Content */}
        <div className={`flex-1 ${PANEL_LAYOUT.OVERFLOW.Y_AUTO} ${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.SPACING.GAP_LG}`}>
          {/* TAB 1: Automated Tests */}
          {testState.activeTab === 'automated' && (
            <AutomatedTestsTab
              runAllTestsGroup={runAllTestsGroup}
              individualToolsGroup={individualToolsGroup}
              testState={testState}
              handleRunAllTests={handleRunAllTests}
              handleRunTest={handleRunTest}
            />
          )}

          {/* TAB 2: Unit & E2E Tests */}
          {testState.activeTab === 'unit' && (
            <UnitTestsTab
              testState={testState}
              apiTests={apiTests}
            />
          )}

          {/* TAB 3: Standalone Tests */}
          {testState.activeTab === 'standalone' && (
            <StandaloneTestsTab
              testState={testState}
              standaloneTests={standaloneTests}
            />
          )}
        </div>

        {/* Footer */}
        <footer className={`${PANEL_LAYOUT.SPACING.LG} ${getDirectionalBorder('muted', 'top')} ${colors.bg.muted}`}>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} text-center flex items-center justify-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Lightbulb className={iconSizes.sm} /> Tip: Τα tests εκτελούνται ασύγχρονα. Έλεγξε το console για λεπτομέρειες.
          </p>
        </footer>
      </div>
    </div>
  );
};
