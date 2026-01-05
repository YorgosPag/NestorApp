import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

export const ComingSoonSettings: React.FC = () => {
  const colors = useSemanticColors();

  return (
    <div className={`${PANEL_LAYOUT.SPACING.LG} text-center ${colors.text.muted}`}>
      <div className={`${PANEL_LAYOUT.TYPOGRAPHY['2XL']} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>🚧</div>
      <div className={PANEL_LAYOUT.TYPOGRAPHY.SM}>Σύντομα διαθέσιμο...</div>
    </div>
  );
};