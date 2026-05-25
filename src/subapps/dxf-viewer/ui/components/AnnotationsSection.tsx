'use client';

import React from 'react';
import { Tags, ChevronDown } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n';
import { Switch } from '@/components/ui/switch';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import {
  useOpeningTagLayerVisible,
  setOpeningTagLayerVisible,
} from '../../systems/layers/opening-tag-layer';

export function AnnotationsSection() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer-panels']);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const openingTagsVisible = useOpeningTagLayerVisible();

  return (
    <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
      <button
        type="button"
        onClick={() => setIsCollapsed(prev => !prev)}
        className={`w-full flex items-center justify-between cursor-pointer rounded ${PANEL_LAYOUT.PADDING.XS} hover:opacity-80 transition-opacity`}
      >
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.success} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <Tags className={iconSizes.sm} />
          {t('panels.annotations.title')}
        </h3>
        <ChevronDown
          className={`${iconSizes.sm} ${colors.text.muted} transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!isCollapsed && (
        <div className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.SM}`}>
          <div className={`flex flex-col ${PANEL_LAYOUT.WIDTH.MIN_ZERO} ${PANEL_LAYOUT.WIDTH.FLEX_1}`}>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.primary}`}>
              {t('panels.annotations.openingTags.label')}
            </span>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {t('panels.annotations.openingTags.description')}
            </span>
          </div>
          <Switch
            variant="status"
            checked={openingTagsVisible}
            onCheckedChange={setOpeningTagLayerVisible}
            aria-label={t('panels.annotations.openingTags.toggleAria')}
          />
        </div>
      )}
    </section>
  );
}
