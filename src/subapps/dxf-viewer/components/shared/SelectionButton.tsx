/**
 * Shared selection button component
 * Eliminates duplicate button styling and structure
 */
import React from 'react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';

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
      className={`w-full text-left ${PANEL_LAYOUT.SPACING.LG} ${PANEL_LAYOUT.ROUNDED.LG} ${quick.muted} transition-colors ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${HOVER_BACKGROUND_EFFECTS.MUTED}`}
    >
      <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
        <span className={PANEL_LAYOUT.TYPOGRAPHY['2XL']}>{icon}</span>
        <div>
          <div className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{title}</div>
          {subtitle && (
            <div className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>{subtitle}</div>
          )}
          {extraInfo && (
            <div className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>{extraInfo}</div>
          )}
        </div>
      </div>
    </button>
  );
}