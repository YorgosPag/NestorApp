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
  // Early return if hidden or no message
  if (!show || !message.trim()) return null;

  return (
    <div className="space-y-2">
      {/* Preview Header */}
      <div className={designSystem.cn(
        'flex items-center gap-2',
        designSystem.getTypographyClass('xs', 'medium'),
        'text-blue-800 dark:text-blue-300'
      )}>
        <Eye className="w-4 h-4" />
        Προεπισκόπηση μηνύματος
        {templateName && (
          <span className="text-muted-foreground">
            • {templateName} template
          </span>
        )}
      </div>

      {/* Preview Content */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className={designSystem.cn(
          designSystem.getTypographyClass('sm'),
          'text-blue-700 dark:text-blue-200 italic leading-relaxed'
        )}>
          "{message}"
        </div>
      </div>
    </div>
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
  if (!show || !message.trim()) return null;

  const truncatedMessage = message.length > maxLength
    ? `${message.substring(0, maxLength)}...`
    : message;

  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border text-xs">
      <div className="flex items-center gap-1 text-muted-foreground mb-1">
        <MessageCircle className="w-3 h-3" />
        <span>Preview</span>
        {templateName && <span>• {templateName}</span>}
      </div>
      <div className="text-gray-700 dark:text-gray-300 italic">
        "{truncatedMessage}"
      </div>
    </div>
  );
};

// ============================================================================
// EXPORTS
// ============================================================================

export default MessagePreview;