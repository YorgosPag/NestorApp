/** LineSettings Accordion Sections + Factory Reset Modal — ADR-065 SRP split */

'use client';

import React from 'react';
import { Factory } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { BaseModal } from '../../../../../components/shared/BaseModal';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LINE_WIDTH_RANGE,
  DASH_SCALE_RANGE,
  DASH_OFFSET_RANGE,
  OPACITY_RANGE,
} from '../../../../../contexts/LineConstants';
import type { LineType } from '../../../../../settings-core/types';
import { AccordionSection } from '../shared/AccordionSection';
import { Checkbox } from '@/components/ui/checkbox';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { formatPercent } from '../../../../../rendering/entities/shared/distance-label-utils';
import {
  SettingsIcon,
  PaintbrushIcon,
  CpuChipIcon,
  AdjustmentsHorizontalIcon,
  SwatchIcon,
} from './line-settings-icons';
import type { LineSettingsState } from './useLineSettingsState';

type SectionProps = Pick<LineSettingsState,
  'settings' | 'settingsUpdater' | 'colors' | 'borderTokens' | 'iconSizes' | 't'
>;

// ===== TEMPLATES SECTION =====

export function TemplatesSection({
  settings, settingsUpdater, colors, iconSizes, t,
  templateGroupedOptions, handleTemplateSelect, accordion,
}: SectionProps & Pick<LineSettingsState, 'templateGroupedOptions' | 'handleTemplateSelect' | 'accordion'>) {
  return (
    <AccordionSection
      title={t('settings.line.sections.templates')}
      icon={<SwatchIcon className={iconSizes.sm} />}
      isOpen={accordion.isOpen('templates')}
      onToggle={() => accordion.toggleSection('templates')}
      disabled={!settings.enabled}
    >
      <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.templates')}
          </label>
          <Select
            value={settings.activeTemplate || ''}
            onValueChange={handleTemplateSelect}
          >
            <SelectTrigger className={`w-full ${colors.bg.secondary}`}>
              <SelectValue placeholder={t('lineSettings.selectTemplate')} />
            </SelectTrigger>
            <SelectContent>
              {templateGroupedOptions.map((group) => (
                <SelectGroup key={group.category}>
                  <SelectLabel>{group.categoryLabel}</SelectLabel>
                  {group.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </AccordionSection>
  );
}

// ===== BASIC SECTION =====

export function BasicSection({
  settings, settingsUpdater, colors, borderTokens, iconSizes, t,
  handleColorChange, accordion,
}: SectionProps & Pick<LineSettingsState, 'handleColorChange' | 'accordion'>) {
  const { quick, radius } = borderTokens;
  return (
    <AccordionSection
      title={t('settings.line.sections.basic')}
      icon={<SettingsIcon className={iconSizes.sm} />}
      isOpen={accordion.isOpen('basic')}
      onToggle={() => accordion.toggleSection('basic')}
      disabled={!settings.enabled}
      badge={5}
    >
      <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
        {/* Line Type */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.type')}
          </label>
          <Select
            value={settings.lineType}
            onValueChange={(value) => settingsUpdater.updateSetting('lineType', value as LineType)}
          >
            <SelectTrigger className={`w-full ${colors.bg.secondary}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['solid', 'dashed', 'dotted', 'dash-dot', 'dash-dot-dot'] as LineType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Line Width */}
        <RangeWithNumber
          label={t('settings.line.labels.widthValue', { value: settings.lineWidth })}
          min={LINE_WIDTH_RANGE.min}
          max={LINE_WIDTH_RANGE.max}
          step={LINE_WIDTH_RANGE.step}
          value={settings.lineWidth}
          onChange={settingsUpdater.createNumberInputHandler('lineWidth', { parseType: 'float' })}
          colors={colors}
          borderTokens={borderTokens}
        />

        {/* Color */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.line.labels.color')}</label>
          <ColorDialogTrigger
            value={settings.color}
            onChange={handleColorChange}
            label={settings.color}
            title={t('settings.line.colorPicker.line')}
            alpha={false}
            modes={['hex', 'rgb', 'hsl']}
            palettes={['dxf', 'semantic', 'material']}
            recent
            eyedropper
          />
        </div>

        {/* Opacity */}
        <RangeWithNumber
          label={t('settings.line.labels.opacityValue', { value: formatPercent(settings.opacity, false) })}
          min={OPACITY_RANGE.min}
          max={OPACITY_RANGE.max}
          step={OPACITY_RANGE.step}
          value={settings.opacity}
          onChange={settingsUpdater.createNumberInputHandler('opacity', { parseType: 'float' })}
          colors={colors}
          borderTokens={borderTokens}
        />

        {/* Break at Center */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Checkbox
              id="break-at-center"
              checked={settings.breakAtCenter || false}
              onCheckedChange={(checked) => settingsUpdater.updateSetting('breakAtCenter', checked === true)}
            />
            <label htmlFor="break-at-center" className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.CURSOR.POINTER} ${colors.text.secondary}`}>{t('settings.line.labels.breakAtCenter')}</label>
          </div>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.LEFT_LG}`}>
            {t('settings.line.labels.breakAtCenterDescription')}
          </p>
        </div>
      </div>
    </AccordionSection>
  );
}

// ===== HOVER SECTION =====

export function HoverSection({
  settings, settingsUpdater, colors, borderTokens, iconSizes, t, accordion,
}: SectionProps & Pick<LineSettingsState, 'accordion'>) {
  return (
    <AccordionSection
      title={t('settings.line.sections.hover')}
      icon={<PaintbrushIcon className={iconSizes.sm} />}
      isOpen={accordion.isOpen('hover')}
      onToggle={() => accordion.toggleSection('hover')}
      disabled={!settings.enabled}
      badge={3}
    >
      <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
        {/* Hover Color */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.line.labels.hoverColor')}</label>
          <ColorDialogTrigger
            value={settings.hoverColor}
            onChange={settingsUpdater.createColorHandler('hoverColor')}
            label={settings.hoverColor}
            title={t('settings.line.colorPicker.hover')}
            alpha={false}
            modes={['hex', 'rgb', 'hsl']}
            palettes={['dxf', 'semantic', 'material']}
            recent
            eyedropper
          />
        </div>

        {/* Hover Width */}
        <RangeWithNumber
          label={t('settings.line.labels.hoverWidthValue', { value: settings.hoverWidth })}
          min={LINE_WIDTH_RANGE.min}
          max={LINE_WIDTH_RANGE.max}
          step={LINE_WIDTH_RANGE.step}
          value={settings.hoverWidth}
          onChange={settingsUpdater.createNumberInputHandler('hoverWidth', { parseType: 'float' })}
          colors={colors}
          borderTokens={borderTokens}
        />

        {/* Hover Opacity */}
        <RangeWithNumber
          label={t('settings.line.labels.hoverOpacityValue', { value: formatPercent(settings.hoverOpacity, false) })}
          min={OPACITY_RANGE.min}
          max={OPACITY_RANGE.max}
          step={OPACITY_RANGE.step}
          value={settings.hoverOpacity}
          onChange={settingsUpdater.createNumberInputHandler('hoverOpacity', { parseType: 'float' })}
          colors={colors}
          borderTokens={borderTokens}
        />
      </div>
    </AccordionSection>
  );
}

// ===== FINAL SECTION =====

export function FinalSection({
  settings, settingsUpdater, colors, borderTokens, iconSizes, t, accordion,
}: SectionProps & Pick<LineSettingsState, 'accordion'>) {
  return (
    <AccordionSection
      title={t('settings.line.sections.final')}
      icon={<CpuChipIcon className={iconSizes.sm} />}
      isOpen={accordion.isOpen('final')}
      onToggle={() => accordion.toggleSection('final')}
      disabled={!settings.enabled}
      badge={3}
    >
      <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
        {/* Final Color */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.line.labels.finalColor')}</label>
          <ColorDialogTrigger
            value={settings.finalColor}
            onChange={settingsUpdater.createColorHandler('finalColor')}
            label={settings.finalColor}
            title={t('settings.line.colorPicker.final')}
            alpha={false}
            modes={['hex', 'rgb', 'hsl']}
            palettes={['dxf', 'semantic', 'material']}
            recent
            eyedropper
          />
        </div>

        {/* Final Width */}
        <RangeWithNumber
          label={t('settings.line.labels.finalWidthValue', { value: settings.finalWidth })}
          min={LINE_WIDTH_RANGE.min}
          max={LINE_WIDTH_RANGE.max}
          step={LINE_WIDTH_RANGE.step}
          value={settings.finalWidth}
          onChange={settingsUpdater.createNumberInputHandler('finalWidth', { parseType: 'float' })}
          colors={colors}
          borderTokens={borderTokens}
        />

        {/* Final Opacity */}
        <RangeWithNumber
          label={t('settings.line.labels.finalOpacityValue', { value: formatPercent(settings.finalOpacity, false) })}
          min={OPACITY_RANGE.min}
          max={OPACITY_RANGE.max}
          step={OPACITY_RANGE.step}
          value={settings.finalOpacity}
          onChange={settingsUpdater.createNumberInputHandler('finalOpacity', { parseType: 'float' })}
          colors={colors}
          borderTokens={borderTokens}
        />
      </div>
    </AccordionSection>
  );
}

// ===== ADVANCED SECTION =====

export function AdvancedSection({
  settings, settingsUpdater, colors, borderTokens, iconSizes, t,
  lineCapOptions, lineJoinOptions, accordion,
}: SectionProps & Pick<LineSettingsState, 'lineCapOptions' | 'lineJoinOptions' | 'accordion'>) {
  return (
    <AccordionSection
      title={t('settings.line.sections.advanced')}
      icon={<AdjustmentsHorizontalIcon className={iconSizes.sm} />}
      isOpen={accordion.isOpen('advanced')}
      onToggle={() => accordion.toggleSection('advanced')}
      disabled={!settings.enabled}
    >
      <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
        {/* Dash Scale (only for non-solid lines) */}
        {settings.lineType !== 'solid' && (
          <RangeWithNumber
            label={t('settings.line.labels.dashScaleValue', { value: settings.dashScale })}
            min={DASH_SCALE_RANGE.min}
            max={DASH_SCALE_RANGE.max}
            step={DASH_SCALE_RANGE.step}
            value={settings.dashScale}
            onChange={settingsUpdater.createNumberInputHandler('dashScale', { parseType: 'float' })}
            colors={colors}
            borderTokens={borderTokens}
          />
        )}

        {/* Line Cap (ADR-001: Radix Select) */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.lineCap')}
          </label>
          <Select
            value={settings.lineCap}
            onValueChange={(value) => settingsUpdater.updateSetting('lineCap', value)}
          >
            <SelectTrigger className={`w-full ${colors.bg.secondary}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lineCapOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Line Join (ADR-001: Radix Select) */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.lineJoin')}
          </label>
          <Select
            value={settings.lineJoin}
            onValueChange={(value) => settingsUpdater.updateSetting('lineJoin', value)}
          >
            <SelectTrigger className={`w-full ${colors.bg.secondary}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lineJoinOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dash Offset (only for non-solid lines) */}
        {settings.lineType !== 'solid' && (
          <RangeWithNumber
            label={t('settings.line.labels.dashOffsetValue', { value: settings.dashOffset })}
            min={DASH_OFFSET_RANGE.min}
            max={DASH_OFFSET_RANGE.max}
            step={DASH_OFFSET_RANGE.step}
            value={settings.dashOffset}
            onChange={settingsUpdater.createNumberInputHandler('dashOffset', { parseType: 'float' })}
            colors={colors}
            borderTokens={borderTokens}
          />
        )}
      </div>
    </AccordionSection>
  );
}

// ===== FACTORY RESET MODAL =====

export function FactoryResetModal({
  showFactoryResetModal, handleFactoryResetCancel, handleFactoryResetConfirm,
  colors, borderTokens, iconSizes, t,
}: Pick<LineSettingsState, 'showFactoryResetModal' | 'handleFactoryResetCancel' | 'handleFactoryResetConfirm' | 'colors' | 'borderTokens' | 'iconSizes' | 't'>) {
  const { quick, getStatusBorder, radius } = borderTokens;
  return (
    <BaseModal
      isOpen={showFactoryResetModal}
      onClose={handleFactoryResetCancel}
      title={t('settings.line.factoryReset.title')}
      size="md"
      closeOnBackdrop={false}
      zIndex={10000}
    >
      <article className={PANEL_LAYOUT.SPACING.GAP_LG}>
        <aside className={`${colors.bg.errorSubtle} ${getStatusBorder('error')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="alert">
          <p className={`${colors.text.error} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
            {t('settings.line.factoryReset.warning')}
          </p>
        </aside>

        <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <p className={`${colors.text.muted} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('settings.line.factoryReset.lossTitle')}</p>
          <ul className={`list-disc list-inside ${PANEL_LAYOUT.SPACING.GAP_XS} ${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
            <li>{t('settings.line.factoryReset.lossList.customSettings')}</li>
            <li>{t('settings.line.factoryReset.lossList.templates')}</li>
            <li>{t('settings.line.factoryReset.lossList.changes')}</li>
          </ul>
        </section>

        <aside className={`${colors.bg.infoSubtle} ${getStatusBorder('info')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="note">
          <p className={`${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
            {t('settings.line.factoryReset.resetInfo')}
          </p>
        </aside>

        <p className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-center ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
          {t('settings.line.factoryReset.confirm')}
        </p>

        <footer className={`flex ${PANEL_LAYOUT.GAP.MD} justify-end ${PANEL_LAYOUT.PADDING.TOP_LG}${quick.separator}`}>
          <button
            onClick={handleFactoryResetCancel}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHTER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            {t('settings.line.factoryReset.cancel')}
          </button>
          <button
            onClick={handleFactoryResetConfirm}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.danger} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
          >
            <Factory className={iconSizes.xs} />
            {t('settings.line.factoryReset.confirmButton')}
          </button>
        </footer>
      </article>
    </BaseModal>
  );
}

// ===== SHARED: Range + Number Input =====

function RangeWithNumber({
  label, min, max, step, value, onChange, colors, borderTokens,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  colors: LineSettingsState['colors'];
  borderTokens: LineSettingsState['borderTokens'];
}) {
  const { quick, radius } = borderTokens;
  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
        {label}
      </label>
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
        />
      </div>
    </div>
  );
}
