// ============================================================================
// 📝 MESSAGE PREVIEW COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ
// ============================================================================
//
// 🎯 PURPOSE: Reusable message preview με enterprise styling
// 🔗 USED BY: EmailShareForm, EmailComposer, MessageEditor
// 🏢 STANDARDS: Enterprise UI patterns, accessibility
//
// ============================================================================

'use client';

import React from 'react';
import { designSystem } from '@/lib/design-system';
import { MessageCircle, Eye } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// Types
import type { MessagePreviewProps } from '../types';

// ============================================================================
// MESSAGE PREVIEW COMPONENT
// ============================================================================

/**
 * 📝 MessagePreview Component
 *
 * Enterprise message preview για email forms
 *
 * Features:
 * - Clean preview styling
 * - Template context awareness
 * - Responsive design
 * - Accessibility support
 */
export const MessagePreview: React.FC<MessagePreviewProps> = ({
  message,
  templateName,
  show = true
}) => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('communications');

  // Early return if hidden or no message
  if (!show || !message.trim()) return null;

  return (
    <section className="space-y-2" role="region" aria-label={t('messagePreview.ariaLabel')}>
      {/* Preview Header */}
      <header className={designSystem.cn(
        'flex items-center gap-2',
        designSystem.getTypographyClass('xs', 'medium'),
        colors.text.info
      )} role="banner">
        <Eye className={iconSizes.sm} />
        Προεπισκόπηση μηνύματος
        {templateName && (
          <span className="text-muted-foreground">
            • {templateName} template
          </span>
        )}
      </header>

      {/* Preview Content */}
      <main className={`p-4 ${colors.bg.info} ${quick.card} ${quick.input} ${getStatusBorder('info')} dark:${getStatusBorder('info')}`} role="main">
        <blockquote className={designSystem.cn(
          designSystem.getTypographyClass('sm'),
          `${colors.text.info} italic leading-relaxed`
        )}>
          "{message}"
        </blockquote>
      </main>
    </section>
  );
};

// ============================================================================
// COMPACT VARIANT
// ============================================================================

/**
 * 📝 Compact Message Preview για περιορισμένο χώρο
 */
export const CompactMessagePreview: React.FC<MessagePreviewProps & {
  maxLength?: number;
}> = ({
  message,
  templateName,
  show = true,
  maxLength = 100
}) => {
  const { quick } = useBorderTokens();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  if (!show || !message.trim()) return null;

  const truncatedMessage = message.length > maxLength
    ? `${message.substring(0, maxLength)}...`
    : message;

  return (
    <aside className={`p-2 ${colors.bg.secondary} ${quick.rounded} ${quick.input} text-xs`} role="region" aria-label="Compact Message Preview">
      <header className="flex items-center gap-1 text-muted-foreground mb-1" role="banner">
        <MessageCircle className={iconSizes.xs} />
        <span>Preview</span>
        {templateName && <span>• {templateName}</span>}
      </header>
      <blockquote className={`${colors.text.secondary} italic`}>
        "{truncatedMessage}"
      </blockquote>
    </aside>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default MessagePreview;