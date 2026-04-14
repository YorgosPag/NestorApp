'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/i18n';
import { Factory, RotateCcw } from 'lucide-react';
import { useUnifiedGripPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import type { GripSettings as GripSettingsType } from '../../../../../settings-core/types';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CAD_UI_COLORS, UI_COLORS } from '../../../../../config/color-config';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/providers/NotificationProvider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPercent } from '../../../../../rendering/entities/shared/distance-label-utils';
import { UI_SIZE_DEFAULTS } from '../../../../../config/text-rendering-config';
import { CogIcon, ColorSwatchIcon, ViewGridIcon, AdjustmentsIcon } from './grip-settings-icons';
import { GripFactoryResetModal } from './GripFactoryResetModal';

export function GripSettings({ contextType }: { contextType?: 'preview' | 'completion' }) {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getElementBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  const notifications = useNotifications();
  const { settings: { gripSettings }, updateGripSettings, resetToDefaults } = useUnifiedGripPreview();
  const { toggleSection, isOpen } = useAccordion('basic');
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  if (!gripSettings || typeof gripSettings.gripSize === 'undefined') {
    return <div>Loading grip settings...</div>;
  }

  const updateSettings = (updates: Partial<GripSettingsType>) => {
    updateGripSettings(updates);
  };

  const handleFactoryResetConfirm = () => {
    resetToDefaults();
    setShowFactoryResetModal(false);
    notifications.success(
      `🏭 ${t('settings.grip.factoryReset.successMessage')}`,
      { duration: 5000 }
    );
  };

  const handleFactoryResetCancel = () => {
    setShowFactoryResetModal(false);
    notifications.info(`❌ ${t('settings.grip.factoryReset.cancelMessage')}`);
  };

  const isEmbedded = Boolean(contextType);

  const settingsContent = (
    <>
      <header className={`flex flex-col ${PANEL_LAYOUT.GAP.SM}`}>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{t('settings.grip.title')}</h3>
        <nav className={`flex ${PANEL_LAYOUT.GAP.SM}`} aria-label={t('settings.grip.actionsAriaLabel')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetToDefaults}
                className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}
              >
                <RotateCcw className={iconSizes.xs} />
                {t('settings.grip.reset')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings.grip.resetTitle')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowFactoryResetModal(true)}
                className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}
              >
                <Factory className={iconSizes.xs} />
                {t('settings.grip.factory')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings.grip.factoryTitle')}</TooltipContent>
          </Tooltip>
        </nav>
      </header>

      <fieldset className={PANEL_LAYOUT.SPACING.GAP_SM}>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${getElementBorder('card', 'default')} ${radius.lg}`}>
          <Checkbox
            id="grips-enabled"
            checked={gripSettings.enabled}
            onCheckedChange={(checked) => updateSettings({ enabled: checked === true })}
          />
          <label
            htmlFor="grips-enabled"
            className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.CURSOR.POINTER} ${gripSettings.enabled ? colors.text.primary : colors.text.muted}`}
          >
            {t('settings.grip.enabled')}
          </label>
        </div>
        {!gripSettings.enabled && (
          <aside className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.warning} ${colors.bg.warningSubtle} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md} ${getStatusBorder('warning')}`} role="alert">
            ⚠️ {t('settings.grip.disabledWarning')}
          </aside>
        )}
      </fieldset>

      <div className={PANEL_LAYOUT.SPACING.GAP_MD}>
        {/* 1. Basic Settings */}
        <AccordionSection
          title={t('settings.grip.sections.basic')}
          icon={<CogIcon className={iconSizes.sm} />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={false}
          badge={3}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* Grip Size */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.grip.labels.size')}: {gripSettings.gripSize || UI_SIZE_DEFAULTS.GRIP_SIZE}px
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input type="range" min="4" max="16" step="1"
                  value={gripSettings.gripSize || UI_SIZE_DEFAULTS.GRIP_SIZE}
                  onChange={(e) => updateSettings({ gripSize: parseInt(e.target.value) })}
                  className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
                />
                <input type="number" min="4" max="16" step="1"
                  value={gripSettings.gripSize || UI_SIZE_DEFAULTS.GRIP_SIZE}
                  onChange={(e) => updateSettings({ gripSize: parseInt(e.target.value) })}
                  className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
                />
              </div>
            </div>
            {/* Opacity */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.grip.labels.opacity')}: {formatPercent(gripSettings.opacity)}
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input type="range" min="0.1" max="1" step="0.1"
                  value={gripSettings.opacity}
                  onChange={(e) => updateSettings({ opacity: parseFloat(e.target.value) })}
                  className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
                />
                <input type="number" min="0.1" max="1" step="0.1"
                  value={gripSettings.opacity}
                  onChange={(e) => updateSettings({ opacity: parseFloat(e.target.value) })}
                  className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
                />
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* 2. Colors */}
        <AccordionSection
          title={t('settings.grip.sections.colors')}
          icon={<ColorSwatchIcon className={iconSizes.sm} />}
          isOpen={isOpen('colors')}
          onToggle={() => toggleSection('colors')}
          disabled={false}
          badge={4}
        >
          <div className={`grid ${PANEL_LAYOUT.GRID.COLS_2} ${PANEL_LAYOUT.GAP.LG}`}>
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.grip.labels.coldColor')}</label>
              <ColorDialogTrigger value={gripSettings.colors.cold || CAD_UI_COLORS.grips.cold} onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, cold: color } })} label={gripSettings.colors.cold || CAD_UI_COLORS.grips.cold} title={t('settings.grip.colorPicker.cold')} alpha={false} modes={['hex', 'rgb', 'hsl']} palettes={['dxf', 'semantic', 'material']} recent eyedropper />
            </div>
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.grip.labels.warmColor')}</label>
              <ColorDialogTrigger value={gripSettings.colors.warm || CAD_UI_COLORS.grips.warm} onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, warm: color } })} label={gripSettings.colors.warm || CAD_UI_COLORS.grips.warm} title={t('settings.grip.colorPicker.warm')} alpha={false} modes={['hex', 'rgb', 'hsl']} palettes={['dxf', 'semantic', 'material']} recent eyedropper />
            </div>
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.grip.labels.hotColor')}</label>
              <ColorDialogTrigger value={gripSettings.colors.hot || CAD_UI_COLORS.grips.hot} onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, hot: color } })} label={gripSettings.colors.hot || UI_COLORS.HIGHLIGHTED_ENTITY} title={t('settings.grip.colorPicker.hot')} alpha={false} modes={['hex', 'rgb', 'hsl']} palettes={['dxf', 'semantic', 'material']} recent eyedropper />
            </div>
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.grip.labels.contourColor')}</label>
              <ColorDialogTrigger value={gripSettings.colors.contour} onChange={(color) => updateSettings({ colors: { ...gripSettings.colors, contour: color } })} label={gripSettings.colors.contour} title={t('settings.grip.colorPicker.contour')} alpha={false} modes={['hex', 'rgb', 'hsl']} palettes={['dxf', 'semantic', 'material']} recent eyedropper />
            </div>
          </div>
        </AccordionSection>

        {/* 3. Grip Types */}
        <AccordionSection
          title={t('settings.grip.sections.types')}
          icon={<ViewGridIcon className={iconSizes.sm} />}
          isOpen={isOpen('types')}
          onToggle={() => toggleSection('types')}
          disabled={false}
          badge={3}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <Checkbox id="show-midpoints" checked={gripSettings.showMidpoints} onCheckedChange={(checked) => updateSettings({ showMidpoints: checked === true })} />
              <label htmlFor="show-midpoints" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>{t('settings.grip.checkboxes.showMidpoints')}</label>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <Checkbox id="show-centers" checked={gripSettings.showCenters} onCheckedChange={(checked) => updateSettings({ showCenters: checked === true })} />
              <label htmlFor="show-centers" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>{t('settings.grip.checkboxes.showCenters')}</label>
            </div>
            <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <Checkbox id="show-quadrants" checked={gripSettings.showQuadrants} onCheckedChange={(checked) => updateSettings({ showQuadrants: checked === true })} />
              <label htmlFor="show-quadrants" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>{t('settings.grip.checkboxes.showQuadrants')}</label>
            </div>
          </div>
        </AccordionSection>

        {/* 4. Advanced Settings */}
        <AccordionSection
          title={t('settings.grip.sections.advanced')}
          icon={<AdjustmentsIcon className={iconSizes.sm} />}
          isOpen={isOpen('advanced')}
          onToggle={() => toggleSection('advanced')}
          disabled={false}
          badge={6}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* Pick Box Size */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.grip.labels.pickBoxSize')}: {gripSettings.pickBoxSize || UI_SIZE_DEFAULTS.PICK_BOX_SIZE}px
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input type="range" min="1" max="8" step="1" value={gripSettings.pickBoxSize || UI_SIZE_DEFAULTS.PICK_BOX_SIZE} onChange={(e) => updateSettings({ pickBoxSize: parseInt(e.target.value) })} className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`} />
                <input type="number" min="1" max="8" step="1" value={gripSettings.pickBoxSize || UI_SIZE_DEFAULTS.PICK_BOX_SIZE} onChange={(e) => updateSettings({ pickBoxSize: parseInt(e.target.value) })} className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`} />
              </div>
            </div>
            {/* Aperture Size */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.grip.labels.apertureSize')}: {gripSettings.apertureSize || 16}px
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input type="range" min="8" max="32" step="2" value={gripSettings.apertureSize || 16} onChange={(e) => updateSettings({ apertureSize: parseInt(e.target.value) })} className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`} />
                <input type="number" min="8" max="32" step="2" value={gripSettings.apertureSize || 16} onChange={(e) => updateSettings({ apertureSize: parseInt(e.target.value) })} className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`} />
              </div>
            </div>
            {/* Max Grips */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.grip.labels.maxGrips')}: {gripSettings.maxGripsPerEntity || 50}
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input type="range" min="10" max="200" step="10" value={gripSettings.maxGripsPerEntity || 50} onChange={(e) => updateSettings({ maxGripsPerEntity: parseInt(e.target.value) })} className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`} />
                <input type="number" min="10" max="200" step="10" value={gripSettings.maxGripsPerEntity || 50} onChange={(e) => updateSettings({ maxGripsPerEntity: parseInt(e.target.value) })} className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`} />
              </div>
            </div>
            {/* Advanced Checkboxes */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Checkbox id="show-aperture" checked={gripSettings.showAperture} onCheckedChange={(checked) => updateSettings({ showAperture: checked === true })} />
                <label htmlFor="show-aperture" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>{t('settings.grip.checkboxes.showAperture')}</label>
              </div>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Checkbox id="multi-grip-edit" checked={gripSettings.multiGripEdit} onCheckedChange={(checked) => updateSettings({ multiGripEdit: checked === true })} />
                <label htmlFor="multi-grip-edit" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>{t('settings.grip.checkboxes.multiGripEdit')}</label>
              </div>
              <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <Checkbox id="snap-to-grips" checked={gripSettings.snapToGrips} onCheckedChange={(checked) => updateSettings({ snapToGrips: checked === true })} />
                <label htmlFor="snap-to-grips" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>{t('settings.grip.checkboxes.snapToGrips')}</label>
              </div>
            </div>
            {/* Quick Presets */}
            <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.PADDING.TOP_LG}${quick.separator}`}>
              <h5 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted}`}>{t('settings.grip.presets.title')}</h5>
              <div className={`flex ${PANEL_LAYOUT.SPACING.GAP_H_SM}`}>
                <button onClick={() => updateSettings({ gripSize: 5, pickBoxSize: 2, apertureSize: 10 })} className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}>
                  {t('settings.grip.presets.small')}
                </button>
                <button onClick={() => updateSettings({ gripSize: 8, pickBoxSize: 3, apertureSize: 16 })} className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.bg.info} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}>
                  {t('settings.grip.presets.normal')}
                </button>
                <button onClick={() => updateSettings({ gripSize: 12, pickBoxSize: 5, apertureSize: 24 })} className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}>
                  {t('settings.grip.presets.large')}
                </button>
              </div>
            </div>
          </div>
        </AccordionSection>
      </div>
    </>
  );

  return (
    <>
      {isEmbedded ? settingsContent : (
        <section className={`${PANEL_LAYOUT.SPACING.GAP_XL} ${PANEL_LAYOUT.SPACING.LG}`} aria-label={t('settings.grip.ariaLabel')}>
          {settingsContent}
        </section>
      )}

      <GripFactoryResetModal
        isOpen={showFactoryResetModal}
        onClose={handleFactoryResetCancel}
        onConfirm={handleFactoryResetConfirm}
      />
    </>
  );
}

export default GripSettings;
