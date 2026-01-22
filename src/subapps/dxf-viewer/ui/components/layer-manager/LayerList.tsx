// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
import React from 'react';
import { Layers, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { LayerListProps } from './types';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';

export function LayerList({ layers, onToggleVisibility, onLayerAction }: LayerListProps) {
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'electrical':
        return colors.bg.warning;
      case 'plumbing':
        return colors.bg.info;
      case 'hvac':
        return colors.bg.success;
      default:
        return colors.bg.muted;
    }
  };

  if (layers.length === 0) {
    return (
      <div className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL} ${colors.text.muted}`}>
        <Layers className={`${iconSizes.xl} mx-auto ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${PANEL_LAYOUT.OPACITY['50']}`} />
        <p className={PANEL_LAYOUT.TYPOGRAPHY.SM}>{t('layerManager.labels.noLayersFound')}</p>
        <p className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('layerManager.labels.createNewOrChangeFilters')}</p>
      </div>
    );
  }

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.MAX_HEIGHT.LG} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO}`}>
      {layers.map(layer => (
        <div key={layer.id} className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${getStatusBorder('muted')}`}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM} flex-1`}>
              <div className={`${PANEL_LAYOUT.ICON.SMALL} ${PANEL_LAYOUT.ROUNDED.FULL} ${getCategoryColor(layer.category)}`} />
              
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{layer.name}</span>

              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${colors.bg.tertiary} ${PANEL_LAYOUT.PADDING.BADGE} ${PANEL_LAYOUT.ROUNDED.DEFAULT}`}>
                {layer.elements}
              </span>
            </div>

            <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onToggleVisibility?.(layer.id)}
                    className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                  >
                    {layer.visible ? <Eye className={iconSizes.xs} /> : <EyeOff className={iconSizes.xs} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{layer.visible ? t('layerManager.actions.hide') : t('layerManager.actions.show')}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onLayerAction?.(layer.id, 'menu')}
                    className={`${PANEL_LAYOUT.SPACING.XS} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                  >
                    <MoreVertical className={iconSizes.xs} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t('layerManager.labels.moreOptions')}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}