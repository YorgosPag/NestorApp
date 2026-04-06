/**
 * useLineSettingsState — Custom hook for LineSettings component
 * Extracted from LineSettings.tsx (ADR-065 SRP split)
 *
 * Encapsulates: context selection, settings updater, handlers, select options, accordion state.
 */

'use client';

import { useState } from 'react';
import { useLineSettingsFromProvider, useEnterpriseDxfSettings } from '../../../../../settings-provider';
import { useUnifiedLinePreview, useUnifiedLineCompletion } from '../../../../hooks/useUnifiedSpecificSettings';
import type { LineTemplate as LineSettingsTemplate } from '../../../../../contexts/LineSettingsContext';
import { useSettingsUpdater, commonValidators } from '../../../../hooks/useSettingsUpdater';
import { useNotifications } from '@/providers/NotificationProvider';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useAccordion } from '../shared/AccordionSection';
import { useTranslation } from '@/i18n';
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

// ===== TYPES =====

interface TemplateGroupOption {
  value: string;
  label: string;
  description: string;
}

interface TemplateGroup {
  category: string;
  categoryLabel: string;
  options: TemplateGroupOption[];
}

interface SelectOption {
  value: string;
  label: string;
}

// ===== HOOK =====

export function useLineSettingsState(contextType?: 'preview' | 'completion') {
  const iconSizes = useIconSizes();
  const borderTokens = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('dxf-viewer');
  const generalLineSettings = useLineSettingsFromProvider();
  const notifications = useNotifications();
  const enterpriseContext = useEnterpriseDxfSettings();

  const activeContext = contextType || 'general';

  // Context-aware hook selection
  const lineSettingsContext = (() => {
    if (activeContext === 'preview') {
      const unifiedHook = useUnifiedLinePreview();
      return {
        settings: unifiedHook.settings.lineSettings,
        updateSettings: unifiedHook.updateLineSettings,
        resetToDefaults: unifiedHook.resetToDefaults,
        resetToFactory: () => unifiedHook.resetToDefaults(),
        applyTemplate: (template: LineSettingsTemplate) => {
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
        getCurrentDashPattern: () => generalLineSettings.getCurrentDashPattern()
      };
    } else if (activeContext === 'completion') {
      const unifiedHook = useUnifiedLineCompletion();
      return {
        settings: unifiedHook.settings.lineSettings,
        updateSettings: unifiedHook.updateLineSettings,
        resetToDefaults: unifiedHook.resetToDefaults,
        resetToFactory: () => unifiedHook.resetToDefaults(),
        applyTemplate: (template: LineSettingsTemplate) => {
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
        getCurrentDashPattern: () => generalLineSettings.getCurrentDashPattern()
      };
    } else {
      return {
        ...generalLineSettings,
        resetToFactory: () => generalLineSettings.resetToDefaults(),
        applyTemplate: (template: LineSettingsTemplate) => {
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

  // Settings updater
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

  // Factory reset modal state
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);

  // Select options (ADR-001: Radix Select Pattern)
  const lineTypeOptions: SelectOption[] = (['solid', 'dashed', 'dotted', 'dash-dot', 'dash-dot-dot'] as LineType[]).map(type => ({
    value: type,
    label: getLineTypeLabel(type, t)
  }));

  const lineCapOptions: SelectOption[] = (['butt', 'round', 'square'] as LineCapStyle[]).map(cap => ({
    value: cap,
    label: getLineCapLabel(cap, t)
  }));

  const lineJoinOptions: SelectOption[] = (['miter', 'round', 'bevel'] as LineJoinStyle[]).map(join => ({
    value: join,
    label: getLineJoinLabel(join, t)
  }));

  const templateGroupedOptions: TemplateGroup[] = [
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

  // Handlers
  const handleTemplateSelect = (templateName: string) => {
    const allTemplates = templateGroupedOptions.flatMap(group => group.options);
    const selectedOption = allTemplates.find(opt => opt.value === templateName);

    if (selectedOption) {
      const template = [
        ...getTemplatesByCategory('engineering'),
        ...getTemplatesByCategory('architectural'),
        ...getTemplatesByCategory('electrical')
      ].find(t => t.name === templateName);

      if (template) {
        console.debug('Applying template:', templateName, template);
        const lineSettingsTemplate: LineSettingsTemplate = {
          name: template.name,
          category: template.category,
          description: template.description,
          settings: {
            enabled: true,
            ...template.settings
          }
        };
        applyTemplate(lineSettingsTemplate);
        updateSettings({ activeTemplate: templateName });
        console.debug('Template applied, activeTemplate set to:', templateName);
      }
    } else {
      console.warn('Template not found:', templateName);
    }
  };

  const handleFactoryResetClick = () => setShowFactoryResetModal(true);

  const handleFactoryResetConfirm = () => {
    if (resetToFactory) {
      resetToFactory();
      console.debug('[LineSettings] Factory reset confirmed');
      setShowFactoryResetModal(false);
      notifications.success(t('settings.line.factoryReset.successMessage'), { duration: 5000 });
    }
  };

  const handleFactoryResetCancel = () => {
    console.debug('[LineSettings] Factory reset cancelled');
    setShowFactoryResetModal(false);
    notifications.info(t('settings.line.factoryReset.cancelMessage'));
  };

  const handleColorChange = (color: string) => {
    settingsUpdater.updateSetting('color', color);
    enterpriseContext.updateSpecificLineSettings('completion', { color });
  };

  // Accordion state
  const accordion = useAccordion('basic');

  // Dash pattern
  const currentDashPattern = getCurrentDashPattern();

  const isEmbedded = Boolean(contextType);

  return {
    // UI tokens
    iconSizes,
    borderTokens,
    colors,
    t,
    // Settings
    settings,
    settingsUpdater,
    resetToDefaults,
    // Options
    lineTypeOptions,
    lineCapOptions,
    lineJoinOptions,
    templateGroupedOptions,
    // Handlers
    handleTemplateSelect,
    handleFactoryResetClick,
    handleFactoryResetConfirm,
    handleFactoryResetCancel,
    handleColorChange,
    // Modal
    showFactoryResetModal,
    // Accordion
    accordion,
    // Misc
    currentDashPattern,
    isEmbedded,
  };
}

export type LineSettingsState = ReturnType<typeof useLineSettingsState>;
