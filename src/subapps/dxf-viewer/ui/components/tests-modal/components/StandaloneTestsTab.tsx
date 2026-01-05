/**
 * 📊 StandaloneTestsTab Component
 *
 * Tab για standalone test scripts (coordinate reversibility, grid workflow)
 */

import React from 'react';
import { Play, CheckCircle2, Loader2, BarChart3, RefreshCw, Triangle, AlertTriangle } from 'lucide-react';
import type { TestState, StandaloneTestHandlers } from '../types/tests.types';
import { HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens

interface StandaloneTestsTabProps {
  testState: TestState;
  standaloneTests: StandaloneTestHandlers;
}

export const StandaloneTestsTab: React.FC<StandaloneTestsTabProps> = ({
  testState,
  standaloneTests
}) => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <>
      {/* ✅ ENTERPRISE: Χρήση semantic <section> αντί κενού <div> (ADR-003) */}
      <section>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.muted} uppercase ${PANEL_LAYOUT.TRACKING.WIDE} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <BarChart3 className={iconSizes.sm} /> Standalone Test Scripts
        </h3>

        <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.MD}`}>
          {/* Coordinate Reversibility */}
          <button
            onClick={standaloneTests.handleRunCoordinateReversibility}
            disabled={testState.runningTests.has('coordinate-reversibility')}
            className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${quick.card} ${PANEL_LAYOUT.TRANSITION.ALL} text-left ${
              testState.runningTests.has('coordinate-reversibility')
                ? `${colors.bg.warning} ${PANEL_LAYOUT.CURSOR.WAIT}`
                : testState.completedTests.has('coordinate-reversibility')
                ? `${colors.bg.success} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_HOVER}`
                : `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON} ${HOVER_BORDER_EFFECTS.GRAY}`
            }`}
          >
            <div className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
              {testState.runningTests.has('coordinate-reversibility') ? (
                <Loader2 className={`${iconSizes.md} ${colors.text.warning} ${PANEL_LAYOUT.ANIMATE.SPIN}`} />
              ) : testState.completedTests.has('coordinate-reversibility') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className={PANEL_LAYOUT.FLEX_UTILS.FLEX_1_MIN_0}>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.LEADING.TIGHT} flex items-center ${PANEL_LAYOUT.GAP.XS}`}><RefreshCw className={iconSizes.sm} /> Coordinate Reversibility</div>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Tests screenToWorld(worldToScreen(p)) == p</div>
            </div>
          </button>

          {/* Grid Workflow */}
          <button
            onClick={standaloneTests.handleRunGridWorkflow}
            disabled={testState.runningTests.has('grid-workflow')}
            className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${quick.card} ${PANEL_LAYOUT.TRANSITION.ALL} text-left ${
              testState.runningTests.has('grid-workflow')
                ? `${colors.bg.warning} ${PANEL_LAYOUT.CURSOR.WAIT}`
                : testState.completedTests.has('grid-workflow')
                ? `${colors.bg.success} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_HOVER}`
                : `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON} ${HOVER_BORDER_EFFECTS.GRAY}`
            }`}
          >
            <div className={`${PANEL_LAYOUT.FLEX_SHRINK.NONE} ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
              {testState.runningTests.has('grid-workflow') ? (
                <Loader2 className={`${iconSizes.md} ${colors.text.warning} ${PANEL_LAYOUT.ANIMATE.SPIN}`} />
              ) : testState.completedTests.has('grid-workflow') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className={PANEL_LAYOUT.FLEX_UTILS.FLEX_1_MIN_0}>
              <div className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.LEADING.TIGHT} flex items-center ${PANEL_LAYOUT.GAP.XS}`}><Triangle className={iconSizes.sm} /> Grid Workflow Test</div>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>CAD QA standards (5 categories)</div>
            </div>
          </button>
        </div>
      </section>

      {/* ✅ ENTERPRISE: Χρήση semantic <aside> για info box (ADR-003) */}
      <aside className={`${colors.bg.warning} ${quick.info} ${PANEL_LAYOUT.SPACING.LG}`}>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.warning} flex items-start ${PANEL_LAYOUT.GAP.SM}`}>
          <AlertTriangle className={`${iconSizes.sm} ${PANEL_LAYOUT.FLEX_SHRINK.NONE} mt-0.5`} />
          <span><strong>Work in Progress:</strong> Some standalone tests need refactoring to export runnable functions. Check console for status.</span>
        </p>
      </aside>
    </>
  );
};
