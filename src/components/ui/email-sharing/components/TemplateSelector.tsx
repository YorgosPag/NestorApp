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
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { designSystem } from '@/lib/design-system';
import { Palette } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

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
          'p-3 ${radius.lg} border text-center',
          TRANSITION_PRESETS.STANDARD_ALL,
          `focus:outline-none focus:ring-2 ${colors.ring.info} focus:ring-offset-2`,

          // Selection states
          isSelected
            ? `${getStatusBorder('info')} ${colors.bg.infoSubtle} shadow-md`
            : `${quick.card} ${INTERACTIVE_PATTERNS.BORDER_SUBTLE}`,

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
          isSelected && `${colors.text.info}`
        )} role="img" aria-label={t('email.templateIcon', { name: template.name })}>
          {template.icon}
        </figure>

        {/* Template Name */}
        <header className={designSystem.cn(
          designSystem.getTypographyClass('xs', 'medium'),
          'mb-1',
          isSelected
            ? `${colors.text.info}`
            : `${colors.text.primary}`
        )}>
          {template.name}
        </header>

        {/* Template Description */}
        <p className={designSystem.cn(
          designSystem.getTypographyClass('xs'),
          'text-muted-foreground',
          isSelected && `${colors.text.info}`
        )}>
          {template.description}
        </p>

        {/* Selected Indicator */}
        {isSelected && (
          <aside className={`absolute top-2 right-2 ${iconSizes.xs} ${colors.bg.info} ${radius.full} flex items-center justify-center`} role="status" aria-label={t('email.selected')}>
            <div className={`w-1.5 h-1.5 ${designSystem.getBackgroundColor('primary')} ${radius.full}`} />
          </aside>
        )}
      </button>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <section className="space-y-3" role="region" aria-label={t('email.selectTemplate')}>
      {/* Header */}
      <Label className={designSystem.cn(
        "flex items-center gap-2",
        designSystem.getTypographyClass('sm', 'medium'),
        disabled && `${colors.text.disabled}`
      )}>
        <Palette className={designSystem.cn(
          iconSizes.sm,
          disabled ? `${colors.text.disabled}` : `${colors.text.info}`
        )} />
        {t('email.template')}
      </Label>

      {/* Templates Grid */}
      <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="group" aria-label={t('email.availableTemplates')}>
        {availableTemplates.map(renderTemplateButton)}
      </nav>

      {/* Helper Text */}
      <aside className={designSystem.cn(
        designSystem.getTypographyClass('xs'),
        'text-muted-foreground text-center',
        disabled && 'text-gray-400'
      )} role="note">
        {t('email.selectAppropriate')}
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
  const iconSizes = useIconSizes();
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const availableTemplates = EmailTemplatesService.getAllTemplates();

  if (!show) return null;

  return (
    <section className="space-y-2" role="region" aria-label="Compact Template Selector">
      <Label className={designSystem.cn(
        "flex items-center gap-2",
        designSystem.getTypographyClass('xs', 'medium')
      )}>
        <Palette className={iconSizes.xs} />
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
                'px-3 py-1.5 text-xs ${radius.md} border',
                TRANSITION_PRESETS.STANDARD_COLORS,
                'flex items-center gap-1.5',
                isSelected
                  ? `${getStatusBorder('info')} ${colors.bg.infoSubtle} ${colors.text.info}`
                  : designSystem.cn(
                      `${quick.card} ${colors.text.primary}`,
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