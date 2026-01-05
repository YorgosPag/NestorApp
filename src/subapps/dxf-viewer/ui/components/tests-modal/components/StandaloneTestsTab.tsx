/**
 * 📊 StandaloneTestsTab Component
 *
 * Tab για standalone test scripts (coordinate reversibility, grid workflow)
 */

import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
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
        <h3 className={`text-sm font-semibold ${colors.text.muted} uppercase tracking-wide ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>
          📊 Standalone Test Scripts
        </h3>

        <div className={`grid grid-cols-2 ${PANEL_LAYOUT.GAP.MD}`}>
          {/* Coordinate Reversibility */}
          <button
            onClick={standaloneTests.handleRunCoordinateReversibility}
            disabled={testState.runningTests.has('coordinate-reversibility')}
            className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${quick.card} transition-all text-left ${
              testState.runningTests.has('coordinate-reversibility')
                ? `${colors.bg.warning} cursor-wait`
                : testState.completedTests.has('coordinate-reversibility')
                ? `${colors.bg.success} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_HOVER}`
                : `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON} ${HOVER_BORDER_EFFECTS.GRAY}`
            }`}
          >
            <div className={`flex-shrink-0 ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
              {testState.runningTests.has('coordinate-reversibility') ? (
                <div className="animate-spin text-base">⏳</div>
              ) : testState.completedTests.has('coordinate-reversibility') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-medium ${colors.text.primary} text-sm leading-tight`}>🔄 Coordinate Reversibility</div>
              <div className={`text-xs ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>Tests screenToWorld(worldToScreen(p)) == p</div>
            </div>
          </button>

          {/* Grid Workflow */}
          <button
            onClick={standaloneTests.handleRunGridWorkflow}
            disabled={testState.runningTests.has('grid-workflow')}
            className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${quick.card} transition-all text-left ${
              testState.runningTests.has('grid-workflow')
                ? `${colors.bg.warning} cursor-wait`
                : testState.completedTests.has('grid-workflow')
                ? `${colors.bg.success} ${HOVER_BACKGROUND_EFFECTS.SUCCESS_HOVER}`
                : `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON} ${HOVER_BORDER_EFFECTS.GRAY}`
            }`}
          >
            <div className={`flex-shrink-0 ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
              {testState.runningTests.has('grid-workflow') ? (
                <div className="animate-spin text-base">⏳</div>
              ) : testState.completedTests.has('grid-workflow') ? (
                <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
              ) : (
                <Play className={`${iconSizes.md} ${colors.text.muted}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-medium ${colors.text.primary} text-sm leading-tight`}>📐 Grid Workflow Test</div>
              <div className={`text-xs ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>CAD QA standards (5 categories)</div>
            </div>
          </button>
        </div>
      </section>

      {/* ✅ ENTERPRISE: Χρήση semantic <aside> για info box (ADR-003) */}
      <aside className={`${colors.bg.warning} ${quick.info} ${PANEL_LAYOUT.SPACING.LG}`}>
        <p className={`text-xs ${colors.text.warning}`}>
          <strong>⚠️ Work in Progress:</strong> Some standalone tests need refactoring to export runnable functions. Check console for status.
        </p>
      </aside>
    </>
  );
};
