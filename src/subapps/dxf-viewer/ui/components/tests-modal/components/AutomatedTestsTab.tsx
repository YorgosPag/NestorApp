/**
 * 📋 AutomatedTestsTab Component
 *
 * Tab για automated tests και debug tools
 */

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { TestButton } from './TestButton';
import type { TestDefinition, TestState } from '../types/tests.types';
import { HOVER_BACKGROUND_EFFECTS, GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface AutomatedTestsTabProps {
  runAllTestsGroup: TestDefinition[];
  individualToolsGroup: TestDefinition[];
  testState: TestState;
  handleRunAllTests: () => Promise<void>;
  handleRunTest: (testId: string, testFunction: () => Promise<void>) => Promise<void>;
}

export const AutomatedTestsTab: React.FC<AutomatedTestsTabProps> = ({
  runAllTestsGroup,
  individualToolsGroup,
  testState,
  handleRunAllTests,
  handleRunTest
}) => {
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  return (
    <>
      {/* ✅ ENTERPRISE: Αφαίρεση περιττού κενού wrapper (ADR-003 Container Nesting) */}
      <section>
        <h3 className={`text-sm font-semibold ${colors.text.muted} uppercase tracking-wide ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>
          📋 Automated Test Suite
        </h3>

        {/* Run All Tests Button */}
        <button
          onClick={handleRunAllTests}
          disabled={testState.runningTests.has('run-all-tests')}
          className={`w-full ${PANEL_LAYOUT.SPACING.LG} text-lg font-bold rounded-lg shadow-lg transition-all ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} ${
            testState.runningTests.has('run-all-tests')
              ? `${colors.bg.warning} ${colors.text.inverted} cursor-wait animate-pulse`
              : testState.completedTests.has('run-all-tests')
              ? `${colors.bg.success} ${colors.text.inverted} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_BUTTON}`
              : `bg-gradient-to-r from-purple-600 to-pink-600 ${colors.text.inverted} ${GRADIENT_HOVER_EFFECTS.PURPLE_PINK_BUTTON}`
          }`}
        >
          {testState.runningTests.has('run-all-tests') ? (
            <span className={`flex items-center justify-center ${PANEL_LAYOUT.GAP.SM}`}>
              <span className="animate-spin">⏳</span>
              Running All Automated Tests...
            </span>
          ) : testState.completedTests.has('run-all-tests') ? (
            <span className={`flex items-center justify-center ${PANEL_LAYOUT.GAP.SM}`}>
              <CheckCircle2 className={iconSizes.lg} />
              All Automated Tests Complete!
            </span>
          ) : (
            <span className={`flex items-center justify-center ${PANEL_LAYOUT.GAP.SM}`}>
              🧪 Run All Automated Tests ({runAllTestsGroup.length} Tests)
            </span>
          )}
        </button>

        {/* Individual Test Buttons */}
        <div className={`grid grid-cols-2 ${PANEL_LAYOUT.GAP.MD}`}>
          {runAllTestsGroup.map(test => (
            <TestButton
              key={test.id}
              test={test}
              isRunning={testState.runningTests.has(test.id)}
              isCompleted={testState.completedTests.has(test.id)}
              onRun={handleRunTest}
            />
          ))}
        </div>
      </section>

      {/* Group 2: Individual Debug Tools */}
      {/* ✅ ENTERPRISE: Χρήση semantic <section> αντί κενού <div> (ADR-003) */}
      <section>
        <h3 className={`text-sm font-semibold ${colors.text.muted} uppercase tracking-wide ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>
          🛠️ Individual Debug Tools (Manual)
        </h3>
        <div className={`grid grid-cols-2 ${PANEL_LAYOUT.GAP.MD}`}>
          {individualToolsGroup.map(test => (
            <TestButton
              key={test.id}
              test={test}
              isRunning={testState.runningTests.has(test.id)}
              isCompleted={testState.completedTests.has(test.id)}
              onRun={handleRunTest}
            />
          ))}
        </div>
      </section>
    </>
  );
};
