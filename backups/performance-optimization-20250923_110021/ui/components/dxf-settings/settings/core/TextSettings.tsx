'use client';

import React, { useState } from 'react';
import { useUnifiedTextPreview } from '../../../../hooks/useUnifiedSpecificSettings';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';
import type { TextSettings } from '../../../../contexts/TextSettingsContext';

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

// Mock constants - same structure as dxf-viewer-kalo but as mock data
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

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

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
  // 🎯 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
  const { settings: { textSettings }, updateTextSettings, resetToDefaults } = useUnifiedTextPreview();

  // Accordion state management
  const { toggleSection, isOpen } = useAccordion('basic');

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Search states - these can remain local as they're UI-only
  const [fontSearch, setFontSearch] = useState('');
  const [sizeSearch, setSizeSearch] = useState('');
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);

  // Handlers
  const handleFontFamilyChange = (fontFamily: string) => {
    updateTextSettings({ fontFamily });
  };

  const handleFontSizeChange = (fontSize: number) => {
    updateTextSettings({ fontSize });
  };

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

  // Filter functions
  const filteredFonts = FREE_FONTS.filter(font =>
    font.label.toLowerCase().includes(fontSearch.toLowerCase())
  );

  const filteredSizes = FONT_SIZES.filter(size =>
    size.toString().includes(sizeSearch)
  );

  const handleFontSearchChange = (value: string) => {
    setFontSearch(value);
    setShowFontDropdown(true);
  };

  const handleSizeSearchChange = (value: string) => {
    setSizeSearch(value);
    setShowSizeDropdown(true);
  };

  const selectFont = (fontValue: string) => {
    handleFontFamilyChange(fontValue);
    setFontSearch('');
    setShowFontDropdown(false);
  };

  const selectSize = (size: number) => {
    handleFontSizeChange(size);
    setSizeSearch('');
    setShowSizeDropdown(false);
  };

  const increaseFontSize = () => {
    const newSize = Math.min(200, textSettings.fontSize + 1);
    handleFontSizeChange(newSize);
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(6, textSettings.fontSize - 1);
    handleFontSizeChange(newSize);
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
        <button
          onClick={resetToDefaults}
          className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
        >
          Επαναφορά
        </button>
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
        >
          <div className="space-y-4">
            {/* Font Family Selection with Search */}
            <div className="space-y-2 relative">
        <label className="block text-sm font-medium text-gray-300">
          {TEXT_LABELS.FONT_FAMILY}
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder={TEXT_LABELS.SEARCH_FONTS}
            value={fontSearch || FREE_FONTS.find(f => f.value === textSettings.fontFamily)?.label || ''}
            onChange={(e) => handleFontSearchChange(e.target.value)}
            onFocus={() => setShowFontDropdown(true)}
            onClick={() => setShowFontDropdown(!showFontDropdown)}
            onBlur={() => setTimeout(() => setShowFontDropdown(false), 150)}
            className="w-full px-3 py-2 pr-8 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ fontFamily: textSettings.fontFamily }}
          />
          {/* Dropdown Arrow */}
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {showFontDropdown && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border-2 border-gray-400 rounded-md shadow-2xl max-h-48 overflow-y-auto backdrop-blur-sm" style={{ zIndex: 99999 }}>
              {filteredFonts.length > 0 ? (
                filteredFonts.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => selectFont(font.value)}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors first:rounded-t-md last:rounded-b-md border-b border-gray-600 last:border-b-0"
                    style={{ fontFamily: font.value, zIndex: 99999 }}
                  >
                    {font.label}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-400">
                  Δεν βρέθηκαν γραμματοσειρές
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Font Size Selection with Search and Controls */}
      <div className="space-y-2 relative">
        <label className="block text-sm font-medium text-gray-300">
          {TEXT_LABELS.FONT_SIZE}
        </label>
        <div className="flex gap-2">
          {/* Size Input with Dropdown */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={TEXT_LABELS.SEARCH_SIZE}
              value={sizeSearch || `${textSettings.fontSize}pt`}
              onChange={(e) => handleSizeSearchChange(e.target.value.replace('pt', ''))}
              onFocus={() => setShowSizeDropdown(true)}
              onClick={() => setShowSizeDropdown(!showSizeDropdown)}
              onBlur={() => setTimeout(() => setShowSizeDropdown(false), 150)}
              className="w-full px-3 py-2 pr-8 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {/* Dropdown Arrow */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showSizeDropdown && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border-2 border-gray-400 rounded-md shadow-2xl max-h-48 overflow-y-auto backdrop-blur-sm" style={{ zIndex: 99999 }}>
                {filteredSizes.length > 0 ? (
                  filteredSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => selectSize(size)}
                      className="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray-700 transition-colors first:rounded-t-md last:rounded-b-md border-b border-gray-600 last:border-b-0"
                      style={{ zIndex: 99999 }}
                    >
                      {size}pt
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    {TEXT_LABELS.NO_SIZES_FOUND}
                  </div>
                )}
                {/* Custom size option */}
                {sizeSearch && !isNaN(Number(sizeSearch)) && Number(sizeSearch) >= 6 && Number(sizeSearch) <= 200 && (
                  <button
                    onClick={() => selectSize(Number(sizeSearch))}
                    className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-gray-700 transition-colors border-t border-gray-600 rounded-b-md"
                    style={{ zIndex: 99999 }}
                  >
                    {sizeSearch}{TEXT_LABELS.FONT_SIZE_UNIT} ({TEXT_LABELS.CUSTOM_SIZE})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Font Size Increase/Decrease Controls */}
          <div className="flex gap-1">
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

    </div>
  );
}