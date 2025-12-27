/**
 * 🧪 UnitTestsTab Component
 *
 * Tab για Unit Tests (Vitest/Jest) και E2E Tests (Playwright)
 */

import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import type { TestState, ApiTestHandlers } from '../types/tests.types';
import { HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface UnitTestsTabProps {
  testState: TestState;
  apiTests: ApiTestHandlers;
}

export const UnitTestsTab: React.FC<UnitTestsTabProps> = ({ testState, apiTests }) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder, quick, radius } = useBorderTokens();
  const colors = useSemanticColors();

  // Enterprise helper για test button states
  const getTestButtonBorder = (testId: string) => {
    if (testState.runningTests.has(testId)) {
      return getStatusBorder('warning'); // Yellow border for running
    }
    if (testState.completedTests.has(testId)) {
      return getStatusBorder('success'); // Green border for completed
    }
    return getStatusBorder('default'); // Gray border for default
  };

  return (
    <>
      <div>
        <h3 className="text-sm font-semibold ${colors.text.muted} uppercase tracking-wide mb-3">
          🧪 Unit Tests (Vitest/Jest)
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Vitest Button */}
          <button
            onClick={apiTests.handleRunVitest}
            disabled={testState.runningTests.has('run-vitest')}
            className={`flex items-start gap-3 p-3.5 ${quick.card} transition-all text-left ${
              testState.runningTests.has('run-vitest')
                ? `${colors.bg.warning} ${colors.bg.warning} ${getTestButtonBorder('run-vitest')} cursor-wait`
                : testState.completedTests.has('run-vitest')
                ? `${colors.bg.success} ${colors.bg.success} ${getTestButtonBorder('run-vitest')} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_SUBTLE}`
                : `${colors.bg.secondary} ${colors.bg.hover} ${getTestButtonBorder('run-vitest')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {testState.runningTests.has('run-vitest') ? (
                <div className="animate-spin text-base">⏳</div>
              ) : testState.completedTests.has('run-vitest') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium ${colors.text.primary} text-sm leading-tight">⚡ Run Vitest Tests</div>
              <div className="text-xs ${colors.text.muted} mt-1">Property-based + ServiceRegistry tests</div>
            </div>
          </button>

          {/* Jest Button */}
          <button
            onClick={apiTests.handleRunJest}
            disabled={testState.runningTests.has('run-jest')}
            className={`flex items-start gap-3 p-3.5 ${quick.card} transition-all text-left ${
              testState.runningTests.has('run-jest')
                ? `${colors.bg.warning} ${colors.bg.warning} ${getTestButtonBorder('run-jest')} cursor-wait`
                : testState.completedTests.has('run-jest')
                ? `${colors.bg.success} ${colors.bg.success} ${getTestButtonBorder('run-jest')} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_SUBTLE}`
                : `${colors.bg.secondary} ${colors.bg.hover} ${getTestButtonBorder('run-jest')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {testState.runningTests.has('run-jest') ? (
                <div className="animate-spin text-base">⏳</div>
              ) : testState.completedTests.has('run-jest') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium ${colors.text.primary} text-sm leading-tight">⚡ Run Jest Tests</div>
              <div className="text-xs ${colors.text.muted} mt-1">Visual regression + cursor alignment tests</div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold ${colors.text.muted} uppercase tracking-wide mb-3">
          🎭 E2E Tests (Playwright)
        </h3>

        <button
          onClick={apiTests.handleRunPlaywright}
          disabled={testState.runningTests.has('run-playwright')}
          className={`flex items-start gap-3 p-3.5 ${radius.lg} transition-all text-left w-full ${
            testState.runningTests.has('run-playwright')
              ? `${colors.bg.warning} ${colors.bg.warning} ${getTestButtonBorder('run-playwright')} cursor-wait`
              : testState.completedTests.has('run-playwright')
              ? `${colors.bg.success} ${colors.bg.success} ${getTestButtonBorder('run-playwright')} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_SUBTLE}`
              : `${colors.bg.secondary} ${colors.bg.hover} ${getTestButtonBorder('run-playwright')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {testState.runningTests.has('run-playwright') ? (
              <div className="animate-spin text-base">⏳</div>
            ) : testState.completedTests.has('run-playwright') ? (
              <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
            ) : (
              <Play className={`${iconSizes.md} ${colors.text.muted}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium ${colors.text.primary} text-sm leading-tight">🎭 Run Playwright Cross-Browser Tests</div>
            <div className="text-xs ${colors.text.muted} mt-1">Visual regression across Chromium/Firefox/WebKit (2-3 min)</div>
          </div>
        </button>
      </div>

      <div className={`${colors.bg.info} ${quick.info} p-4 ${getStatusBorder('info')}`}>
        <div className={`text-xs ${colors.text.info}`}>
          <strong>Note:</strong> Unit & E2E tests run server-side via API endpoints. Check server logs for detailed output.
        </div>
      </div>
    </>
  );
};
