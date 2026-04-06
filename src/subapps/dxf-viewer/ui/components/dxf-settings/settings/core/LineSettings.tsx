/**
 * LineSettings Component
 *
 * Context-aware line settings UI component (General/Preview/Completion).
 * Orchestrates accordion sections from LineSettingsSections.tsx
 * and state from useLineSettingsState.ts.
 *
 * @see useLineSettingsState — Hook with all logic/state
 * @see LineSettingsSections — Accordion section sub-components
 * @see line-settings-icons — SVG icon components
 *
 * ADR-065 SRP split: 992 lines -> 4 files
 */

'use client';

import React from 'react';
import { Factory, RotateCcw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { useLineSettingsState } from './useLineSettingsState';
import {
  TemplatesSection,
  BasicSection,
  HoverSection,
  FinalSection,
  AdvancedSection,
  FactoryResetModal,
} from './LineSettingsSections';

export function LineSettings({ contextType }: { contextType?: 'preview' | 'completion' }) {
  const state = useLineSettingsState(contextType);
  const {
    iconSizes, borderTokens, colors, t,
    settings, settingsUpdater, resetToDefaults,
    lineCapOptions, lineJoinOptions, templateGroupedOptions,
    handleTemplateSelect, handleFactoryResetClick, handleFactoryResetConfirm,
    handleFactoryResetCancel, handleColorChange,
    showFactoryResetModal, accordion, isEmbedded,
  } = state;

  const { quick, getStatusBorder, getElementBorder, radius } = borderTokens;

  // Shared props for all sections
  const sectionProps = {
    settings, settingsUpdater, colors, borderTokens, iconSizes, t,
  };

  const settingsContent = (
    <>
      {/* Header */}
      <header className={`flex flex-col ${PANEL_LAYOUT.GAP.SM}`}>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{t('settings.line.title')}</h3>
        <nav className={`flex ${PANEL_LAYOUT.GAP.SM}`} aria-label={t('settings.line.actionsAriaLabel')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetToDefaults}
                className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}
              >
                <RotateCcw className={iconSizes.xs} />
                {t('settings.line.reset')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings.line.resetTitle')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleFactoryResetClick}
                className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}
              >
                <Factory className={iconSizes.xs} />
                {t('settings.line.factory')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings.line.factoryTitle')}</TooltipContent>
          </Tooltip>
        </nav>
      </header>

      {/* Enable/Disable Line Display */}
      <fieldset className={PANEL_LAYOUT.SPACING.GAP_SM}>
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${getElementBorder('card', 'default')} ${radius.lg}`}>
          <Checkbox
            id="line-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => settingsUpdater.updateSetting('enabled', checked === true)}
          />
          <label
            htmlFor="line-enabled"
            className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.CURSOR.POINTER} ${settings.enabled ? colors.text.primary : colors.text.muted}`}
          >
            {t('settings.line.enabled')}
          </label>
        </div>
        {!settings.enabled && (
          <aside className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.warning} ${colors.bg.warningSubtle} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md} ${getStatusBorder('warning')}`} role="alert">
            {t('settings.line.disabledWarning')}
          </aside>
        )}
      </fieldset>

      {/* Accordion Sections */}
      <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${!settings.enabled ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}` : ''}`}>
        <TemplatesSection {...sectionProps} templateGroupedOptions={templateGroupedOptions} handleTemplateSelect={handleTemplateSelect} accordion={accordion} />
        <BasicSection {...sectionProps} handleColorChange={handleColorChange} accordion={accordion} />
        <HoverSection {...sectionProps} accordion={accordion} />
        <FinalSection {...sectionProps} accordion={accordion} />
        <AdvancedSection {...sectionProps} lineCapOptions={lineCapOptions} lineJoinOptions={lineJoinOptions} accordion={accordion} />
      </div>
    </>
  );

  return (
    <>
      {isEmbedded ? (
        settingsContent
      ) : (
        <section className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${PANEL_LAYOUT.SPACING.LG}`} aria-label={t('settings.line.ariaLabel')}>
          {settingsContent}
        </section>
      )}

      <FactoryResetModal
        showFactoryResetModal={showFactoryResetModal}
        handleFactoryResetCancel={handleFactoryResetCancel}
        handleFactoryResetConfirm={handleFactoryResetConfirm}
        colors={colors}
        borderTokens={borderTokens}
        iconSizes={iconSizes}
        t={t}
      />
    </>
  );
}

export default LineSettings;
