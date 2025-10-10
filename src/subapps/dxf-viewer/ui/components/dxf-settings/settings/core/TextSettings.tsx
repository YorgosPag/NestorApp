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

import React, { useState } from 'react';
import { useTextSettingsFromProvider } from '../../../../../settings-provider';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import type { TextSettings } from '../../../../contexts/TextSettingsContext';
import { BaseModal } from '../../../../../components/shared/BaseModal';
import { useNotifications } from '../../../../../../../providers/NotificationProvider';
import { EnterpriseComboBox, type ComboBoxOption } from '../shared/EnterpriseComboBox';

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

// 🏢 ENTERPRISE: Typed options for EnterpriseComboBox
const FREE_FONTS: ComboBoxOption<string>[] = [
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

// 🏢 ENTERPRISE: Typed options for Font Size ComboBox
const FONT_SIZE_OPTIONS: ComboBoxOption<number>[] = FONT_SIZES_RAW.map(size => ({
  value: size,
  label: `${size}px`
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
  settings: TextSettings;
  onToggle: (key: 'isBold' | 'isItalic' | 'isUnderline' | 'isStrikethrough') => void;
}

function TextStyleButtons({ settings, onToggle }: TextStyleButtonsProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {TEXT_STYLE_BUTTONS.map((style) => (
        <button
          key={style.key}
          onClick={() => onToggle(style.key)}
          title={style.title}
          className={`w-8 h-8 text-sm font-bold rounded border transition-colors ${
            settings[style.key]
              ? 'bg-green-600 border-green-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300'
          }`}
          style={{
            fontWeight: style.key === 'isBold' ? 'bold' : 'normal',
            fontStyle: style.key === 'isItalic' ? 'italic' : 'normal',
            textDecoration:
              style.key === 'isUnderline' ? 'underline' :
              style.key === 'isStrikethrough' ? 'line-through' : 'none'
          }}
        >
          {style.label}
        </button>
      ))}
    </div>
  );
}

interface ScriptStyleButtonsProps {
  settings: TextSettings;
  onSuperscriptChange: () => void;
  onSubscriptChange: () => void;
}

function ScriptStyleButtons({ settings, onSuperscriptChange, onSubscriptChange }: ScriptStyleButtonsProps) {
  return (
    <div className="flex gap-1">
      <button
        onClick={onSuperscriptChange}
        className={`px-3 py-1 text-sm rounded border transition-colors ${
          settings.isSuperscript
            ? 'bg-green-600 border-green-500 text-white'
            : 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300'
        }`}
      >
        X<sup>2</sup>
      </button>
      <button
        onClick={onSubscriptChange}
        className={`px-3 py-1 text-sm rounded border transition-colors ${
          settings.isSubscript
            ? 'bg-green-600 border-green-500 text-white'
            : 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300'
        }`}
      >
        X<sub>2</sub>
      </button>
    </div>
  );
}

export function TextSettings() {
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
        '🏭 Εργοστασιακές ρυθμίσεις επαναφέρθηκαν!',
        {
          description: 'Όλες οι ρυθμίσεις κειμένου επέστρεψαν στα πρότυπα ISO 3098.',
          duration: 5000
        }
      );
    }
  };

  const handleFactoryResetCancel = () => {
    console.log('🏭 [TextSettings] Factory reset cancelled by user');
    setShowFactoryResetModal(false);

    // Toast notification για ακύρωση
    notifications.info('❌ Ακυρώθηκε η επαναφορά εργοστασιακών ρυθμίσεων');
  };

  // Generate preview text style
  const getPreviewStyle = (): React.CSSProperties => {
    return {
      fontFamily: textSettings.fontFamily,
      fontSize: `${textSettings.fontSize}px`,
      fontWeight: textSettings.isBold ? 'bold' : 'normal',
      fontStyle: textSettings.isItalic ? 'italic' : 'normal',
      textDecoration: [
        textSettings.isUnderline ? 'underline' : '',
        textSettings.isStrikethrough ? 'line-through' : ''
      ].filter(Boolean).join(' ') || 'none',
      color: textSettings.color,
      position: textSettings.isSuperscript || textSettings.isSubscript ? 'relative' : 'static',
      top: textSettings.isSuperscript ? '-0.5em' : textSettings.isSubscript ? '0.5em' : '0',
      fontSize: textSettings.isSuperscript || textSettings.isSubscript
        ? `${textSettings.fontSize * 0.75}px`
        : `${textSettings.fontSize}px`
    };
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Ρυθμίσεις Κειμένου</h3>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            title="Επαναφορά στις προεπιλεγμένες ρυθμίσεις"
          >
            Επαναφορά
          </button>
          {resetToFactory && (
            <button
              onClick={handleFactoryResetClick}
              className="px-3 py-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded transition-colors font-semibold"
              title="Επαναφορά στις εργοστασιακές ρυθμίσεις (ISO 3098)"
            >
              🏭 Εργοστασιακές
            </button>
          )}
        </div>
      </div>

      {/* Enable/Disable Text Display */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-md border-l-4 border-blue-500">
          <input
            type="checkbox"
            id="text-enabled"
            checked={textSettings.enabled}
            onChange={(e) => updateTextSettings({ enabled: e.target.checked })}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label
            htmlFor="text-enabled"
            className={`text-sm font-medium ${textSettings.enabled ? 'text-white' : 'text-gray-400'}`}
          >
            Εμφάνιση κειμένου απόστασης
          </label>
        </div>
        {!textSettings.enabled && (
          <div className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 p-2 rounded border border-yellow-700">
            ⚠️ Το κείμενο απόστασης είναι απενεργοποιημένο και δεν θα εμφανίζεται στην προσχεδίαση
          </div>
        )}
      </div>

      {/* ACCORDION SECTIONS */}
      <div className={`space-y-4 ${!textSettings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* 1. ΒΑΣΙΚΕΣ ΡΥΘΜΙΣΕΙΣ ΚΕΙΜΕΝΟΥ */}
        <AccordionSection
          title="Βασικές Ρυθμίσεις Κειμένου"
          icon={<DocumentTextIcon className="w-4 h-4" />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={!textSettings.enabled}
          badge={4}
          className="overflow-visible"
        >
          <div className="space-y-4">
            {/* 🏢 ENTERPRISE: Font Family ComboBox */}
            <EnterpriseComboBox
              label={TEXT_LABELS.FONT_FAMILY}
              value={textSettings.fontFamily}
              options={FREE_FONTS}
              onChange={(fontFamily) => updateTextSettings({ fontFamily })}
              enableTypeahead={true}
              placeholder={TEXT_LABELS.SEARCH_FONTS}
              buttonClassName="text-sm"
            />

            {/* 🏢 ENTERPRISE: Font Size ComboBox with +/- controls */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <EnterpriseComboBox
                    label={TEXT_LABELS.FONT_SIZE}
                    value={textSettings.fontSize}
                    options={FONT_SIZE_OPTIONS}
                    onChange={(fontSize) => updateTextSettings({ fontSize })}
                    enableTypeahead={true}
                    placeholder={TEXT_LABELS.SEARCH_SIZE}
                    buttonClassName="text-sm"
                    getDisplayValue={(val) => `${val}pt`}
                  />
                </div>

                {/* Font Size Increase/Decrease Controls */}
                <div className="flex gap-1 items-end">
                  {/* Increase Font Size - Big A with up arrow */}
                  <button
                    onClick={increaseFontSize}
                    className="w-10 h-9 bg-gray-700 border border-gray-500 rounded text-white hover:bg-gray-600 transition-colors flex items-center justify-center"
                    title="Αύξηση μεγέθους γραμματοσειράς"
                  >
                    <div className="flex items-center">
                      <span className="text-base font-bold">A</span>
                      <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                      </svg>
                    </div>
                  </button>

                  {/* Decrease Font Size - Small A with down arrow */}
                  <button
                    onClick={decreaseFontSize}
                    className="w-10 h-9 bg-gray-700 border border-gray-500 rounded text-white hover:bg-gray-600 transition-colors flex items-center justify-center"
                    title="Μείωση μεγέθους γραμματοσειράς"
                  >
                    <div className="flex items-center">
                      <span className="text-xs font-bold">A</span>
                      <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                </div>
              </div>
            </div>

      {/* Text Color */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Χρώμα Κειμένου
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={textSettings.color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-10 h-8 bg-gray-700 border border-gray-600 rounded cursor-pointer"
          />
          <input
            type="text"
            value={textSettings.color.toUpperCase()}
            onChange={(e) => handleColorChange(e.target.value)}
            className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            placeholder="#000000"
          />
            </div>
          </div>
        </div>
        </AccordionSection>

        {/* 2. ΣΤΥΛ ΚΕΙΜΕΝΟΥ */}
        <AccordionSection
          title="Στυλ Κειμένου"
          icon={<PaintbrushIcon className="w-4 h-4" />}
          isOpen={isOpen('style')}
          onToggle={() => toggleSection('style')}
          disabled={!textSettings.enabled}
          badge={4}
        >
          <div className="space-y-4">
            {/* Text Style Toggles */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                {TEXT_LABELS.TEXT_STYLE}
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
          title="Προχωρημένα Εφέ"
          icon={<SparklesIcon className="w-4 h-4" />}
          isOpen={isOpen('advanced')}
          onToggle={() => toggleSection('advanced')}
          disabled={!textSettings.enabled}
          badge={2}
        >
          <div className="space-y-4">
            {/* Script Toggles */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">{TEXT_LABELS.SCRIPT_STYLE}</label>
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
          title="Προεπισκόπηση & Πληροφορίες"
          icon={<EyeIcon className="w-4 h-4" />}
          isOpen={isOpen('preview')}
          onToggle={() => toggleSection('preview')}
          disabled={!textSettings.enabled}
        >
          <div className="space-y-4">
            {/* Live Preview */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                {TEXT_LABELS.PREVIEW}
              </label>
              <div className="p-4 bg-white border border-gray-600 rounded-md">
                <div style={getPreviewStyle()}>
                  {TEXT_LABELS.PREVIEW_TEXT}
                </div>
              </div>
            </div>

            {/* Settings Summary */}
            <div className="p-2 bg-gray-700 rounded border-l-4 border-green-500 mt-4">
              <div className="text-xs text-gray-400 space-y-1">
                <div><strong>{FREE_FONTS.find(f => f.value === textSettings.fontFamily)?.label}</strong>, {textSettings.fontSize}pt</div>
                <div>{[
                  textSettings.isBold && 'Έντονα',
                  textSettings.isItalic && 'Πλάγια',
                  textSettings.isUnderline && 'Υπογραμμισμένα',
                  textSettings.isStrikethrough && 'Διαγραμμισμένα',
                  textSettings.isSuperscript && 'Εκθέτης',
                  textSettings.isSubscript && 'Δείκτης'
                ].filter(Boolean).join(', ') || 'Κανονικά'} • {textSettings.color}</div>
              </div>
            </div>
          </div>
        </AccordionSection>

      </div> {/* Κλείσιμο accordion wrapper */}

      {/* 🆕 ENTERPRISE FACTORY RESET CONFIRMATION MODAL */}
      <BaseModal
        isOpen={showFactoryResetModal}
        onClose={handleFactoryResetCancel}
        title="⚠️ Επαναφορά Εργοστασιακών Ρυθμίσεων"
        size="md"
        closeOnBackdrop={false}
        zIndex={10000}
      >
        <div className="space-y-4">
          {/* Warning Message */}
          <div className="bg-red-900 bg-opacity-20 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-200 font-semibold mb-2">
              ⚠️ ΠΡΟΕΙΔΟΠΟΙΗΣΗ: Θα χάσετε ΟΛΑ τα δεδομένα σας!
            </p>
          </div>

          {/* Loss List */}
          <div className="space-y-2">
            <p className="text-gray-300 font-medium">Θα χάσετε:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400 text-sm">
              <li>Όλες τις προσαρμοσμένες ρυθμίσεις κειμένου</li>
              <li>Όλα τα templates που έχετε επιλέξει</li>
              <li>Όλες τις αλλαγές που έχετε κάνει</li>
            </ul>
          </div>

          {/* Reset Info */}
          <div className="bg-blue-900 bg-opacity-20 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-blue-200 text-sm">
              <strong>Επαναφορά:</strong> Οι ρυθμίσεις θα επανέλθουν στα πρότυπα ISO 3098
            </p>
          </div>

          {/* Confirmation Question */}
          <p className="text-white font-medium text-center pt-2">
            Είστε σίγουροι ότι θέλετε να συνεχίσετε;
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
            <button
              onClick={handleFactoryResetCancel}
              className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
            >
              Ακύρωση
            </button>
            <button
              onClick={handleFactoryResetConfirm}
              className="px-4 py-2 text-sm bg-red-700 hover:bg-red-600 text-white rounded transition-colors font-semibold"
            >
              🏭 Επαναφορά Εργοστασιακών
            </button>
          </div>
        </div>
      </BaseModal>

    </div>
  );
}