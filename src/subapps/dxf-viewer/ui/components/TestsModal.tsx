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
        className="absolute bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        style={{
          left: `${draggable.position.x}px`,
          top: `${draggable.position.y}px`,
          cursor: draggable.isDragging ? 'grabbing' : 'auto'
        }}
      >
        {/* Header - Draggable */}
        <div
          className="flex items-center justify-between p-4 border-b border-gray-700 cursor-grab active:cursor-grabbing"
          onMouseDown={draggable.handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">DXF Viewer Tests</h2>
            <span className="text-xs text-gray-500 ml-2">↔️ Drag to move</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
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
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <div className="text-xs text-gray-400 text-center">
            💡 Tip: Τα tests εκτελούνται ασύγχρονα. Έλεγξε το console για λεπτομέρειες.
          </div>
        </div>
      </div>
    </div>
  );
};
