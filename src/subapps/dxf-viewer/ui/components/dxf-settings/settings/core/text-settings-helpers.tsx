/**
 * Helper components and constants for TextSettings
 * Extracted per ADR-065 (file size limit: max 500 lines)
 */

'use client';

import * as React from 'react';
import { Factory } from 'lucide-react';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { TextSettings as TextSettingsType } from '../../../../../contexts/TextSettingsContext';
import { BaseModal } from '../../../../../components/shared/BaseModal';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { useTranslation } from '@/i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// SVG ICONS
// ============================================================================

export const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

export const PaintbrushIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3V1M13 7l6-6M17 11l6-6" />
  </svg>
);

export const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

export const EyeIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

// ============================================================================
// CONSTANTS
// ============================================================================

// 🏢 ADR-001: Font options for Radix Select
export const FREE_FONTS = [
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
export const FONT_SIZE_OPTIONS = FONT_SIZES_RAW.map(size => ({
  value: size.toString(),
  label: `${size}px`,
  numericValue: size
}));

export const TEXT_LABELS = {
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

export const TEXT_STYLE_BUTTONS = [
  { key: 'isBold' as const, label: 'B', title: 'Bold' },
  { key: 'isItalic' as const, label: 'I', title: 'Italic' },
  { key: 'isUnderline' as const, label: 'U', title: 'Underline' },
  { key: 'isStrikethrough' as const, label: 'S', title: 'Strikethrough' }
] as const;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface TextStyleButtonsProps {
  settings: TextSettingsType;
  onToggle: (key: 'isBold' | 'isItalic' | 'isUnderline' | 'isStrikethrough') => void;
}

export function TextStyleButtons({ settings, onToggle }: TextStyleButtonsProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

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

export function ScriptStyleButtons({ settings, onSuperscriptChange, onSubscriptChange }: ScriptStyleButtonsProps) {
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

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

// ============================================================================
// FACTORY RESET MODAL
// ============================================================================

interface FactoryResetModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FactoryResetModal({ isOpen, onConfirm, onCancel }: FactoryResetModalProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title={`⚠️ ${t('settings.text.factoryReset.title')}`}
      size="md"
      closeOnBackdrop={false}
      zIndex={10000}
    >
      <article className={PANEL_LAYOUT.SPACING.GAP_LG}>
        {/* Warning */}
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

        {/* Info */}
        <aside className={`${colors.bg.infoSubtle} ${getStatusBorder('info')} ${PANEL_LAYOUT.ALERT.PADDING_LG} ${radius.md}`} role="note">
          <p className={`${colors.text.info} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
            {t('settings.text.factoryReset.resetInfo')}
          </p>
        </aside>

        {/* Confirmation */}
        <p className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} text-center ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
          {t('settings.text.factoryReset.confirm')}
        </p>

        {/* Action Buttons */}
        <footer className={`flex ${PANEL_LAYOUT.GAP.MD} justify-end ${PANEL_LAYOUT.PADDING.TOP_LG} ${quick.separator}`}>
          <button
            onClick={onCancel}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT} ${colors.text.primary} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            {t('settings.text.factoryReset.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.bg.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ${colors.text.primary} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} flex items-center ${PANEL_LAYOUT.GAP.XS}`}
          >
            <Factory className={iconSizes.xs} />
            {t('settings.text.factoryReset.confirmButton')}
          </button>
        </footer>
      </article>
    </BaseModal>
  );
}
