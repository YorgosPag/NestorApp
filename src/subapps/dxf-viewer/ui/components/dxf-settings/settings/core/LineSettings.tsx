/**
 * LineSettings Component
 *
 * @description
 * Context-aware line settings UI component που χρησιμοποιεί διαφορετικά hooks
 * ανάλογα με το context (General/Preview/Completion).
 *
 * @features
 * - 🎨 Context-aware hook selection (General/Preview/Completion)
 * - 📐 ISO 128 + AutoCAD standards (line types, widths, caps, joins)
 * - 🎭 Template system (Construction/Hidden/Center/Break lines)
 * - 🔄 Accordion sections (Basic/Advanced/Hover/Final/Templates)
 * - ✅ Validation με commonValidators
 * - 🎨 Color picker integration (SharedColorPicker)
 *
 * @context_types
 * - `'general'` - Γενικές Ρυθμίσεις (useLineSettingsFromProvider)
 * - `'preview'` - Preview Ρυθμίσεις (useUnifiedLinePreview)
 * - `'completion'` - Completion Ρυθμίσεις (useUnifiedLineCompletion)
 *
 * @accordion_sections
 * 1. **Basic Settings** - Type, Width, Color, Opacity
 * 2. **Advanced Settings** - Dash Scale/Offset, Line Cap/Join, Break at Center
 * 3. **Hover Appearance** - Hover Color, Type, Width, Opacity
 * 4. **Final Appearance** - Final Color, Type, Width, Opacity
 * 5. **Templates** - Construction, Hidden, Center, Break lines
 *
 * @props
 * - `contextType?: 'general' | 'preview' | 'completion'` - Settings context
 *
 * @usage
 * ```tsx
 * // In ColorPalettePanel - General tab
 * <LineSettings contextType="general" />
 *
 * // In EntitiesSettings - Preview tab
 * <LineSettings contextType="preview" />
 *
 * // In EntitiesSettings - Completion tab
 * <LineSettings contextType="completion" />
 * ```
 *
 * @iso_standards
 * - ISO 128: Line types (Continuous, Dashed, Dotted, etc.)
 * - ISO 128: Standard widths (0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0 mm)
 * - AutoCAD ACI: Color standards (7=White, 2=Yellow, 3=Green, etc.)
 *
 * @see {@link docs/settings-system/05-UI_COMPONENTS.md#linesettings-component} - Full documentation
 * @see {@link docs/settings-system/02-COLORPALETTEPANEL.md} - Parent component
 * @see {@link ui/hooks/useUnifiedSpecificSettings.ts} - Hook implementations
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06
 * @version 1.0.0
 */

'use client';

import React, { useState } from 'react';
import { Factory, RotateCcw } from 'lucide-react';  // 🏢 ENTERPRISE: Centralized Lucide icons
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useLineSettingsFromProvider, useEnterpriseDxfSettings } from '../../../../../settings-provider';
// ✅ ΑΝΤΙΚΑΤΑΣΤΑΣΗ ΜΕ UNIFIED HOOKS
import { useUnifiedLinePreview, useUnifiedLineCompletion } from '../../../../hooks/useUnifiedSpecificSettings';
import type { LineTemplate as LineSettingsTemplate } from '../../../../../contexts/LineSettingsContext';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useSettingsUpdater, commonValidators } from '../../../../hooks/useSettingsUpdater';
import { useNotifications } from '@/providers/NotificationProvider';
import { BaseModal } from '../../../../../components/shared/BaseModal';
// 🏢 ADR-001: Radix Select is the ONLY canonical dropdown component
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
  getTemplatesByCategory,
  getLineTypeLabel,
  getLineCapLabel,
  getLineJoinLabel,
  getTemplateCategoryLabel,
  getTemplateLabel,
  getTemplateDescription
} from '../../../../../contexts/LineConstants';
import type { LineType, LineCapStyle, LineJoinStyle } from '../../../../../settings-core/types';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import centralized panel spacing (Single Source of Truth)
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: Centralized Checkbox component (Radix)
import { Checkbox } from '@/components/ui/checkbox';
// 🏢 ENTERPRISE: Centralized Button component (Radix)
import { Button } from '@/components/ui/button';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
// 🏢 ENTERPRISE: Shadcn Tooltip component
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// 🏢 ADR-081: Centralized percentage formatting
import { formatPercent } from '../../../../../rendering/entities/shared/distance-label-utils';

// Simple SVG icons
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PaintbrushIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3V1M13 7l6-6M17 11l6-6" />
  </svg>
);

const CpuChipIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const AdjustmentsHorizontalIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
  </svg>
);

const SwatchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3V1M13 7l6-6" />
  </svg>
);

export function LineSettings({ contextType }: { contextType?: 'preview' | 'completion' }) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getElementBorder, radius } = useBorderTokens();  // ✅ ENTERPRISE: Added getElementBorder for consistent styling
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer');  // 🏢 ENTERPRISE: i18n
  // 🔺 ΔΙΟΡΘΩΣΗ: Χρήση unified hooks όπως σε TextSettings και GripSettings
  const generalLineSettings = useLineSettingsFromProvider();
  const notifications = useNotifications();
  // ✅ ENTERPRISE: Πρόσβαση στο context για ενημέρωση completion settings
  const enterpriseContext = useEnterpriseDxfSettings();

  // Καθορίζουμε το active context
  const activeContext = contextType || 'general';

  // Χρησιμοποιούμε το σωστό unified hook βάσει context
  const lineSettingsContext = (() => {
    if (activeContext === 'preview') {
      // 🔺 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
      const unifiedHook = useUnifiedLinePreview();
      return {
        settings: unifiedHook.settings.lineSettings,
        updateSettings: unifiedHook.updateLineSettings,
        resetToDefaults: unifiedHook.resetToDefaults,
        resetToFactory: () => unifiedHook.resetToDefaults(), // ✅ ENTERPRISE FIX: Use resetToDefaults as factory reset
        applyTemplate: (template: LineSettingsTemplate) => {
          // ✅ ENTERPRISE FIX: Use proper nested settings structure from LineSettingsContext
          unifiedHook.updateLineSettings({
            lineType: template.settings.lineType,
            lineWidth: template.settings.lineWidth,
            color: template.settings.color,
            opacity: template.settings.opacity,
            dashScale: template.settings.dashScale,
            dashOffset: template.settings.dashOffset,
            lineCap: template.settings.lineCap,
            lineJoin: template.settings.lineJoin,
            breakAtCenter: template.settings.breakAtCenter
          });
        },
        getCurrentDashPattern: () => {
          return generalLineSettings.getCurrentDashPattern(); // Fallback στη γενική λογική
        }
      };
    } else if (activeContext === 'completion') {
      // 🔺 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
      const unifiedHook = useUnifiedLineCompletion();
      return {
        settings: unifiedHook.settings.lineSettings,
        updateSettings: unifiedHook.updateLineSettings,
        resetToDefaults: unifiedHook.resetToDefaults,
        resetToFactory: () => unifiedHook.resetToDefaults(), // ✅ ENTERPRISE FIX: Use resetToDefaults as factory reset
        applyTemplate: (template: LineSettingsTemplate) => {
          // ✅ ENTERPRISE FIX: Use proper nested settings structure from LineSettingsContext
          unifiedHook.updateLineSettings({
            lineType: template.settings.lineType,
            lineWidth: template.settings.lineWidth,
            color: template.settings.color,
            opacity: template.settings.opacity,
            dashScale: template.settings.dashScale,
            dashOffset: template.settings.dashOffset,
            lineCap: template.settings.lineCap,
            lineJoin: template.settings.lineJoin,
            breakAtCenter: template.settings.breakAtCenter
          });
        },
        getCurrentDashPattern: () => {
          return generalLineSettings.getCurrentDashPattern(); // Fallback στη γενική λογική
        }
      };
    } else {
      // Γενικές ρυθμίσεις - fallback
      return {
        ...generalLineSettings,
        resetToFactory: () => generalLineSettings.resetToDefaults(), // ✅ ENTERPRISE FIX: Use resetToDefaults as factory reset
        applyTemplate: (template: LineSettingsTemplate) => {
          // ✅ ENTERPRISE FIX: Use proper nested settings structure from LineSettingsContext
          generalLineSettings.updateSettings({
            lineType: template.settings.lineType,
            lineWidth: template.settings.lineWidth,
            color: template.settings.color,
            opacity: template.settings.opacity,
            dashScale: template.settings.dashScale,
            dashOffset: template.settings.dashOffset,
            lineCap: template.settings.lineCap,
            lineJoin: template.settings.lineJoin,
            breakAtCenter: template.settings.breakAtCenter
          });
        }
      };
    }
  })();

  const { settings, updateSettings, resetToDefaults, resetToFactory, applyTemplate, getCurrentDashPattern } = lineSettingsContext;

  // Settings updater hook
  const settingsUpdater = useSettingsUpdater({
    updateSettings,
    validator: (value, key) => {
      switch (key) {
        case 'lineWidth':
        case 'hoverWidth':
        case 'finalWidth':
          return commonValidators.numberRange(LINE_WIDTH_RANGE.min, LINE_WIDTH_RANGE.max)(value);
        case 'opacity':
        case 'hoverOpacity':
        case 'finalOpacity':
          return commonValidators.numberRange(OPACITY_RANGE.min, OPACITY_RANGE.max)(value);
        case 'dashScale':
          return commonValidators.numberRange(DASH_SCALE_RANGE.min, DASH_SCALE_RANGE.max)(value);
        case 'dashOffset':
          return commonValidators.numberRange(DASH_OFFSET_RANGE.min, DASH_OFFSET_RANGE.max)(value);
        case 'color':
        case 'hoverColor':
        case 'finalColor':
          return commonValidators.hexColor(value);
        default:
          return true;
      }
    }
  });

  // Local state για modal (Factory Reset)
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  // ===== HANDLERS =====

  // Handle template selection
  const handleTemplateSelect = (templateName: string) => {
    const allTemplates = templateGroupedOptions.flatMap(group => group.options);
    const selectedOption = allTemplates.find(opt => opt.value === templateName);

    if (selectedOption) {
      // Find the actual template object
      const template = [
        ...getTemplatesByCategory('engineering'),
        ...getTemplatesByCategory('architectural'),
        ...getTemplatesByCategory('electrical')
      ].find(t => t.name === templateName);

      if (template) {
        console.debug('🎨 Applying template:', templateName, template);
        // 🏢 ENTERPRISE: Convert LineConstantsTemplate to LineSettingsTemplate format
        // LineSettings requires 'enabled' property but template.settings doesn't have it
        const lineSettingsTemplate: LineSettingsTemplate = {
          name: template.name,
          category: template.category,
          description: template.description,
          settings: {
            enabled: true, // ✅ ENTERPRISE FIX: Add required 'enabled' property
            ...template.settings
          }
        };
        applyTemplate(lineSettingsTemplate);
        // 🏢 ENTERPRISE: activeTemplate is part of LineSettings interface (settings-core/types/domain.ts)
        updateSettings({ activeTemplate: templateName });
        console.debug('✅ Template applied, activeTemplate set to:', templateName);
      }
    } else {
      console.warn('⚠️ Template not found:', templateName);
    }
  };

  // Get current dash pattern for preview
  const currentDashPattern = getCurrentDashPattern();

  // ===== SELECT OPTIONS (ADR-001: Radix Select Pattern) =====

  // Line Type Options - 🏢 ENTERPRISE: Using i18n functions
  const lineTypeOptions = (['solid', 'dashed', 'dotted', 'dash-dot', 'dash-dot-dot'] as LineType[]).map(type => ({
    value: type,
    label: getLineTypeLabel(type, t)
  }));

  // Line Cap Options - 🏢 ENTERPRISE: Using i18n functions
  const lineCapOptions = (['butt', 'round', 'square'] as LineCapStyle[]).map(cap => ({
    value: cap,
    label: getLineCapLabel(cap, t)
  }));

  // Line Join Options - 🏢 ENTERPRISE: Using i18n functions
  const lineJoinOptions = (['miter', 'round', 'bevel'] as LineJoinStyle[]).map(join => ({
    value: join,
    label: getLineJoinLabel(join, t)
  }));

  // Template Options (Grouped by category) - ADR-001 Radix SelectGroup pattern - 🏢 ENTERPRISE: Using i18n functions
  const templateGroupedOptions = [
    {
      category: 'engineering',
      categoryLabel: getTemplateCategoryLabel('engineering', t),
      options: getTemplatesByCategory('engineering').map((template) => ({
        value: template.name,
        label: getTemplateLabel(template, t),
        description: getTemplateDescription(template, t)
      }))
    },
    {
      category: 'architectural',
      categoryLabel: getTemplateCategoryLabel('architectural', t),
      options: getTemplatesByCategory('architectural').map((template) => ({
        value: template.name,
        label: getTemplateLabel(template, t),
        description: getTemplateDescription(template, t)
      }))
    },
    {
      category: 'electrical',
      categoryLabel: getTemplateCategoryLabel('electrical', t),
      options: getTemplatesByCategory('electrical').map((template) => ({
        value: template.name,
        label: getTemplateLabel(template, t),
        description: getTemplateDescription(template, t)
      }))
    }
  ];

  // 🆕 TEMPLATE SYSTEM: Factory reset με enterprise confirmation modal
  const handleFactoryResetClick = () => {
    setShowFactoryResetModal(true);
  };

  const handleFactoryResetConfirm = () => {
    if (resetToFactory) {
      resetToFactory();
      console.debug('🏭 [LineSettings] Factory reset confirmed - resetting to ISO/AutoCAD defaults');

      // Close modal
      setShowFactoryResetModal(false);

      // Toast notification για επιτυχία
      notifications.success(
        `🏭 ${t('settings.line.factoryReset.successMessage')}`,
        {
          duration: 5000
        }
      );
    }
  };

  const handleFactoryResetCancel = () => {
    console.debug('🏭 [LineSettings] Factory reset cancelled by user');
    setShowFactoryResetModal(false);

    // Toast notification για ακύρωση
    notifications.info(`❌ ${t('settings.line.factoryReset.cancelMessage')}`);
  };

  // Accordion state management
  const { toggleSection, isOpen } = useAccordion('basic');

  // 🏢 ENTERPRISE: Conditional wrapper detection
  // When contextType exists (preview/completion), component is embedded in SubTabRenderer
  // → No wrapper needed (parent provides styling)
  // When contextType is undefined (general), component is standalone
  // → Semantic <section> wrapper with spacing
  const isEmbedded = Boolean(contextType);

  // 🏢 ENTERPRISE: Content rendered once, wrapper applied conditionally (DRY principle)
  const settingsContent = (
    <>
      {/* Header - Semantic <header> element */}
      {/* 🏢 ENTERPRISE: flex-col layout για να φαίνονται πλήρως τα κείμενα των κουμπιών */}
      <header className={`flex flex-col ${PANEL_LAYOUT.GAP.SM}`}>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{t('settings.line.title')}</h3>
        <nav className={`flex ${PANEL_LAYOUT.GAP.SM}`} aria-label={t('settings.line.actionsAriaLabel')}>
          {/* 🏢 ENTERPRISE: Centralized Button component (variant="secondary") + Lucide icon + Shadcn Tooltip */}
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
          {/* 🏢 ENTERPRISE: Centralized Button component (variant="destructive") + Lucide icon + Shadcn Tooltip */}
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

      {/* 🏢 ENTERPRISE: Enable/Disable Line Display - Centralized Radix Checkbox */}
      {/* 🏢 ADR-011: Using same styling as AccordionSection for visual consistency */}
      <fieldset className={PANEL_LAYOUT.SPACING.GAP_SM}>
        {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.SPACING.MD for container padding */}
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
        {/* 🏢 ENTERPRISE: Warning message - Using semantic colors & PANEL_LAYOUT.ALERT */}
        {!settings.enabled && (
          <aside className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.warning} ${colors.bg.warningSubtle} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md} ${getStatusBorder('warning')}`} role="alert">
            ⚠️ {t('settings.line.disabledWarning')}
          </aside>
        )}
      </fieldset>

      {/* ACCORDION SECTIONS */}
      <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${!settings.enabled ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}` : ''}`}>

        {/* 1. ΠΡΌΤΥΠΑ & ΕΡΓΑΛΕΊΑ */}
        <AccordionSection
          title={t('settings.line.sections.templates')}
          icon={<SwatchIcon className={iconSizes.sm} />}
          isOpen={isOpen('templates')}
          onToggle={() => toggleSection('templates')}
          disabled={!settings.enabled}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* 🏢 ADR-001: Radix Select - Template Quick Select */}
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

        {/* 2. ΒΑΣΙΚΈΣ ΡΥΘΜΊΣΕΙΣ */}
        <AccordionSection
          title={t('settings.line.sections.basic')}
          icon={<SettingsIcon className={iconSizes.sm} />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={!settings.enabled}
          badge={5}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>

        {/* 🏢 ADR-001: Radix Select - Line Type */}
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
              {lineTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Line Width */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.widthValue', { value: settings.lineWidth })}
          </label>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
            <input
              type="range"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.lineWidth}
              onChange={settingsUpdater.createNumberInputHandler('lineWidth', { parseType: 'float' })}
              className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
            />
            <input
              type="number"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.lineWidth}
              onChange={settingsUpdater.createNumberInputHandler('lineWidth', { parseType: 'float' })}
              className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
            />
          </div>
        </div>

        {/* Color - 🏢 ENTERPRISE Color System */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.line.labels.color')}</label>
          <ColorDialogTrigger
            value={settings.color}
            onChange={(color: string) => {
              // ✅ ENTERPRISE: Update general settings (current behavior)
              settingsUpdater.updateSetting('color', color);
              // ✅ ENTERPRISE: Sync to completion settings για σχεδίαση γραμμών
              // Αυτό διασφαλίζει ότι η σχεδιαζόμενη γραμμή χρησιμοποιεί το επιλεγμένο χρώμα
              enterpriseContext.updateSpecificLineSettings('completion', { color });
            }}
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
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.opacityValue', { value: formatPercent(settings.opacity, false) })}
          </label>
          <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
            <input
              type="range"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.opacity}
              onChange={settingsUpdater.createNumberInputHandler('opacity', { parseType: 'float' })}
              className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
            />
            <input
              type="number"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.opacity}
              onChange={settingsUpdater.createNumberInputHandler('opacity', { parseType: 'float' })}
              className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
            />
          </div>
        </div>

        {/* 🏢 ENTERPRISE: Line Break for Text - Centralized Radix Checkbox */}
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

        {/* 3. ΡΥΘΜΊΣΕΙΣ HOVER */}
        <AccordionSection
          title={t('settings.line.sections.hover')}
          icon={<PaintbrushIcon className={iconSizes.sm} />}
          isOpen={isOpen('hover')}
          onToggle={() => toggleSection('hover')}
          disabled={!settings.enabled}
          badge={3}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>

        {/* Hover Color - 🏢 ENTERPRISE Color System */}
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
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.hoverWidthValue', { value: settings.hoverWidth })}
          </label>
          <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
            <input
              type="range"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.hoverWidth}
              onChange={settingsUpdater.createNumberInputHandler('hoverWidth', { parseType: 'float' })}
              className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
            />
            <input
              type="number"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.hoverWidth}
              onChange={settingsUpdater.createNumberInputHandler('hoverWidth', { parseType: 'float' })}
              className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
            />
          </div>
        </div>

        {/* Hover Opacity */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.hoverOpacityValue', { value: formatPercent(settings.hoverOpacity, false) })}
          </label>
          <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
            <input
              type="range"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.hoverOpacity}
              onChange={settingsUpdater.createNumberInputHandler('hoverOpacity', { parseType: 'float' })}
              className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
            />
            <input
              type="number"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.hoverOpacity}
              onChange={settingsUpdater.createNumberInputHandler('hoverOpacity', { parseType: 'float' })}
              className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
            />
          </div>
        </div>
          </div>
        </AccordionSection>

        {/* 4. ΤΕΛΙΚΈΣ ΡΥΘΜΊΣΕΙΣ */}
        <AccordionSection
          title={t('settings.line.sections.final')}
          icon={<CpuChipIcon className={iconSizes.sm} />}
          isOpen={isOpen('final')}
          onToggle={() => toggleSection('final')}
          disabled={!settings.enabled}
          badge={3}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>

        {/* Final Color - 🏢 ENTERPRISE Color System */}
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
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.finalWidthValue', { value: settings.finalWidth })}
          </label>
          <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
            <input
              type="range"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.finalWidth}
              onChange={settingsUpdater.createNumberInputHandler('finalWidth', { parseType: 'float' })}
              className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
            />
            <input
              type="number"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.finalWidth}
              onChange={settingsUpdater.createNumberInputHandler('finalWidth', { parseType: 'float' })}
              className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
            />
          </div>
        </div>

        {/* Final Opacity */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
            {t('settings.line.labels.finalOpacityValue', { value: formatPercent(settings.finalOpacity, false) })}
          </label>
          <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
            <input
              type="range"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.finalOpacity}
              onChange={settingsUpdater.createNumberInputHandler('finalOpacity', { parseType: 'float' })}
              className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
            />
            <input
              type="number"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.finalOpacity}
              onChange={settingsUpdater.createNumberInputHandler('finalOpacity', { parseType: 'float' })}
              className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
            />
          </div>
        </div>
          </div>
        </AccordionSection>

        {/* 5. ΠΡΟΧΩΡΗΜΈΝΕΣ ΡΥΘΜΊΣΕΙΣ */}
        <AccordionSection
          title={t('settings.line.sections.advanced')}
          icon={<AdjustmentsHorizontalIcon className={iconSizes.sm} />}
          isOpen={isOpen('advanced')}
          onToggle={() => toggleSection('advanced')}
          disabled={!settings.enabled}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
          {/* Dash Scale (only for non-solid lines) */}
          {settings.lineType !== 'solid' && (
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.line.labels.dashScaleValue', { value: settings.dashScale })}
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input
                  type="range"
                  min={DASH_SCALE_RANGE.min}
                  max={DASH_SCALE_RANGE.max}
                  step={DASH_SCALE_RANGE.step}
                  value={settings.dashScale}
                  onChange={settingsUpdater.createNumberInputHandler('dashScale', { parseType: 'float' })}
                  className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
                />
                <input
                  type="number"
                  min={DASH_SCALE_RANGE.min}
                  max={DASH_SCALE_RANGE.max}
                  step={DASH_SCALE_RANGE.step}
                  value={settings.dashScale}
                  onChange={settingsUpdater.createNumberInputHandler('dashScale', { parseType: 'float' })}
                  className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
                />
              </div>
            </div>
          )}

          {/* 🏢 ADR-001: Radix Select - Line Cap */}
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

          {/* 🏢 ADR-001: Radix Select - Line Join */}
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
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.line.labels.dashOffsetValue', { value: settings.dashOffset })}
              </label>
              <div className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_MD}`}>
                <input
                  type="range"
                  min={DASH_OFFSET_RANGE.min}
                  max={DASH_OFFSET_RANGE.max}
                  step={DASH_OFFSET_RANGE.step}
                  value={settings.dashOffset}
                  onChange={settingsUpdater.createNumberInputHandler('dashOffset', { parseType: 'float' })}
                  className={`flex-1 ${PANEL_LAYOUT.HEIGHT.SM} ${colors.bg.muted} ${radius.lg} appearance-none ${PANEL_LAYOUT.CURSOR.POINTER}`}
                />
                <input
                  type="number"
                  min={DASH_OFFSET_RANGE.min}
                  max={DASH_OFFSET_RANGE.max}
                  step={DASH_OFFSET_RANGE.step}
                  value={settings.dashOffset}
                  onChange={settingsUpdater.createNumberInputHandler('dashOffset', { parseType: 'float' })}
                  className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
                />
              </div>
            </div>
          )}
          </div>
        </AccordionSection>

      </div>
    </>
  );

  // 🏢 ENTERPRISE: Conditional wrapper pattern (ADR-011 compliance)
  // - Embedded (contextType exists): Fragment renders content directly in parent's container
  // - Standalone (no contextType): Semantic <section> wrapper with spacing
  return (
    <>
      {/* 🏢 ENTERPRISE: Conditional wrapper - Using PANEL_LAYOUT.SPACING */}
      {isEmbedded ? (
        settingsContent
      ) : (
        <section className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${PANEL_LAYOUT.SPACING.LG}`} aria-label={t('settings.line.ariaLabel')}>
          {settingsContent}
        </section>
      )}

      {/* 🆕 ENTERPRISE FACTORY RESET CONFIRMATION MODAL - Always rendered (portal) */}
      <BaseModal
        isOpen={showFactoryResetModal}
        onClose={handleFactoryResetCancel}
        title={`⚠️ ${t('settings.line.factoryReset.title')}`}
        size="md"
        closeOnBackdrop={false}
        zIndex={10000}
      >
        <article className={PANEL_LAYOUT.SPACING.GAP_LG}>
          {/* 🏢 ENTERPRISE: Warning Message - Using semantic error colors */}
          {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.ALERT */}
          <aside className={`${colors.bg.errorSubtle} ${getStatusBorder('error')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="alert">
            <p className={`${colors.text.error} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
              ⚠️ {t('settings.line.factoryReset.warning')}
            </p>
          </aside>

          {/* Loss List */}
          <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
            <p className={`${colors.text.muted} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('settings.line.factoryReset.lossTitle')}</p>
            <ul className={`list-disc list-inside ${PANEL_LAYOUT.SPACING.GAP_XS} ${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
              <li>{t('settings.line.factoryReset.lossList.customSettings')}</li>
              <li>{t('settings.line.factoryReset.lossList.templates')}</li>
              <li>{t('settings.line.factoryReset.lossList.changes')}</li>
            </ul>
          </section>

          {/* 🏢 ENTERPRISE: Reset Info - Using semantic info colors */}
          {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.ALERT */}
          <aside className={`${colors.bg.infoSubtle} ${getStatusBorder('info')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${PANEL_LAYOUT.ALERT.BORDER_RADIUS}`} role="note">
            <p className={`${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
              {t('settings.line.factoryReset.resetInfo')}
            </p>
          </aside>

          {/* Confirmation Question */}
          <p className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-center ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
            {t('settings.line.factoryReset.confirm')}
          </p>

          {/* 🏢 ENTERPRISE: Action Buttons - Using semantic colors */}
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
    </>
  );
}

export default LineSettings;
