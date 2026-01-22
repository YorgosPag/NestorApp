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
import { Factory, RotateCcw } from 'lucide-react';  // 🏢 ENTERPRISE: Centralized Lucide icons
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTextSettingsFromProvider } from '../../../../../settings-provider';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import type { TextSettings as TextSettingsType } from '../../../../../contexts/TextSettingsContext';
import { BaseModal } from '../../../../../components/shared/BaseModal';
import { useNotifications } from '../../../../../../../providers/NotificationProvider';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
// 🏢 ADR-001: Radix Select is the ONLY canonical dropdown component
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// 🏢 ENTERPRISE: Centralized Checkbox component (Radix)
import { Checkbox } from '@/components/ui/checkbox';
// 🏢 ENTERPRISE: Centralized Button component (Radix)
import { Button } from '@/components/ui/button';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';
import { layoutUtilities } from '../../../../../../../styles/design-tokens';
// 🏢 ENTERPRISE: Import centralized panel spacing (Single Source of Truth)
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from 'react-i18next';
// 🏢 ENTERPRISE: Shadcn Tooltip component
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Simple SVG icons for text
const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PaintbrushIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3V1M13 7l6-6M17 11l6-6" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

// 🏢 ADR-001: Font options for Radix Select
const FREE_FONTS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Monaco, monospace', label: 'Monaco' },
  { value: 'Consolas, monospace', label: 'Consolas' },
  { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Lucida Console, monospace', label: 'Lucida Console' },
  { value: 'Palatino, serif', label: 'Palatino' },
  { value: 'Garamond, serif', label: 'Garamond' }
];

const FONT_SIZES_RAW = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

// 🏢 ADR-001: Font size options for Radix Select
const FONT_SIZE_OPTIONS = FONT_SIZES_RAW.map(size => ({
  value: size.toString(), // Radix Select requires string values
  label: `${size}px`,
  numericValue: size
}));

const TEXT_LABELS = {
  PREVIEW: 'Προεπισκόπηση',
  PREVIEW_TEXT: 'Άδραξε τη μέρα',
  FONT_FAMILY: 'Γραμματοσειρά',
  FONT_SIZE: 'Μέγεθος Γραμματοσειράς',
  FONT_SIZE_UNIT: 'pt',
  TEXT_STYLE: 'Στυλ Κειμένου',
  SCRIPT_STYLE: 'Εκθέτης / Δείκτης',
  TEXT_COLOR: 'Χρώμα Κειμένου',
  COLOR: 'Χρώμα',
  SEARCH_FONTS: 'Αναζήτηση γραμματοσειράς...',
  SEARCH_SIZE: 'Αναζήτηση μεγέθους...',
  NO_FONTS_FOUND: 'Δεν βρέθηκαν γραμματοσειρές',
  NO_SIZES_FOUND: 'Δεν βρέθηκαν μεγέθη',
  CUSTOM_SIZE: 'προσαρμοσμένο',
  RESET_TO_GLOBAL: '🔄 Reset to Global Settings',
  OVERRIDE_GLOBAL: 'Override Global Settings'
};

// Mock style button configurations
const TEXT_STYLE_BUTTONS = [
  { key: 'isBold' as const, label: 'B', title: 'Bold' },
  { key: 'isItalic' as const, label: 'I', title: 'Italic' },
  { key: 'isUnderline' as const, label: 'U', title: 'Underline' },
  { key: 'isStrikethrough' as const, label: 'S', title: 'Strikethrough' }
] as const;

// Mock components that match the UI of dxf-viewer-kalo
interface TextStyleButtonsProps {
  settings: TextSettingsType;
  onToggle: (key: 'isBold' | 'isItalic' | 'isUnderline' | 'isStrikethrough') => void;
}

function TextStyleButtons({ settings, onToggle }: TextStyleButtonsProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors(); // ✅ ENTERPRISE FIX: Add missing colors hook

  return (
    <div className={`flex flex-wrap ${PANEL_LAYOUT.GAP.XS}`}>
      {TEXT_STYLE_BUTTONS.map((style) => (
        <Tooltip key={style.key}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToggle(style.key)}
              className={`${iconSizes.xl} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.BOLD} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
                settings[style.key]
                  ? `${colors.bg.success} ${getStatusBorder('success')} ${colors.text.inverted}`
                  : `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${quick.button} ${colors.text.muted}`
              }`}
            >
              {style.label}
            </button>
          </TooltipTrigger>
          <TooltipContent>{style.title}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

interface ScriptStyleButtonsProps {
  settings: TextSettingsType;
  onSuperscriptChange: () => void;
  onSubscriptChange: () => void;
}

function ScriptStyleButtons({ settings, onSuperscriptChange, onSubscriptChange }: ScriptStyleButtonsProps) {
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors(); // ✅ ENTERPRISE FIX: Add missing colors hook

  // 🏢 ENTERPRISE: Using PANEL_LAYOUT.BUTTON.PADDING_COMPACT for consistent button spacing
  return (
    <div className={`flex ${PANEL_LAYOUT.GAP.XS}`}>
      <button
        onClick={onSuperscriptChange}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
          settings.isSuperscript
            ? `${colors.bg.success} ${getStatusBorder('success')} ${colors.text.inverted}`
            : `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${getStatusBorder('muted')} ${colors.text.muted}`
        }`}
      >
        X<sup>2</sup>
      </button>
      <button
        onClick={onSubscriptChange}
        className={`${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${
          settings.isSubscript
            ? `${colors.bg.success} ${getStatusBorder('success')} ${colors.text.inverted}`
            : `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${getStatusBorder('muted')} ${colors.text.muted}`
        }`}
      >
        X<sub>2</sub>
      </button>
    </div>
  );
}

export function TextSettings({ contextType }: { contextType?: 'preview' | 'completion' }) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, getElementBorder, radius } = useBorderTokens();  // ✅ ENTERPRISE: Added getElementBorder, radius
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer');  // 🏢 ENTERPRISE: i18n
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
    const newSize = Math.min(200, textSettings.fontSize + 1);
    updateTextSettings({ fontSize: newSize });
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(6, textSettings.fontSize - 1);
    updateTextSettings({ fontSize: newSize });
  };

  // Factory reset handlers
  const handleFactoryResetClick = () => {
    setShowFactoryResetModal(true);
  };

  const handleFactoryResetConfirm = () => {
    if (resetToFactory) {
      resetToFactory();
      console.log('🏭 [TextSettings] Factory reset confirmed - resetting to ISO 3098 defaults');

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
    console.log('🏭 [TextSettings] Factory reset cancelled by user');
    setShowFactoryResetModal(false);

    // Toast notification για ακύρωση
    notifications.info(`❌ ${t('settings.text.factoryReset.cancelMessage')}`);
  };

  // Generate preview text style
  const getPreviewStyle = (): React.CSSProperties => {
    // ✅ ENTERPRISE FIX: Removed duplicate fontSize property
    const baseFontSize = textSettings.isSuperscript || textSettings.isSubscript
      ? textSettings.fontSize * 0.75
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
          recent={true}
          eyedropper={true}
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

      {/* 🆕 ENTERPRISE FACTORY RESET CONFIRMATION MODAL - Always rendered (portal) */}
      <BaseModal
        isOpen={showFactoryResetModal}
        onClose={handleFactoryResetCancel}
        title={`⚠️ ${t('settings.text.factoryReset.title')}`}
        size="md"
        closeOnBackdrop={false}
        zIndex={10000}
      >
        <article className={PANEL_LAYOUT.SPACING.GAP_LG}>
          {/* 🏢 ENTERPRISE: Warning Message - Using semantic colors */}
          {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.ALERT */}
          <aside className={`${colors.bg.errorSubtle} ${getStatusBorder('error')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${radius.md}`} role="alert">
            <p className={`${colors.text.error} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
              ⚠️ {t('settings.text.factoryReset.warning')}
            </p>
          </aside>

          {/* Loss List */}
          <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
            <p className={`${colors.text.muted} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{t('settings.text.factoryReset.lossTitle')}</p>
            <ul className={`list-disc list-inside ${PANEL_LAYOUT.SPACING.GAP_XS} ${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
              <li>{t('settings.text.factoryReset.lossList.customSettings')}</li>
              <li>{t('settings.text.factoryReset.lossList.templates')}</li>
              <li>{t('settings.text.factoryReset.lossList.changes')}</li>
            </ul>
          </section>

          {/* 🏢 ENTERPRISE: Reset Info - Using semantic colors */}
          {/* 🏢 ENTERPRISE: Using PANEL_LAYOUT.ALERT */}
          <aside className={`${colors.bg.infoSubtle} ${getStatusBorder('info')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${radius.md}`} role="note">
            <p className={`${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
              {t('settings.text.factoryReset.resetInfo')}
            </p>
          </aside>

          {/* Confirmation Question */}
          <p className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-center ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
            {t('settings.text.factoryReset.confirm')}
          </p>

          {/* 🏢 ENTERPRISE: Action Buttons - Using semantic colors */}
          <footer className={`flex ${PANEL_LAYOUT.GAP.MD} justify-end ${PANEL_LAYOUT.PADDING.TOP_LG} ${quick.separator}`}>
            <button
              onClick={handleFactoryResetCancel}
              className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.primary} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
            >
              {t('settings.text.factoryReset.cancel')}
            </button>
            <button
              onClick={handleFactoryResetConfirm}
              className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ${colors.text.primary} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
            >
              <Factory className={iconSizes.xs} />
              {t('settings.text.factoryReset.confirmButton')}
            </button>
          </footer>
        </article>
      </BaseModal>
    </>
  );
}