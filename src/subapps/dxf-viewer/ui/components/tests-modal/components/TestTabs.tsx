/**
 * 🗂️ TestTabs Component
 *
 * Tab navigation για το TestsModal (Automated, Unit & E2E, Standalone)
 */

import React from 'react';
import type { TabType } from '../types/tests.types';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface TestTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const TestTabs: React.FC<TestTabsProps> = ({ activeTab, onTabChange }) => {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <nav className={`flex ${getDirectionalBorder('muted', 'bottom')} ${PANEL_LAYOUT.SPACING.HORIZONTAL_LG}`}>
      <button
        onClick={() => onTabChange('automated')}
        className={`${PANEL_LAYOUT.BUTTON.PADDING} text-sm font-medium transition-colors relative ${
          activeTab === 'automated'
            ? `${colors.text.accent} ${getDirectionalBorder('info', 'bottom')}`
            : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.BLUE_LIGHT}`
        }`}
      >
        📋 Automated Tests
      </button>
      <button
        onClick={() => onTabChange('unit')}
        className={`${PANEL_LAYOUT.BUTTON.PADDING} text-sm font-medium transition-colors relative ${
          activeTab === 'unit'
            ? `${colors.text.accent} ${getDirectionalBorder('info', 'bottom')}`
            : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.BLUE_LIGHT}`
        }`}
      >
        🧪 Unit & E2E Tests
      </button>
      <button
        onClick={() => onTabChange('standalone')}
        className={`${PANEL_LAYOUT.BUTTON.PADDING} text-sm font-medium transition-colors relative ${
          activeTab === 'standalone'
            ? `${colors.text.accent} ${getDirectionalBorder('info', 'bottom')}`
            : `${colors.text.muted} ${HOVER_TEXT_EFFECTS.BLUE_LIGHT}`
        }`}
      >
        📊 Standalone Tests
      </button>
    </nav>
  );
};
