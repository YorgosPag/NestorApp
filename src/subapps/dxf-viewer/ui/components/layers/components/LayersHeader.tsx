'use client';

import React from 'react';
import { Layers, ChevronDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';
import { useTranslation } from '@/i18n';
import type { SceneModel } from '../../../../types/scene';

interface LayersHeaderProps {
  scene: SceneModel | null;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const LayersHeader = ({ scene, isCollapsed, onToggle }: LayersHeaderProps) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer-panels']);
  const count = Object.keys(scene?.layers || {}).length;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center justify-between cursor-pointer rounded ${PANEL_LAYOUT.PADDING.XS} hover:opacity-80 transition-opacity`}
    >
      <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.success} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        <Layers className={iconSizes.sm} />
        {t('panels.layers.headerWithCount', { count })}
      </h3>
      <ChevronDown
        className={`${iconSizes.sm} ${colors.text.muted} transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
      />
    </button>
  );
};