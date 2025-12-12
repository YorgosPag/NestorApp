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
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useLineSettingsFromProvider } from '../../../../../settings-provider';
// ✅ ΑΝΤΙΚΑΤΑΣΤΑΣΗ ΜΕ UNIFIED HOOKS
import { useUnifiedLinePreview, useUnifiedLineCompletion } from '../../../../hooks/useUnifiedSpecificSettings';
import type { LineTemplate } from '../../../../../contexts/LineSettingsContext';
import { ColorDialogTrigger } from '../../../../color/EnterpriseColorDialog';
import { useSettingsUpdater, commonValidators } from '../../../../hooks/useSettingsUpdater';
import { useNotifications } from '../../../../../../../providers/NotificationProvider';
import { BaseModal } from '../../../../../components/shared/BaseModal';
import { EnterpriseComboBox, type ComboBoxOption, type ComboBoxGroupedOptions } from '../shared/EnterpriseComboBox';
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
import type { LineType, LineCapStyle, LineJoinStyle } from '../../../../../settings-core/types';
import type { TemplateCategory } from '../../../../../contexts/LineSettingsContext';
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
  // 🔺 ΔΙΟΡΘΩΣΗ: Χρήση unified hooks όπως σε TextSettings και GripSettings
  const generalLineSettings = useLineSettingsFromProvider();
  const notifications = useNotifications();

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
        applyTemplate: (template: LineTemplate) => {
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
      // 🔺 ΔΙΟΡΘΩΣΗ: Χρήση unified hook αντί για γενικό για override λειτουργικότητα
      const unifiedHook = useUnifiedLineCompletion();
      return {
        settings: unifiedHook.settings.lineSettings,
        updateSettings: unifiedHook.updateLineSettings,
        resetToDefaults: unifiedHook.resetToDefaults,
        applyTemplate: (template: LineTemplate) => {
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
      return {
        ...generalLineSettings,
        applyTemplate: (template: LineTemplate) => {
          // ✅ FIX: Added applyTemplate for general context
          generalLineSettings.updateSettings({
            lineType: template.lineType,
            lineWidth: template.lineWidth,
            color: template.color,
            opacity: template.opacity,
            dashScale: template.dashScale,
            dashOffset: template.dashOffset,
            lineCap: template.lineCap,
            lineJoin: template.lineJoin,
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
        console.log('🎨 Applying template:', templateName, template);
        applyTemplate(template);
        updateSettings({ activeTemplate: templateName });
        console.log('✅ Template applied, activeTemplate set to:', templateName);
      }
    } else {
      console.warn('⚠️ Template not found:', templateName);
    }
  };

  // Get current dash pattern for preview
  const currentDashPattern = getCurrentDashPattern();

  // ===== COMBOBOX OPTIONS (Enterprise Pattern) =====

  // Line Type Options
  const lineTypeOptions: ComboBoxOption<LineType>[] = Object.entries(LINE_TYPE_LABELS).map(([value, label]) => ({
    value: value as LineType,
    label: label as string
  }));

  // Line Cap Options
  const lineCapOptions: ComboBoxOption<LineCapStyle>[] = Object.entries(LINE_CAP_LABELS).map(([value, label]) => ({
    value: value as LineCapStyle,
    label: label as string
  }));

  // Line Join Options
  const lineJoinOptions: ComboBoxOption<LineJoinStyle>[] = Object.entries(LINE_JOIN_LABELS).map(([value, label]) => ({
    value: value as LineJoinStyle,
    label: label as string
  }));

  // Template Options (Grouped by category)
  const templateGroupedOptions: ComboBoxGroupedOptions<string>[] = [
    {
      category: 'engineering',
      categoryLabel: TEMPLATE_LABELS.engineering,
      options: getTemplatesByCategory('engineering').map(t => ({
        value: t.name,
        label: t.name,
        description: t.description
      }))
    },
    {
      category: 'architectural',
      categoryLabel: TEMPLATE_LABELS.architectural,
      options: getTemplatesByCategory('architectural').map(t => ({
        value: t.name,
        label: t.name,
        description: t.description
      }))
    },
    {
      category: 'electrical',
      categoryLabel: TEMPLATE_LABELS.electrical,
      options: getTemplatesByCategory('electrical').map(t => ({
        value: t.name,
        label: t.name,
        description: t.description
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
      console.log('🏭 [LineSettings] Factory reset confirmed - resetting to ISO/AutoCAD defaults');

      // Close modal
      setShowFactoryResetModal(false);

      // Toast notification για επιτυχία
      notifications.success(
        '🏭 Εργοστασιακές ρυθμίσεις επαναφέρθηκαν!',
        {
          description: 'Όλες οι ρυθμίσεις γραμμών επέστρεψαν στα πρότυπα ISO 128 & AutoCAD 2024.',
          duration: 5000
        }
      );
    }
  };

  const handleFactoryResetCancel = () => {
    console.log('🏭 [LineSettings] Factory reset cancelled by user');
    setShowFactoryResetModal(false);

    // Toast notification για ακύρωση
    notifications.info('❌ Ακυρώθηκε η επαναφορά εργοστασιακών ρυθμίσεων');
  };

  // Accordion state management
  const { toggleSection, isOpen } = useAccordion('basic');

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Ρυθμίσεις Γραμμών</h3>
        <div className="flex gap-2">
          <button
            onClick={resetToDefaults}
            className={`px-3 py-1 text-xs bg-gray-600 ${HOVER_BACKGROUND_EFFECTS.LIGHTER} text-white rounded transition-colors`}
            title="Επαναφορά στις προεπιλεγμένες ρυθμίσεις"
          >
            Επαναφορά
          </button>
          {resetToFactory && !contextType && (
            <button
              onClick={handleFactoryResetClick}
              className={`px-3 py-1 text-xs bg-red-700 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} text-white rounded transition-colors font-semibold`}
              title="Επαναφορά στις εργοστασιακές ρυθμίσεις (ISO 128 & AutoCAD 2024)"
            >
              🏭 Εργοστασιακές
            </button>
          )}
        </div>
      </div>

      {/* Enable/Disable Line Display - ΠΆΝΤΑ ΕΜΦΑΝΈΣ για όλα τα contexts */}
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
            {/* 🏢 ENTERPRISE: Template Quick Select - ComboBox */}
            <EnterpriseComboBox
              label="Προκαθορισμένα Πρότυπα"
              value={settings.activeTemplate || ''}
              groupedOptions={templateGroupedOptions}
              onChange={handleTemplateSelect}
              placeholder="Επιλέξτε πρότυπο..."
              getDisplayValue={(value) => value ? `${value} Template` : 'Επιλέξτε πρότυπο...'}
            />
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

        {/* 🏢 ENTERPRISE: Line Type - ComboBox */}
        <EnterpriseComboBox
          label="Τύπος Γραμμής"
          value={settings.lineType}
          options={lineTypeOptions}
          onChange={(value) => settingsUpdater.updateSetting('lineType', value)}
        />

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

        {/* Color - 🏢 ENTERPRISE Color System */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">Χρώμα</label>
          <ColorDialogTrigger
            value={settings.color}
            onChange={settingsUpdater.createColorHandler('color')}
            label={settings.color}
            title="Επιλογή Χρώματος Γραμμής"
            alpha={false}
            modes={['hex', 'rgb', 'hsl']}
            palettes={['dxf', 'semantic', 'material']}
            recent={true}
            eyedropper={true}
          />
        </div>

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

        {/* Hover Color - 🏢 ENTERPRISE Color System */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">Χρώμα Hover</label>
          <ColorDialogTrigger
            value={settings.hoverColor}
            onChange={settingsUpdater.createColorHandler('hoverColor')}
            label={settings.hoverColor}
            title="Επιλογή Χρώματος Hover"
            alpha={false}
            modes={['hex', 'rgb', 'hsl']}
            palettes={['dxf', 'semantic', 'material']}
            recent={true}
            eyedropper={true}
          />
        </div>

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

        {/* Final Color - 🏢 ENTERPRISE Color System */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-200">Τελικό Χρώμα</label>
          <ColorDialogTrigger
            value={settings.finalColor}
            onChange={settingsUpdater.createColorHandler('finalColor')}
            label={settings.finalColor}
            title="Επιλογή Τελικού Χρώματος"
            alpha={false}
            modes={['hex', 'rgb', 'hsl']}
            palettes={['dxf', 'semantic', 'material']}
            recent={true}
            eyedropper={true}
          />
        </div>

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

          {/* 🏢 ENTERPRISE: Line Cap - ComboBox */}
          <EnterpriseComboBox
            label="Άκρα Γραμμής"
            value={settings.lineCap}
            options={lineCapOptions}
            onChange={(value) => settingsUpdater.updateSetting('lineCap', value)}
          />

          {/* 🏢 ENTERPRISE: Line Join - ComboBox */}
          <EnterpriseComboBox
            label="Συνδέσεις Γραμμής"
            value={settings.lineJoin}
            options={lineJoinOptions}
            onChange={(value) => settingsUpdater.updateSetting('lineJoin', value)}
          />

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
              <li>Όλες τις προσαρμοσμένες ρυθμίσεις γραμμών</li>
              <li>Όλα τα templates που έχετε επιλέξει</li>
              <li>Όλες τις αλλαγές που έχετε κάνει</li>
            </ul>
          </div>

          {/* Reset Info */}
          <div className="bg-blue-900 bg-opacity-20 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-blue-200 text-sm">
              <strong>Επαναφορά:</strong> Οι ρυθμίσεις θα επανέλθουν στα πρότυπα ISO 128 & AutoCAD 2024
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
              className={`px-4 py-2 text-sm bg-gray-600 ${HOVER_BACKGROUND_EFFECTS.LIGHTER} text-white rounded transition-colors`}
            >
              Ακύρωση
            </button>
            <button
              onClick={handleFactoryResetConfirm}
              className={`px-4 py-2 text-sm bg-red-700 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} text-white rounded transition-colors font-semibold`}
            >
              🏭 Επαναφορά Εργοστασιακών
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}

export default LineSettings;