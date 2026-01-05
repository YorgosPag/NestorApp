/**
 * 🧪 UnitTestsTab Component
 *
 * Tab για Unit Tests (Vitest/Jest) και E2E Tests (Playwright)
 */

import React from 'react';
import { Play, CheckCircle2, Loader2, FlaskConical, Zap, Drama } from 'lucide-react';
import type { TestState, ApiTestHandlers } from '../types/tests.types';
import { HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens

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
      {/* ✅ ENTERPRISE: Χρήση semantic <section> αντί κενού <div> (ADR-003) */}
      <section>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.muted} uppercase ${PANEL_LAYOUT.TRACKING.WIDE} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <FlaskConical className={iconSizes.sm} /> Unit Tests (Vitest/Jest)
        </h3>

        <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.MD}`}>
          {/* Vitest Button */}
          <button
            onClick={apiTests.handleRunVitest}
            disabled={testState.runningTests.has('run-vitest')}
            className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${quick.card} ${PANEL_LAYOUT.TRANSITION.ALL} text-left ${
              testState.runningTests.has('run-vitest')
                ? `${colors.bg.warning} ${colors.bg.warning} ${getTestButtonBorder('run-vitest')} ${PANEL_LAYOUT.CURSOR.WAIT}`
                : testState.completedTests.has('run-vitest')
                ? `${colors.bg.success} ${colors.bg.success} ${getTestButtonBorder('run-vitest')} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_SUBTLE}`
                : `${colors.bg.secondary} ${colors.bg.hover} ${getTestButtonBorder('run-vitest')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <div className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
              {testState.runningTests.has('run-vitest') ? (
                <Loader2 className={`${iconSizes.md} ${colors.text.warning} ${PANEL_LAYOUT.ANIMATE.SPIN}`} />
              ) : testState.completedTests.has('run-vitest') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className={PANEL_LAYOUT.FLEX_UTILS.FLEX_1_MIN_0}>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.LEADING.TIGHT} flex items-center ${PANEL_LAYOUT.GAP.XS}`}><Zap className={iconSizes.sm} /> Run Vitest Tests</div>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Property-based + ServiceRegistry tests</div>
            </div>
          </button>

          {/* Jest Button */}
          <button
            onClick={apiTests.handleRunJest}
            disabled={testState.runningTests.has('run-jest')}
            className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${quick.card} ${PANEL_LAYOUT.TRANSITION.ALL} text-left ${
              testState.runningTests.has('run-jest')
                ? `${colors.bg.warning} ${colors.bg.warning} ${getTestButtonBorder('run-jest')} ${PANEL_LAYOUT.CURSOR.WAIT}`
                : testState.completedTests.has('run-jest')
                ? `${colors.bg.success} ${colors.bg.success} ${getTestButtonBorder('run-jest')} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_SUBTLE}`
                : `${colors.bg.secondary} ${colors.bg.hover} ${getTestButtonBorder('run-jest')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
            }`}
          >
            <div className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
              {testState.runningTests.has('run-jest') ? (
                <Loader2 className={`${iconSizes.md} ${colors.text.warning} ${PANEL_LAYOUT.ANIMATE.SPIN}`} />
              ) : testState.completedTests.has('run-jest') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className={PANEL_LAYOUT.FLEX_UTILS.FLEX_1_MIN_0}>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.LEADING.TIGHT} flex items-center ${PANEL_LAYOUT.GAP.XS}`}><Zap className={iconSizes.sm} /> Run Jest Tests</div>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Visual regression + cursor alignment tests</div>
            </div>
          </button>
        </div>
      </section>

      {/* ✅ ENTERPRISE: Χρήση semantic <section> αντί κενού <div> (ADR-003) */}
      <section>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.muted} uppercase ${PANEL_LAYOUT.TRACKING.WIDE} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <Drama className={iconSizes.sm} /> E2E Tests (Playwright)
        </h3>

        <button
          onClick={apiTests.handleRunPlaywright}
          disabled={testState.runningTests.has('run-playwright')}
          className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${radius.lg} ${PANEL_LAYOUT.TRANSITION.ALL} text-left w-full ${
            testState.runningTests.has('run-playwright')
              ? `${colors.bg.warning} ${colors.bg.warning} ${getTestButtonBorder('run-playwright')} ${PANEL_LAYOUT.CURSOR.WAIT}`
              : testState.completedTests.has('run-playwright')
              ? `${colors.bg.success} ${colors.bg.success} ${getTestButtonBorder('run-playwright')} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_SUBTLE}`
              : `${colors.bg.secondary} ${colors.bg.hover} ${getTestButtonBorder('run-playwright')} ${HOVER_BACKGROUND_EFFECTS.MUTED_DARK} ${HOVER_BORDER_EFFECTS.MUTED}`
          }`}
        >
          <div className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
            {testState.runningTests.has('run-playwright') ? (
              <Loader2 className={`${iconSizes.md} ${colors.text.warning} ${PANEL_LAYOUT.ANIMATE.SPIN}`} />
            ) : testState.completedTests.has('run-playwright') ? (
              <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
            ) : (
              <Play className={`${iconSizes.md} ${colors.text.muted}`} />
            )}
          </div>
          <div className={PANEL_LAYOUT.FLEX_UTILS.FLEX_1_MIN_0}>
            <div className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.LEADING.TIGHT} flex items-center ${PANEL_LAYOUT.GAP.XS}`}><Drama className={iconSizes.sm} /> Run Playwright Cross-Browser Tests</div>
            <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Visual regression across Chromium/Firefox/WebKit (2-3 min)</div>
          </div>
        </button>
      </section>

      {/* ✅ ENTERPRISE: Χρήση semantic <aside> για info box (ADR-003) */}
      <aside className={`${colors.bg.info} ${quick.info} ${PANEL_LAYOUT.SPACING.LG} ${getStatusBorder('info')}`}>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.info}`}>
          <strong>Note:</strong> Unit & E2E tests run server-side via API endpoints. Check server logs for detailed output.
        </p>
      </aside>
    </>
  );
};
