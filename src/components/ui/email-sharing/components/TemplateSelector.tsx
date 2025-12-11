// ============================================================================
// 🎨 TEMPLATE SELECTOR COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ
// ============================================================================
//
// 🎯 PURPOSE: Reusable email template selector με enterprise design
// 🔗 USED BY: EmailShareForm, EmailComposer, άλλες email forms
// 🏢 STANDARDS: Enterprise component patterns, type safety
//
// ============================================================================

'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { designSystem } from '@/lib/design-system';
import { Palette } from 'lucide-react';

// Services & Types
import { EmailTemplatesService } from '@/services/email-templates.service';
import type { EmailTemplateType } from '@/types/email-templates';
import type { TemplateSelectorProps } from '../types';

// ============================================================================
// TEMPLATE SELECTOR COMPONENT
// ============================================================================

/**
 * 🎨 TemplateSelector Component
 *
 * Enterprise template selector για email forms
 *
 * Features:
 * - Visual template selection με icons
 * - Responsive grid layout
 * - Accessibility support
 * - Centralized template service integration
 * - Custom styling με design system
 */
export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateChange,
  disabled = false,
  show = true
}) => {
  // ============================================================================
  // DATA & COMPUTED VALUES
  // ============================================================================

  const availableTemplates = EmailTemplatesService.getAllTemplates();

  // Early return if hidden
  if (!show) return null;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * 🎯 Handle template selection
   */
  const handleTemplateSelect = (templateId: EmailTemplateType) => {
    if (!disabled) {
      onTemplateChange(templateId);
    }
  };

  /**
   * ⌨️ Handle keyboard navigation
   */
  const handleKeyDown = (
    event: React.KeyboardEvent,
    templateId: EmailTemplateType
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTemplateSelect(templateId);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🎨 Render individual template button
   */
  const renderTemplateButton = (template: {
    id: EmailTemplateType;
    name: string;
    description: string;
    icon: string;
  }) => {
    const isSelected = selectedTemplate === template.id;

    return (
      <button
        key={template.id}
        type="button"
        onClick={() => handleTemplateSelect(template.id)}
        onKeyDown={(e) => handleKeyDown(e, template.id)}
        disabled={disabled}
        className={designSystem.cn(
          // Base styles
          'p-3 rounded-lg border-2 transition-all text-center',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',

          // Selection states
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',

          // Disabled state
          disabled && 'opacity-50 cursor-not-allowed',

          // Interactive states
          !disabled && !isSelected && 'hover:shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800'
        )}
        aria-pressed={isSelected}
        aria-label={`Select ${template.name} template: ${template.description}`}
      >
        {/* Template Icon */}
        <div className={designSystem.cn(
          designSystem.getTypographyClass('lg'),
          'mb-2',
          isSelected && 'text-blue-600 dark:text-blue-400'
        )}>
          {template.icon}
        </div>

        {/* Template Name */}
        <div className={designSystem.cn(
          designSystem.getTypographyClass('xs', 'medium'),
          'mb-1',
          isSelected
            ? 'text-blue-900 dark:text-blue-100'
            : 'text-gray-900 dark:text-gray-100'
        )}>
          {template.name}
        </div>

        {/* Template Description */}
        <div className={designSystem.cn(
          designSystem.getTypographyClass('xs'),
          'text-muted-foreground',
          isSelected && 'text-blue-700 dark:text-blue-300'
        )}>
          {template.description}
        </div>

        {/* Selected Indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        )}
      </button>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-3">
      {/* Header */}
      <Label className={designSystem.cn(
        "flex items-center gap-2",
        designSystem.getTypographyClass('sm', 'medium'),
        disabled && 'text-gray-400 dark:text-gray-500'
      )}>
        <Palette className={designSystem.cn(
          "w-4 h-4",
          disabled ? 'text-gray-400' : 'text-blue-600'
        )} />
        Email Template
      </Label>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {availableTemplates.map(renderTemplateButton)}
      </div>

      {/* Helper Text */}
      <div className={designSystem.cn(
        designSystem.getTypographyClass('xs'),
        'text-muted-foreground text-center',
        disabled && 'text-gray-400'
      )}>
        Επιλέξτε το κατάλληλο template για την αποστολή
      </div>
    </div>
  );
};

// ============================================================================
// ADDITIONAL COMPONENTS
// ============================================================================

/**
 * 🎨 Compact Template Selector για περιορισμένο χώρο
 */
export const CompactTemplateSelector: React.FC<TemplateSelectorProps & {
  orientation?: 'horizontal' | 'vertical';
}> = ({
  selectedTemplate,
  onTemplateChange,
  disabled = false,
  show = true,
  orientation = 'horizontal'
}) => {
  const availableTemplates = EmailTemplatesService.getAllTemplates();

  if (!show) return null;

  return (
    <div className="space-y-2">
      <Label className={designSystem.cn(
        "flex items-center gap-2",
        designSystem.getTypographyClass('xs', 'medium')
      )}>
        <Palette className="w-3 h-3" />
        Template
      </Label>

      <div className={designSystem.cn(
        'flex gap-2',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
      )}>
        {availableTemplates.map((template) => {
          const isSelected = selectedTemplate === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => !disabled && onTemplateChange(template.id)}
              disabled={disabled}
              className={designSystem.cn(
                'px-3 py-1.5 text-xs rounded-md border transition-colors',
                'flex items-center gap-1.5',
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-sm">{template.icon}</span>
              <span>{template.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TemplateSelector;