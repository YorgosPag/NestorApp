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
import { X, FlaskConical } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

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
    <div className="fixed inset-0 bg-black/30 z-50 p-4">
      <div
        ref={draggable.modalRef}
        className={`absolute ${colors.bg.secondary} rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col`}
        style={{
          left: `${draggable.position.x}px`,
          top: `${draggable.position.y}px`,
          cursor: draggable.isDragging ? 'grabbing' : 'auto'
        }}
      >
        {/* Header - Draggable */}
        <div
          className={`flex items-center justify-between p-4 ${getDirectionalBorder('muted', 'bottom')} cursor-grab active:cursor-grabbing`}
          onMouseDown={draggable.handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className={`${iconSizes.lg} ${colors.text.accent}`} />
            <h2 className={`text-xl font-bold ${colors.text.primary}`}>DXF Viewer Tests</h2>
            <span className={`text-xs ${colors.text.tertiary} ml-2`}>↔️ Drag to move</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${HOVER_BACKGROUND_EFFECTS.LIGHT}`}
          >
            <X className={`${iconSizes.lg} ${colors.text.muted}`} />
          </button>
        </div>

        {/* Tabs */}
        <TestTabs
          activeTab={testState.activeTab}
          onTabChange={testState.setActiveTab}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        <div className={`p-4 ${getDirectionalBorder('muted', 'top')} ${colors.bg.muted}`}>
          <div className={`text-xs ${colors.text.muted} text-center`}>
            💡 Tip: Τα tests εκτελούνται ασύγχρονα. Έλεγξε το console για λεπτομέρειες.
          </div>
        </div>
      </div>
    </div>
  );
};
