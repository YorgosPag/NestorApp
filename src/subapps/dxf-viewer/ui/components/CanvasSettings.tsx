'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface CanvasSettingsProps {
  className?: string;
}

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({ className }) => {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer-settings');

  return (
    <div className={`${colors.bg.primary} ${colors.text.primary} ${className}`}>
      <div className={PANEL_LAYOUT.SPACING.LG}>
        {/* Header */}
        <div className={`${getDirectionalBorder('default', 'bottom')} ${PANEL_LAYOUT.PADDING.BOTTOM_SM} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
          <h2 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.primary} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            🖼️ {t('canvasSettings.title')}
          </h2>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
            {t('canvasSettings.subtitle')}
          </p>
        </div>

        {/* Coming Soon Placeholder */}
        <div className={`text-center ${PANEL_LAYOUT.SPACING.XL} ${colors.text.secondary}`}>
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY['4XL']} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>🎨</div>
          <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('canvasSettings.comingSoon')}</h3>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
            {t('canvasSettings.comingSoonDesc')}
          </p>
          <ul className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.TOP_MD} ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
            <li>• {t('canvasSettings.bgColor')}</li>
            <li>• {t('canvasSettings.zoomPan')}</li>
            <li>• {t('canvasSettings.gridRef')}</li>
            <li>• {t('canvasSettings.rendering')}</li>
            <li>• {t('canvasSettings.performance')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};