/**
 * 🔘 TestButton Component
 *
 * Reusable test button με status indicators (running, completed, idle)
 */

import React from 'react';
import { Play, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

interface TestButtonProps {
  test: {
    id: string;
    name: string;
    description: string;
    action: () => Promise<void>;
    /** 🏢 ENTERPRISE: Lucide icon component for the test */
    icon?: LucideIcon;
  };
  isRunning: boolean;
  isCompleted: boolean;
  onRun: (testId: string, action: () => Promise<void>) => void;
}

export const TestButton: React.FC<TestButtonProps> = ({
  test,
  isRunning,
  isCompleted,
  onRun
}) => {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <button
      onClick={() => onRun(test.id, test.action)}
      disabled={isRunning}
      className={`flex items-start ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} rounded-lg border ${PANEL_LAYOUT.TRANSITION.ALL} text-left w-full ${
        isRunning
          ? `${colors.bg.warning} ${useBorderTokens().getStatusBorder('warning')} ${PANEL_LAYOUT.CURSOR.WAIT}`
          : isCompleted
          ? `${colors.bg.success} ${useBorderTokens().getStatusBorder('success')} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`
          : `${colors.bg.hover} ${getStatusBorder('muted')} ${HOVER_BORDER_EFFECTS.GRAY} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
      }`}
    >
      <div className={`flex-shrink-0 ${PANEL_LAYOUT.MARGIN.TOP_HALF}`}>
        {isRunning ? (
          <Loader2 className={`${iconSizes.md} ${colors.text.warning} animate-spin`} />
        ) : isCompleted ? (
          <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
        ) : test.icon ? (
          <test.icon className={`${iconSizes.md} ${colors.text.muted}`} />
        ) : (
          <Play className={`${iconSizes.md} ${colors.text.muted}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} leading-tight`}>{test.name}</div>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS} line-clamp-2`}>{test.description}</div>
      </div>
    </button>
  );
};
