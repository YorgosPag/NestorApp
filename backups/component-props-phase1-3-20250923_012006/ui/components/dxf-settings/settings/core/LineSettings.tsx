'use client';

import React, { useState } from 'react';
import { useLineSettingsFromProvider } from '../../../../../providers/DxfSettingsProvider';
// ✅ ΑΝΤΙΚΑΤΑΣΤΑΣΗ ΜΕ UNIFIED HOOKS
import { useUnifiedLinePreview, useUnifiedLineCompletion } from '../../../../hooks/useUnifiedSpecificSettings';
import { SharedColorPicker } from '../../../shared/SharedColorPicker';
import { useSettingsUpdater, commonValidators } from '../../../../hooks/useSettingsUpdater';
import {
  LINE_TYPE_LABELS,
  LINE_CAP_LABELS,
  LINE_JOIN_LABELS,
  LINE_WIDTH_RANGE,
  DASH_SCALE_RANGE,
  DASH_OFFSET_RANGE,
  OPACITY_RANGE,
  TEMPLATE_LABELS,
  getTemplatesByCategory
} from '../../../../../contexts/LineConstants';
import type { LineType, LineCapStyle, LineJoinStyle, TemplateCategory } from '../../../../../contexts/LineSettingsContext';
import { AccordionSection, useAccordion } from '../shared/AccordionSection';

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
  // 🎯 ΔΙΟΡΘΩΣΗ: Χρήση unified hooks όπως σε TextSettings και GripSettings
  const generalLineSettings = useLineSettingsFromProvider();

  // Καθορίζουμε το active context
  const activeContext = contextType || 'general';

  // Χρησιμοποιούμε το σωστό unified hook βάσει context
  const lineSettingsContext = (() => {
    if (activeContext === 'preview') {
      // 🎯 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
      const unifiedHook = useUnifiedLinePreview();
      return {
        settings: unifiedHook.settings.lineSettings,
        updateSettings: unifiedHook.updateLineSettings,
        resetToDefaults: unifiedHook.resetToDefaults,
        applyTemplate: (template: any) => {
          // Εφαρμόζουμε το template στις ειδικές preview ρυθμίσεις
          unifiedHook.updateLineSettings({
            lineType: template.lineType,
            lineWidth: template.lineWidth,
            color: template.color,
            opacity: template.opacity,
            dashScale: template.dashScale,
            dashOffset: template.dashOffset,
            lineCap: template.lineCap,
            lineJoin: template.lineJoin,
            breakAtCenter: template.breakAtCenter
          });
        },
        getCurrentDashPattern: () => {
          return generalLineSettings.getCurrentDashPattern(); // Fallback στη γενική λογική
        }
      };
    } else if (activeContext === 'completion') {
      // 🎯 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
      const unifiedHook = useUnifiedLineCompletion();
      return {
        settings: unifiedHook.settings.lineSettings,
        updateSettings: unifiedHook.updateLineSettings,
        resetToDefaults: unifiedHook.resetToDefaults,
        applyTemplate: (template: any) => {
          // Εφαρμόζουμε το template στις ειδικές completion ρυθμίσεις
          unifiedHook.updateLineSettings({
            lineType: template.lineType,
            lineWidth: template.lineWidth,
            color: template.color,
            opacity: template.opacity,
            dashScale: template.dashScale,
            dashOffset: template.dashOffset,
            lineCap: template.lineCap,
            lineJoin: template.lineJoin,
            breakAtCenter: template.breakAtCenter
          });
        },
        getCurrentDashPattern: () => {
          return generalLineSettings.getCurrentDashPattern(); // Fallback στη γενική λογική
        }
      };
    } else {
      // Γενικές ρυθμίσεις - fallback
      return generalLineSettings;
    }
  })();

  const { settings, updateSettings, resetToDefaults, applyTemplate, getCurrentDashPattern } = lineSettingsContext;

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

  // Local state για dropdowns
  const [showLineTypeDropdown, setShowLineTypeDropdown] = useState(false);
  const [showCapDropdown, setShowCapDropdown] = useState(false);
  const [showJoinDropdown, setShowJoinDropdown] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  // Keyboard navigation state
  const [highlightedTemplateIndex, setHighlightedTemplateIndex] = useState(-1);
  const [highlightedLineTypeIndex, setHighlightedLineTypeIndex] = useState(-1);
  const [highlightedCapIndex, setHighlightedCapIndex] = useState(-1);
  const [highlightedJoinIndex, setHighlightedJoinIndex] = useState(-1);

  // Handle line type change
  const handleLineTypeChange = (lineType: LineType) => {
    settingsUpdater.createSelectHandler('lineType', () => setShowLineTypeDropdown(false))(lineType);
  };

  // Handle template application
  const handleTemplateSelect = (templateName: string) => {
    const allTemplates = [
      ...getTemplatesByCategory('engineering'),
      ...getTemplatesByCategory('architectural'),
      ...getTemplatesByCategory('electrical')
    ];
    const template = allTemplates.find(t => t.name === templateName);
    if (template) {
      applyTemplate(template);
    }
    setShowTemplateDropdown(false);
  };

  // Get current dash pattern for preview
  const currentDashPattern = getCurrentDashPattern();

  // Get all available options for dropdowns
  const allTemplates = [
    ...getTemplatesByCategory('engineering'),
    ...getTemplatesByCategory('architectural'),
    ...getTemplatesByCategory('electrical')
  ];
  const lineTypeOptions = Object.entries(LINE_TYPE_LABELS);
  const lineCapOptions = Object.entries(LINE_CAP_LABELS);
  const lineJoinOptions = Object.entries(LINE_JOIN_LABELS);

  // Keyboard navigation handlers
  const handleKeyDown = (e: React.KeyboardEvent, dropdownType: 'template' | 'lineType' | 'cap' | 'join') => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;

    e.preventDefault();

    let currentIndex = -1;
    let maxIndex = 0;
    let setHighlightedIndex: (index: number) => void;
    let handleSelect: (index: number) => void;

    switch (dropdownType) {
      case 'template':
        currentIndex = highlightedTemplateIndex;
        maxIndex = allTemplates.length - 1;
        setHighlightedIndex = setHighlightedTemplateIndex;
        handleSelect = (index) => {
          const template = allTemplates[index];
          if (template) {
            applyTemplate(template);
            // Keep highlighting for keyboard navigation
          }
        };
        break;
      case 'lineType':
        currentIndex = highlightedLineTypeIndex;
        maxIndex = lineTypeOptions.length - 1;
        setHighlightedIndex = setHighlightedLineTypeIndex;
        handleSelect = (index) => {
          const [type] = lineTypeOptions[index];
          if (type) {
            settingsUpdater.updateSetting('lineType', type as LineType);
            // Keep highlighting for keyboard navigation
          }
        };
        break;
      case 'cap':
        currentIndex = highlightedCapIndex;
        maxIndex = lineCapOptions.length - 1;
        setHighlightedIndex = setHighlightedCapIndex;
        handleSelect = (index) => {
          const [cap] = lineCapOptions[index];
          if (cap) {
            settingsUpdater.updateSetting('lineCap', cap as LineCapStyle);
            // Keep highlighting for keyboard navigation
          }
        };
        break;
      case 'join':
        currentIndex = highlightedJoinIndex;
        maxIndex = lineJoinOptions.length - 1;
        setHighlightedIndex = setHighlightedJoinIndex;
        handleSelect = (index) => {
          const [join] = lineJoinOptions[index];
          if (join) {
            settingsUpdater.updateSetting('lineJoin', join as LineJoinStyle);
            // Keep highlighting for keyboard navigation
          }
        };
        break;
    }

    switch (e.key) {
      case 'ArrowDown':
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex < maxIndex ? currentIndex + 1 : 0);
        setHighlightedIndex(nextIndex);
        // Apply selection immediately but keep highlighting
        handleSelect(nextIndex);
        break;
      case 'ArrowUp':
        const prevIndex = currentIndex === -1 ? maxIndex : (currentIndex > 0 ? currentIndex - 1 : maxIndex);
        setHighlightedIndex(prevIndex);
        // Apply selection immediately but keep highlighting
        handleSelect(prevIndex);
        break;
      case 'Enter':
        if (currentIndex >= 0) {
          handleSelect(currentIndex);
          // Close dropdown and reset highlighting on Enter
          setHighlightedIndex(-1);
          switch (dropdownType) {
            case 'template': setShowTemplateDropdown(false); break;
            case 'lineType': setShowLineTypeDropdown(false); break;
            case 'cap': setShowCapDropdown(false); break;
            case 'join': setShowJoinDropdown(false); break;
          }
        }
        break;
      case 'Escape':
        // Close dropdown and reset highlight
        setHighlightedIndex(-1);
        switch (dropdownType) {
          case 'template': setShowTemplateDropdown(false); break;
          case 'lineType': setShowLineTypeDropdown(false); break;
          case 'cap': setShowCapDropdown(false); break;
          case 'join': setShowJoinDropdown(false); break;
        }
        break;
    }
  };

  // Close dropdowns when clicking outside
  const handleContainerClick = (e: React.MouseEvent) => {
    // Check if click is on a dropdown button or dropdown content
    const target = e.target as HTMLElement;
    const isDropdownButton = target.closest('button');
    const isDropdownContent = target.closest('[data-dropdown-content]');

    if (!isDropdownButton && !isDropdownContent) {
      setShowTemplateDropdown(false);
      setShowLineTypeDropdown(false);
      setShowCapDropdown(false);
      setShowJoinDropdown(false);
      setHighlightedTemplateIndex(-1);
      setHighlightedLineTypeIndex(-1);
      setHighlightedCapIndex(-1);
      setHighlightedJoinIndex(-1);
    }
  };

  // Accordion state management
  const { toggleSection, isOpen } = useAccordion('basic');

  return (
    <div className="space-y-4 p-4" onClick={handleContainerClick}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Ρυθμίσεις Γραμμών</h3>
        <button
          onClick={resetToDefaults}
          className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
        >
          Επαναφορά
        </button>
      </div>

      {/* Enable/Disable Line Display */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-md border-l-4 border-green-500">
          <input
            type="checkbox"
            id="line-enabled"
            checked={settings.enabled}
            onChange={settingsUpdater.createCheckboxHandler('enabled')}
            className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
          />
          <label
            htmlFor="line-enabled"
            className={`text-sm font-medium ${settings.enabled ? 'text-white' : 'text-gray-400'}`}
          >
            Εμφάνιση γραμμής
          </label>
        </div>
        {!settings.enabled && (
          <div className="text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 p-2 rounded border border-yellow-700">
            ⚠️ Οι γραμμές είναι απενεργοποιημένες και δεν θα εμφανίζονται στην προσχεδίαση
          </div>
        )}
      </div>

      {/* ACCORDION SECTIONS */}
      <div className={`space-y-4 ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* 1. ΠΡΌΤΥΠΑ & ΕΡΓΑΛΕΊΑ */}
        <AccordionSection
          title="Πρότυπα & Εργαλεία"
          icon={<SwatchIcon className="w-4 h-4" />}
          isOpen={isOpen('templates')}
          onToggle={() => toggleSection('templates')}
          disabled={!settings.enabled}
        >
          <div className="space-y-4">
            {/* Template Quick Select */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">Προκαθορισμένα Πρότυπα</label>
              <div className="relative">
            <button
              onClick={() => {
                setShowTemplateDropdown(!showTemplateDropdown);
                setHighlightedTemplateIndex(-1);
              }}
              onKeyDown={(e) => handleKeyDown(e, 'template')}
              className="w-full px-3 py-2 pr-8 bg-gray-700 border border-gray-600 rounded-md text-white text-left hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {settings.activeTemplate ? `${settings.activeTemplate} Template` : 'Επιλέξτε πρότυπο...'}
            </button>
            {/* Dropdown Arrow */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                  showTemplateDropdown ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {showTemplateDropdown && (
              <div
                data-dropdown-content
                className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-2xl max-h-48 overflow-y-auto"
                style={{
                  zIndex: 99999999,
                  backgroundColor: '#374151',
                  border: '1px solid #4B5563',
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none'
                }}
              >
                {(() => {
                  let globalIndex = 0;
                  return ['engineering', 'architectural', 'electrical'].map(category => {
                    const templates = getTemplatesByCategory(category as TemplateCategory);
                    const categoryStartIndex = globalIndex;
                    globalIndex += templates.length;

                    return (
                      <div key={category} className="border-b border-gray-600 last:border-b-0">
                        <div className="px-3 py-2 text-xs font-medium text-gray-400 bg-gray-800">
                          {TEMPLATE_LABELS[category as TemplateCategory]}
                        </div>
                        {templates.map((template, localIndex) => {
                          const globalTemplateIndex = categoryStartIndex + localIndex;
                          const isHighlighted = highlightedTemplateIndex === globalTemplateIndex;
                          return (
                            <button
                              key={template.name}
                              onClick={() => handleTemplateSelect(template.name)}
                              className={`w-full px-3 py-2 text-left text-sm border-b border-gray-700 last:border-b-0 transition-colors ${
                                isHighlighted
                                  ? 'bg-blue-600 text-white'
                                  : 'text-white hover:bg-gray-600'
                              }`}
                            >
                              <div className="font-medium">{template.name}</div>
                              <div className="text-xs text-gray-400">{template.description}</div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
          )}
        </div>
          </div>
        </AccordionSection>

        {/* 2. ΒΑΣΙΚΈΣ ΡΥΘΜΊΣΕΙΣ */}
        <AccordionSection
          title="Βασικές Ρυθμίσεις"
          icon={<SettingsIcon className="w-4 h-4" />}
          isOpen={isOpen('basic')}
          onToggle={() => toggleSection('basic')}
          disabled={!settings.enabled}
          badge={5}
        >
          <div className="space-y-4">

        {/* Line Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">Τύπος Γραμμής</label>
          <div className="relative">
            <button
              onClick={() => {
                setShowLineTypeDropdown(!showLineTypeDropdown);
                setHighlightedLineTypeIndex(-1);
              }}
              onKeyDown={(e) => handleKeyDown(e, 'lineType')}
              className="w-full px-3 py-2 pr-8 bg-gray-700 border border-gray-600 rounded-md text-white text-left hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {LINE_TYPE_LABELS[settings.lineType]}
            </button>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                  showLineTypeDropdown ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {showLineTypeDropdown && (
                <div
                  data-dropdown-content
                  className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-2xl"
                  style={{
                    zIndex: 99999999,
                    backgroundColor: '#374151',
                    border: '1px solid #4B5563',
                    backdropFilter: 'none',
                    WebkitBackdropFilter: 'none'
                  }}
                >
                  {lineTypeOptions.map(([type, label], index) => {
                    const isHighlighted = highlightedLineTypeIndex === index;
                    return (
                      <button
                        key={type}
                        onClick={() => handleLineTypeChange(type as LineType)}
                        className={`w-full px-3 py-2 text-left text-sm border-b border-gray-700 last:border-b-0 transition-colors ${
                          isHighlighted
                            ? 'bg-blue-600 text-white'
                            : 'text-white hover:bg-gray-600'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
            )}
          </div>
        </div>

        {/* Line Width */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            Πάχος Γραμμής: {settings.lineWidth}px
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.lineWidth}
              onChange={settingsUpdater.createNumberInputHandler('lineWidth', { parseType: 'float' })}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.lineWidth}
              onChange={settingsUpdater.createNumberInputHandler('lineWidth', { parseType: 'float' })}
              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>

        {/* Color */}
        <SharedColorPicker
          value={settings.color}
          onChange={settingsUpdater.createColorHandler('color')}
          label="Χρώμα"
          previewSize="large"
          showTextInput={true}
          textInputPlaceholder="#ffffff"
        />

        {/* Opacity */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            Διαφάνεια: {Math.round(settings.opacity * 100)}%
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.opacity}
              onChange={settingsUpdater.createNumberInputHandler('opacity', { parseType: 'float' })}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.opacity}
              onChange={settingsUpdater.createNumberInputHandler('opacity', { parseType: 'float' })}
              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>

        {/* Line Break for Text */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.breakAtCenter || false}
              onChange={settingsUpdater.createCheckboxHandler('breakAtCenter')}
              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-sm text-gray-200">Σπάσιμο γραμμής για κείμενο</span>
          </label>
          <p className="text-xs text-gray-400 pl-6">
            Η γραμμή θα σπάσει στη μέση για να χωράει το κείμενο
          </p>
        </div>
          </div>
        </AccordionSection>

        {/* 3. ΡΥΘΜΊΣΕΙΣ HOVER */}
        <AccordionSection
          title="Ρυθμίσεις Hover"
          icon={<PaintbrushIcon className="w-4 h-4" />}
          isOpen={isOpen('hover')}
          onToggle={() => toggleSection('hover')}
          disabled={!settings.enabled}
          badge={3}
        >
          <div className="space-y-4">

        {/* Hover Color */}
        <SharedColorPicker
          value={settings.hoverColor}
          onChange={settingsUpdater.createColorHandler('hoverColor')}
          label="Χρώμα Hover"
          previewSize="large"
          showTextInput={true}
          textInputPlaceholder="#ffff00"
        />

        {/* Hover Width */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            Πάχος Hover: {settings.hoverWidth}px
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.hoverWidth}
              onChange={settingsUpdater.createNumberInputHandler('hoverWidth', { parseType: 'float' })}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.hoverWidth}
              onChange={settingsUpdater.createNumberInputHandler('hoverWidth', { parseType: 'float' })}
              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>

        {/* Hover Opacity */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            Διαφάνεια Hover: {Math.round(settings.hoverOpacity * 100)}%
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.hoverOpacity}
              onChange={settingsUpdater.createNumberInputHandler('hoverOpacity', { parseType: 'float' })}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.hoverOpacity}
              onChange={settingsUpdater.createNumberInputHandler('hoverOpacity', { parseType: 'float' })}
              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>
          </div>
        </AccordionSection>

        {/* 4. ΤΕΛΙΚΈΣ ΡΥΘΜΊΣΕΙΣ */}
        <AccordionSection
          title="Τελικές Ρυθμίσεις Γραμμής"
          icon={<CpuChipIcon className="w-4 h-4" />}
          isOpen={isOpen('final')}
          onToggle={() => toggleSection('final')}
          disabled={!settings.enabled}
          badge={3}
        >
          <div className="space-y-4">

        {/* Final Color */}
        <SharedColorPicker
          value={settings.finalColor}
          onChange={settingsUpdater.createColorHandler('finalColor')}
          label="Τελικό Χρώμα"
          previewSize="large"
          showTextInput={true}
          textInputPlaceholder="#00ff00"
        />

        {/* Final Width */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            Τελικό Πάχος: {settings.finalWidth}px
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.finalWidth}
              onChange={settingsUpdater.createNumberInputHandler('finalWidth', { parseType: 'float' })}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min={LINE_WIDTH_RANGE.min}
              max={LINE_WIDTH_RANGE.max}
              step={LINE_WIDTH_RANGE.step}
              value={settings.finalWidth}
              onChange={settingsUpdater.createNumberInputHandler('finalWidth', { parseType: 'float' })}
              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>

        {/* Final Opacity */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">
            Τελική Διαφάνεια: {Math.round(settings.finalOpacity * 100)}%
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="range"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.finalOpacity}
              onChange={settingsUpdater.createNumberInputHandler('finalOpacity', { parseType: 'float' })}
              className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <input
              type="number"
              min={OPACITY_RANGE.min}
              max={OPACITY_RANGE.max}
              step={OPACITY_RANGE.step}
              value={settings.finalOpacity}
              onChange={settingsUpdater.createNumberInputHandler('finalOpacity', { parseType: 'float' })}
              className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>
          </div>
        </AccordionSection>

        {/* 5. ΠΡΟΧΩΡΗΜΈΝΕΣ ΡΥΘΜΊΣΕΙΣ */}
        <AccordionSection
          title="Προχωρημένες Ρυθμίσεις"
          icon={<AdjustmentsHorizontalIcon className="w-4 h-4" />}
          isOpen={isOpen('advanced')}
          onToggle={() => toggleSection('advanced')}
          disabled={!settings.enabled}
        >
          <div className="space-y-4">
          {/* Dash Scale (only for non-solid lines) */}
          {settings.lineType !== 'solid' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
                Κλίμακα Διακοπών: {settings.dashScale}
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min={DASH_SCALE_RANGE.min}
                  max={DASH_SCALE_RANGE.max}
                  step={DASH_SCALE_RANGE.step}
                  value={settings.dashScale}
                  onChange={settingsUpdater.createNumberInputHandler('dashScale', { parseType: 'float' })}
                  className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min={DASH_SCALE_RANGE.min}
                  max={DASH_SCALE_RANGE.max}
                  step={DASH_SCALE_RANGE.step}
                  value={settings.dashScale}
                  onChange={settingsUpdater.createNumberInputHandler('dashScale', { parseType: 'float' })}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
              </div>
            </div>
          )}

          {/* Line Cap */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">Άκρα Γραμμής</label>
            <div className="relative">
              <button
                onClick={() => {
                  setShowCapDropdown(!showCapDropdown);
                  setHighlightedCapIndex(-1);
                }}
                onKeyDown={(e) => handleKeyDown(e, 'cap')}
                className="w-full px-3 py-2 pr-8 bg-gray-700 border border-gray-600 rounded-md text-white text-left hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {LINE_CAP_LABELS[settings.lineCap]}
              </button>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                    showCapDropdown ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {showCapDropdown && (
                  <div
                    data-dropdown-content
                    className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-2xl"
                    style={{
                      zIndex: 99999999,
                      backgroundColor: '#374151',
                      border: '1px solid #4B5563',
                      backdropFilter: 'none',
                      WebkitBackdropFilter: 'none'
                    }}
                  >
                    {lineCapOptions.map(([cap, label], index) => {
                      const isHighlighted = highlightedCapIndex === index;
                      return (
                        <button
                          key={cap}
                          onClick={() => {
                            settingsUpdater.createSelectHandler('lineCap', () => setShowCapDropdown(false))(cap as LineCapStyle);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm border-b border-gray-700 last:border-b-0 transition-colors ${
                            isHighlighted
                              ? 'bg-blue-600 text-white'
                              : 'text-white hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
              )}
            </div>
          </div>

          {/* Line Join */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-200">Συνδέσεις Γραμμής</label>
            <div className="relative">
              <button
                onClick={() => {
                  setShowJoinDropdown(!showJoinDropdown);
                  setHighlightedJoinIndex(-1);
                }}
                onKeyDown={(e) => handleKeyDown(e, 'join')}
                className="w-full px-3 py-2 pr-8 bg-gray-700 border border-gray-600 rounded-md text-white text-left hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {LINE_JOIN_LABELS[settings.lineJoin]}
              </button>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                    showJoinDropdown ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {showJoinDropdown && (
                <div
                    data-dropdown-content
                    className="absolute top-full left-0 right-0 mt-1 rounded-md shadow-2xl"
                    style={{
                      zIndex: 99999999,
                      backgroundColor: '#374151',
                      border: '1px solid #4B5563',
                      backdropFilter: 'none',
                      WebkitBackdropFilter: 'none'
                    }}
                  >
                    {lineJoinOptions.map(([join, label], index) => {
                      const isHighlighted = highlightedJoinIndex === index;
                      return (
                        <button
                          key={join}
                          onClick={() => {
                            settingsUpdater.createSelectHandler('lineJoin', () => setShowJoinDropdown(false))(join as LineJoinStyle);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm border-b border-gray-700 last:border-b-0 transition-colors ${
                            isHighlighted
                              ? 'bg-blue-600 text-white'
                              : 'text-white hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
              )}
            </div>
          </div>

          {/* Dash Offset (only for non-solid lines) */}
          {settings.lineType !== 'solid' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-200">
                Μετατόπιση Διακοπών: {settings.dashOffset}px
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min={DASH_OFFSET_RANGE.min}
                  max={DASH_OFFSET_RANGE.max}
                  step={DASH_OFFSET_RANGE.step}
                  value={settings.dashOffset}
                  onChange={settingsUpdater.createNumberInputHandler('dashOffset', { parseType: 'float' })}
                  className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min={DASH_OFFSET_RANGE.min}
                  max={DASH_OFFSET_RANGE.max}
                  step={DASH_OFFSET_RANGE.step}
                  value={settings.dashOffset}
                  onChange={settingsUpdater.createNumberInputHandler('dashOffset', { parseType: 'float' })}
                  className="w-16 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                />
              </div>
            </div>
          )}
          </div>
        </AccordionSection>

      </div>
    </div>
  );
}

export default LineSettings;