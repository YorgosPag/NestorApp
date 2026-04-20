import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export const ComingSoonSettings: React.FC = () => {
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer-settings']);

  return (
    <div className={`${PANEL_LAYOUT.SPACING.LG} text-center ${colors.text.muted}`}>
      <div className={`${PANEL_LAYOUT.TYPOGRAPHY['2XL']} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>🚧</div>
      <div className={PANEL_LAYOUT.TYPOGRAPHY.SM}>{t('dxf-viewer-settings:comingSoon')}</div>
    </div>
  );
};