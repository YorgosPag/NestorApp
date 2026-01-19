// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
import React from 'react';
import { Layers, Plus, Settings } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
import type { LayerHeaderProps } from './types';

export function LayerHeader({ isConnected, onAddLayer, onSettings }: LayerHeaderProps) {
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div className="flex items-center justify-between">
      <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        <Layers className={iconSizes.sm} />
        {t('layerManager.title')}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
          <div
            className={`${iconSizes.xs} ${PANEL_LAYOUT.ROUNDED.FULL} ${isConnected ? colors.bg.success : colors.bg.error}`}
            title={isConnected ? t('layerManager.sync.connectedTooltip') : t('layerManager.sync.disconnectedTooltip')}
          />
        </div>
      </h3>

      <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
        <button
          onClick={onAddLayer}
          className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          title={t('layerManager.createDialog.title')}
        >
          <Plus className={iconSizes.xs} />
        </button>

        <div className="relative">
          <button
            onClick={onSettings}
            className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
            title={t('common.settings', { ns: 'common' })}
          >
            <Settings className={iconSizes.xs} />
          </button>
        </div>
      </div>
    </div>
  );
}