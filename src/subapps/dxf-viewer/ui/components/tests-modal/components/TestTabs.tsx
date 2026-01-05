/**
 * 🗂️ TestTabs Component
 *
 * Tab navigation για το TestsModal (Automated, Unit & E2E, Standalone)
 */

import React from 'react';
import type { TabType } from '../types/tests.types';
import { ClipboardList, FlaskConical, BarChart3 } from 'lucide-react';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface TestTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TestTabs: React.FC<TestTabsProps> = ({ activeTab, onTabChange }) => {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  return (
    <nav className={`flex ${getDirectionalBorder('muted', 'bottom')} ${PANEL_LAYOUT.SPACING.HORIZONTAL_LG}`}>
      <button
        onClick={() => onTabChange('automated')}
        className={`${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TRANSITION.COLORS} relative ${
          activeTab === 'automated'
            ? `${colors.text.accent} ${getDirectionalBorder('info', 'bottom')}`
            : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.BLUE_LIGHT}`
        }`}
      >
        <ClipboardList className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_XS}`} />
        Automated Tests
      </button>
      <button
        onClick={() => onTabChange('unit')}
        className={`${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TRANSITION.COLORS} relative ${
          activeTab === 'unit'
            ? `${colors.text.accent} ${getDirectionalBorder('info', 'bottom')}`
            : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.BLUE_LIGHT}`
        }`}
      >
        <FlaskConical className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_XS}`} />
        Unit & E2E Tests
      </button>
      <button
        onClick={() => onTabChange('standalone')}
        className={`${PANEL_LAYOUT.BUTTON.PADDING} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.TRANSITION.COLORS} relative ${
          activeTab === 'standalone'
            ? `${colors.text.accent} ${getDirectionalBorder('info', 'bottom')}`
            : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.BLUE_LIGHT}`
        }`}
      >
        <BarChart3 className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_XS}`} />
        Standalone Tests
      </button>
    </nav>
  );
};
