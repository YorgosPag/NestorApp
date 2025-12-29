/**
 * Shared selection button component
 * Eliminates duplicate button styling and structure
 */
import React from 'react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface SelectionButtonProps {
  onClick: () => void;
  icon: React.ReactElement | string;
  title: string;
  subtitle?: string;
  extraInfo?: string;
}

export function SelectionButton({
  onClick,
  icon,
  title,
  subtitle,
  extraInfo
}: SelectionButtonProps) {
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg ${quick.muted} transition-colors ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${HOVER_BACKGROUND_EFFECTS.MUTED}`}
    >
      <div className="flex items-center space-x-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className={`${colors.text.primary} font-medium`}>{title}</div>
          {subtitle && (
            <div className={`${colors.text.muted} text-sm`}>{subtitle}</div>
          )}
          {extraInfo && (
            <div className={`${colors.text.muted} text-sm`}>{extraInfo}</div>
          )}
        </div>
      </div>
    </button>
  );
}