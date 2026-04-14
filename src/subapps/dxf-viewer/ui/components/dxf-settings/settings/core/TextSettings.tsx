/**
 * TextSettings Component
 *
 * @description
 * Text settings UI component για Preview mode.
 * Διαχειρίζεται font family, size, color, style (bold/italic/underline/strikethrough/super/sub).
 *
 * @features
 * - 📝 Font system (family, size με ISO 3098 standards)
 * - 🎨 Color picker (με SharedColorPicker)
 * - 🔤 Text decorations (Bold, Italic, Underline, Strikethrough)
 * - 📐 Text positioning (Superscript, Subscript)
 * - 🔄 Accordion sections (Basic/Font/Appearance/Decorations)
 * - ✅ ISO 3098 compliance (Technical drawings text standards)
 *
 * @accordion_sections
 * 1. **Basic Settings** - Font family, Font size
 * 2. **Font Appearance** - Color, Style buttons (B/I/U/S)
 * 3. **Text Decorations** - Underline, Strikethrough
 * 4. **Text Positioning** - Superscript, Subscript
 *
 * @iso_3098_standards
 * - Font: Sans-serif (Arial recommended)
 * - Standard heights: 1.8, 2.5, 3.5, 5, 7, 10, 14, 20 mm
 * - Weight: Normal (400) default, Bold (700) για emphasis
 * - Orientation: Upright (no italic) recommended
 *
 * @usage
 * ```tsx
 * // In EntitiesSettings - Preview tab
 * <TextSettings />
 * ```
 *
 * @see {@link docs/settings-system/05-UI_COMPONENTS.md#textsettings-component} - Full documentation
 * @see {@link docs/settings-system/02-COLORPALETTEPANEL.md} - Parent component
 * @see {@link ui/hooks/useUnifiedSpecificSettings.ts} - useUnifiedTextPreview hook
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2025-10-06
 * @version 1.0.0
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import { RotateCcw, Factory } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTextSettingsFromProvider } from '../../../../../settings-provider';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import { useNotifications } from '../../../../../../../providers/NotificationProvider';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { HOVER_BACKGROUND_EFFECTS } from '../../../../../../../components/ui/effects';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { TEXT_METRICS_RATIOS, UI_TEXT_INPUT_CONSTRAINTS } from '../../../../../config/text-rendering-config';
import { useTranslation } from '@/i18n';
// 🏢 ADR-065: Extracted icons, constants, sub-components, and FactoryResetModal
import {
  DocumentTextIcon, PaintbrushIcon, SparklesIcon, EyeIcon,
  FREE_FONTS, FONT_SIZE_OPTIONS,
  TextStyleButtons, ScriptStyleButtons, FactoryResetModal,
} from './text-settings-helpers';

export function TextSettings({ contextType }: { contextType?: 'preview' | 'completion' }) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, getElementBorder, radius } = useBorderTokens();  // ✅ ENTERPRISE: Added getElementBorder, radius
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);  // 🏢 ENTERPRISE: i18n
  // 🔥 FIX: Use Global Text Settings από provider, ΟΧΙ Preview-specific settings!
  // Το useUnifiedTextPreview() ενημερώνει localStorage 'dxf-text-preview-settings' (WRONG!)
  // Θέλουμε να ενημερώσουμε το 'dxf-text-general-settings' (CORRECT!)
  const { settings: textSettings, updateSettings: updateTextSettings, resetToDefaults, resetToFactory } = useTextSettingsFromProvider();

  // Notifications for factory reset feedback
  const notifications = useNotifications();

  // Factory reset modal state
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  // Accordion state management
  const { toggleSection, isOpen } = useAccordion('basic');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // 🏢 ENTERPRISE: Removed ~150 lines of duplicate dropdown code
  // Now using EnterpriseComboBox with built-in search, positioning, ARIA, etc.

  // Handlers

  const toggleTextStyle = (style: keyof Pick<typeof textSettings, 'isBold' | 'isItalic' | 'isUnderline' | 'isStrikethrough'>) => {
    updateTextSettings({ [style]: !textSettings[style] });
  };

  const handleScriptChange = (scriptType: 'superscript' | 'subscript') => {
    if (scriptType === 'superscript') {
      updateTextSettings({
        isSuperscript: !textSettings.isSuperscript,
        isSubscript: false
      });
    } else {
      updateTextSettings({
        isSubscript: !textSettings.isSubscript,
        isSuperscript: false
      });
    }
  };

  const handleColorChange = (color: string) => {
    updateTextSettings({ color });
  };

  const increaseFontSize = () => {
    // 🏢 ADR-141: Centralized UI text input constraints
    const newSize = Math.min(UI_TEXT_INPUT_CONSTRAINTS.FONT_SIZE_MAX, textSettings.fontSize + 1);
    updateTextSettings({ fontSize: newSize });
  };

  const decreaseFontSize = () => {
    // 🏢 ADR-141: Centralized UI text input constraints
    const newSize = Math.max(UI_TEXT_INPUT_CONSTRAINTS.FONT_SIZE_MIN, textSettings.fontSize - 1);
    updateTextSettings({ fontSize: newSize });
  };

  // Factory reset handlers
  const handleFactoryResetClick = () => {
    setShowFactoryResetModal(true);
  };

  const handleFactoryResetConfirm = () => {
    if (resetToFactory) {
      resetToFactory();
      console.debug('🏭 [TextSettings] Factory reset confirmed - resetting to ISO 3098 defaults');

      // Close modal
      setShowFactoryResetModal(false);

      // Toast notification για επιτυχία
      notifications.success(
        `🏭 ${t('settings.text.factoryReset.successMessage')}`,
        {
          duration: 5000
        }
      );
    }
  };

  const handleFactoryResetCancel = () => {
    console.debug('🏭 [TextSettings] Factory reset cancelled by user');
    setShowFactoryResetModal(false);

    // Toast notification για ακύρωση
    notifications.info(`❌ ${t('settings.text.factoryReset.cancelMessage')}`);
  };

  // Generate preview text style
  const getPreviewStyle = (): React.CSSProperties => {
    // 🏢 ADR-107: Use centralized text metrics ratio for script size
    const baseFontSize = textSettings.isSuperscript || textSettings.isSubscript
      ? textSettings.fontSize * TEXT_METRICS_RATIOS.SCRIPT_SIZE_RATIO
      : textSettings.fontSize;

    return {
      fontFamily: textSettings.fontFamily,
      fontSize: `${baseFontSize}px`,
      fontWeight: textSettings.isBold ? 'bold' : 'normal',
      fontStyle: textSettings.isItalic ? 'italic' : 'normal',
      textDecoration: [
        textSettings.isUnderline ? 'underline' : '',
        textSettings.isStrikethrough ? 'line-through' : ''
      ].filter(Boolean).join(' ') || 'none',
      color: textSettings.color,
      position: textSettings.isSuperscript || textSettings.isSubscript ? 'relative' : 'static',
      top: textSettings.isSuperscript ? '-0.5em' : textSettings.isSubscript ? '0.5em' : '0'
    };
  };

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
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary}`}>{t('settings.text.title')}</h3>
        <nav className={`flex ${PANEL_LAYOUT.GAP.SM}`} aria-label={t('settings.text.actionsAriaLabel')}>
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
                {t('settings.text.reset')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings.text.resetTitle')}</TooltipContent>
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
                {t('settings.text.factory')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings.text.factoryTitle')}</TooltipContent>
          </Tooltip>
        </nav>
      </header>

      {/* 🏢 ENTERPRISE: Enable/Disable Text Display - Centralized Radix Checkbox */}
      {/* 🏢 ADR-011: Using same styling as AccordionSection for visual consistency */}
      <fieldset className={PANEL_LAYOUT.SPACING.GAP_SM}>
        {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.SPACING.MD */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD} ${PANEL_LAYOUT.SPACING.MD} ${colors.bg.secondary} ${getElementBorder('card', 'default')} ${radius.lg}`}>
          <Checkbox
            id="text-enabled"
            checked={textSettings.enabled}
            onCheckedChange={(checked) => updateTextSettings({ enabled: checked === true })}
          />
          <label
            htmlFor="text-enabled"
            className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.CURSOR.POINTER} ${textSettings.enabled ? colors.text.primary : colors.text.muted}`}
          >
            {t('settings.text.enabled')}
          </label>
        </div>
        {/* 🏢 ENTERPRISE: Warning message - Using PANEL_LAYOUT.ALERT */}
        {!textSettings.enabled && (
          <aside className={`${PANEL_LAYOUT.ALERT.TEXT_SIZE} ${colors.text.warning} ${colors.bg.warningSubtle} ${PANEL_LAYOUT.ALERT.PADDING} ${radius.md} ${getStatusBorder('warning')}`} role="alert">
            ⚠️ {t('settings.text.disabledWarning')}
          </aside>
        )}
      </fieldset>

      {/* ACCORDION SECTIONS */}
      <div className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${!textSettings.enabled ? `${PANEL_LAYOUT.OPACITY['50']} ${PANEL_LAYOUT.POINTER_EVENTS.NONE}` : ''}`}>

        {/* 1. ΒΑΣΙΚΕΣ ΡΥΘΜΙΣΕΙΣ ΚΕΙΜΕΝΟΥ */}
        <AccordionSection
          title={t('settings.text.sections.basic')}
          icon={<DocumentTextIcon className={iconSizes.sm} />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={!textSettings.enabled}
          badge={4}
          className={PANEL_LAYOUT.OVERFLOW.VISIBLE}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* 🏢 ADR-001: Radix Select - Font Family */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.text.labels.fontFamily')}
              </label>
              <Select
                value={textSettings.fontFamily}
                onValueChange={(fontFamily) => updateTextSettings({ fontFamily })}
              >
                <SelectTrigger className={`w-full ${colors.bg.secondary}`}>
                  <SelectValue placeholder={t('settings.text.labels.searchFonts')} />
                </SelectTrigger>
                <SelectContent>
                  {FREE_FONTS.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      <span style={{ fontFamily: font.value }}>{font.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 🏢 ADR-001: Radix Select - Font Size with +/- controls */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
                {t('settings.text.labels.fontSize')}
              </label>
              <div className={`flex ${PANEL_LAYOUT.GAP.SM}`}>
                <div className="flex-1">
                  <Select
                    value={textSettings.fontSize.toString()}
                    onValueChange={(value) => updateTextSettings({ fontSize: parseInt(value, 10) })}
                  >
                    <SelectTrigger className={`w-full ${colors.bg.secondary}`}>
                      <SelectValue placeholder={t('settings.text.labels.searchSize')} />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Size Increase/Decrease Controls */}
                <div className={`flex ${PANEL_LAYOUT.GAP.XS} items-end`}>
                  {/* Increase Font Size - Big A with up arrow + Shadcn Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={increaseFontSize}
                        className={`${PANEL_LAYOUT.ICON.BUTTON_SM} ${colors.bg.hover} ${quick.button} ${colors.text.primary} ${HOVER_BACKGROUND_EFFECTS.DARKER} ${PANEL_LAYOUT.TRANSITION.COLORS} flex items-center justify-center`}
                      >
                        <div className="flex items-center">
                          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.BASE} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>A</span>
                          <svg className={`${iconSizes.xs} ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                          </svg>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('settings.text.labels.increaseFontSize')}</TooltipContent>
                  </Tooltip>

                  {/* Decrease Font Size - Small A with down arrow + Shadcn Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={decreaseFontSize}
                        className={`${PANEL_LAYOUT.ICON.BUTTON_SM} ${colors.bg.hover} ${quick.button} ${colors.text.primary} ${HOVER_BACKGROUND_EFFECTS.DARKER} ${PANEL_LAYOUT.TRANSITION.COLORS} flex items-center justify-center`}
                      >
                        <div className="flex items-center">
                          <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD}`}>A</span>
                          <svg className={`${iconSizes.xs} ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t('settings.text.labels.decreaseFontSize')}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

      {/* Text Color */}
      <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
        <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>{t('settings.text.labels.color')}</label>
        <ColorDialogTrigger
          value={textSettings.color}
          onChange={handleColorChange}
          label={textSettings.color}
          title={t('settings.text.colorPicker.text')}
          alpha={false}
          modes={['hex', 'rgb', 'hsl']}
          palettes={['dxf', 'semantic', 'material']}
          recent
          eyedropper
        />
      </div>
        </div>
        </AccordionSection>

        {/* 2. ΣΤΥΛ ΚΕΙΜΕΝΟΥ */}
        <AccordionSection
          title={t('settings.text.sections.style')}
          icon={<PaintbrushIcon className={iconSizes.sm} />}
          isOpen={isOpen('style')}
          onToggle={() => toggleSection('style')}
          disabled={!textSettings.enabled}
          badge={4}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* Text Style Toggles */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted}`}>
                {t('settings.text.labels.textStyle')}
              </label>
              <TextStyleButtons
                settings={textSettings}
                onToggle={toggleTextStyle}
              />
            </div>
          </div>
        </AccordionSection>

        {/* 3. ΠΡΟΧΩΡΗΜΕΝΑ ΕΦΕ */}
        <AccordionSection
          title={t('settings.text.sections.advanced')}
          icon={<SparklesIcon className={iconSizes.sm} />}
          isOpen={isOpen('advanced')}
          onToggle={() => toggleSection('advanced')}
          disabled={!textSettings.enabled}
          badge={2}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* Script Toggles */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted}`}>{t('settings.text.labels.scriptStyle')}</label>
              <ScriptStyleButtons
                settings={textSettings}
                onSuperscriptChange={() => handleScriptChange('superscript')}
                onSubscriptChange={() => handleScriptChange('subscript')}
              />
            </div>
          </div>
        </AccordionSection>

        {/* 4. ΠΡΟΕΠΙΣΚΟΠΗΣΗ & ΠΛΗΡΟΦΟΡΙΕΣ */}
        <AccordionSection
          title={t('settings.text.sections.preview')}
          icon={<EyeIcon className={iconSizes.sm} />}
          isOpen={isOpen('preview')}
          onToggle={() => toggleSection('preview')}
          disabled={!textSettings.enabled}
        >
          <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
            {/* Live Preview */}
            <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
              <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.muted}`}>
                {t('settings.text.labels.preview')}
              </label>
              {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.SPACING.LG */}
              <div className={`${PANEL_LAYOUT.SPACING.LG} ${colors.bg.primary} ${quick.card}`}>
                <div style={getPreviewStyle()}>
                  {t('settings.text.labels.previewText')}
                </div>
              </div>
            </div>

            {/* Settings Summary */}
            {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.SPACING.SM */}
            <div className={`${PANEL_LAYOUT.SPACING.SM} ${colors.bg.hover} ${quick.card} ${getDirectionalBorder('success', 'left')} ${PANEL_LAYOUT.MARGIN.TOP_LG}`}>
              <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
                <div><strong>{FREE_FONTS.find(f => f.value === textSettings.fontFamily)?.label}</strong>, {textSettings.fontSize}pt</div>
                <div>{[
                  textSettings.isBold && t('settings.text.styles.bold'),
                  textSettings.isItalic && t('settings.text.styles.italic'),
                  textSettings.isUnderline && t('settings.text.styles.underline'),
                  textSettings.isStrikethrough && t('settings.text.styles.strikethrough'),
                  textSettings.isSuperscript && t('settings.text.styles.superscript'),
                  textSettings.isSubscript && t('settings.text.styles.subscript')
                ].filter(Boolean).join(', ') || t('settings.text.styles.normal')} • {textSettings.color}</div>
              </div>
            </div>
          </div>
        </AccordionSection>

      </div> {/* Κλείσιμο accordion wrapper */}
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
        <section className={`${PANEL_LAYOUT.SPACING.GAP_LG} ${PANEL_LAYOUT.SPACING.LG}`} aria-label={t('settings.text.ariaLabel')}>
          {settingsContent}
        </section>
      )}

      {/* 🏢 ADR-065: Factory Reset Modal extracted to text-settings-helpers.tsx */}
      <FactoryResetModal
        isOpen={showFactoryResetModal}
        onConfirm={handleFactoryResetConfirm}
        onCancel={handleFactoryResetCancel}
      />
    </>
  );
}
