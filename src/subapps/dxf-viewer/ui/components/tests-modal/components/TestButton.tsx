/**
 * 🔘 TestButton Component
 *
 * Reusable test button με status indicators (running, completed, idle)
 */

import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface TestButtonProps {
  test: {
    id: string;
    name: string;
    description: string;
    action: () => Promise<void>;
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
      className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all text-left w-full ${
        isRunning
          ? `${colors.bg.warning} ${useBorderTokens().getStatusBorder('warning')} cursor-wait`
          : isCompleted
          ? `${colors.bg.success} ${useBorderTokens().getStatusBorder('success')} ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`
          : `${colors.bg.hover} ${getStatusBorder('muted')} ${HOVER_BORDER_EFFECTS.GRAY} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isRunning ? (
          <div className="animate-spin text-base">⏳</div>
        ) : isCompleted ? (
          <CheckCircle2 className={`${iconSizes.md} ${colors.text.success}`} />
        ) : (
          <Play className={`${iconSizes.md} ${colors.text.muted}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${colors.text.primary} text-sm leading-tight`}>{test.name}</div>
        <div className={`text-xs ${colors.text.muted} mt-1 line-clamp-2`}>{test.description}</div>
      </div>
    </button>
  );
};
