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
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

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
          'p-3 rounded-lg border-2 text-center',
          TRANSITION_PRESETS.STANDARD_ALL,
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',

          // Selection states
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
            : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600',

          // Disabled state
          disabled && 'opacity-50 cursor-not-allowed',

          // Interactive states
          !disabled && !isSelected && INTERACTIVE_PATTERNS.SUBTLE_HOVER
        )}
        aria-pressed={isSelected}
        aria-label={`Select ${template.name} template: ${template.description}`}
      >
        {/* Template Icon */}
        <figure className={designSystem.cn(
          designSystem.getTypographyClass('lg'),
          'mb-2',
          isSelected && 'text-blue-600 dark:text-blue-400'
        )} role="img" aria-label={`Εικονίδιο ${template.name}`}>
          {template.icon}
        </figure>

        {/* Template Name */}
        <header className={designSystem.cn(
          designSystem.getTypographyClass('xs', 'medium'),
          'mb-1',
          isSelected
            ? 'text-blue-900 dark:text-blue-100'
            : 'text-gray-900 dark:text-gray-100'
        )}>
          {template.name}
        </header>

        {/* Template Description */}
        <p className={designSystem.cn(
          designSystem.getTypographyClass('xs'),
          'text-muted-foreground',
          isSelected && 'text-blue-700 dark:text-blue-300'
        )}>
          {template.description}
        </p>

        {/* Selected Indicator */}
        {isSelected && (
          <aside className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center" role="status" aria-label="Επιλεγμένο">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </aside>
        )}
      </button>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <section className="space-y-3" role="region" aria-label="Επιλογή Template Email">
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
      <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="group" aria-label="Διαθέσιμα Templates">
        {availableTemplates.map(renderTemplateButton)}
      </nav>

      {/* Helper Text */}
      <aside className={designSystem.cn(
        designSystem.getTypographyClass('xs'),
        'text-muted-foreground text-center',
        disabled && 'text-gray-400'
      )} role="note">
        Επιλέξτε το κατάλληλο template για την αποστολή
      </aside>
    </section>
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
    <section className="space-y-2" role="region" aria-label="Compact Template Selector">
      <Label className={designSystem.cn(
        "flex items-center gap-2",
        designSystem.getTypographyClass('xs', 'medium')
      )}>
        <Palette className="w-3 h-3" />
        Template
      </Label>

      <nav className={designSystem.cn(
        'flex gap-2',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
      )} role="group" aria-label="Compact Templates">
        {availableTemplates.map((template) => {
          const isSelected = selectedTemplate === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => !disabled && onTemplateChange(template.id)}
              disabled={disabled}
              className={designSystem.cn(
                'px-3 py-1.5 text-xs rounded-md border',
                TRANSITION_PRESETS.STANDARD_COLORS,
                'flex items-center gap-1.5',
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : designSystem.cn(
                      'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300',
                      INTERACTIVE_PATTERNS.SUBTLE_HOVER
                    ),
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="text-sm">{template.icon}</span>
              <span>{template.name}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default TemplateSelector;