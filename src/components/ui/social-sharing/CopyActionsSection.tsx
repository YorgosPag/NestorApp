// ============================================================================
// 📋 COPY ACTIONS SECTION COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΕΣ COPY ΛΕΙΤΟΥΡΓΙΕΣ
// ============================================================================
//
// 🎯 PURPOSE: Reusable copy actions για URL & text με enterprise styling
// 🔗 USED BY: ShareModal, PropertySharing, ContactSharing
// 🏢 STANDARDS: Enterprise copy patterns, centralized design system
//
// ============================================================================

'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { designSystem } from '@/lib/design-system';
import { TRANSITION_PRESETS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CopyData {
  /** URL to copy */
  url: string;
  /** Title για text composition */
  title: string;
  /** Optional text description */
  text?: string;
}

export interface CopyActionsProps {
  /** Data για copy operations */
  copyData: CopyData;

  /** Callback όταν copy succeeds */
  onCopySuccess?: (type: 'url' | 'text') => void;

  /** Callback όταν copy fails */
  onCopyError?: (type: 'url' | 'text', error: string) => void;

  /** Loading state για disabled buttons */
  loading?: boolean;

  /** Configuration options */
  config?: {
    /** Show URL copy button */
    showUrlCopy?: boolean;
    /** Show text copy button */
    showTextCopy?: boolean;
    /** Custom button labels */
    labels?: {
      url?: string;
      text?: string;
    };
    /** Success feedback timeout (ms) */
    successTimeout?: number;
    /** Button layout */
    layout?: 'horizontal' | 'vertical' | 'grid';
  };

  /** Custom styling */
  className?: string;
}

// ============================================================================
// COPY ACTIONS SECTION COMPONENT
// ============================================================================

export const CopyActionsSection: React.FC<CopyActionsProps> = ({
  copyData,
  onCopySuccess,
  onCopyError,
  loading = false,
  config = {},
  className
}) => {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  // ============================================================================
  // CONFIGURATION με DEFAULTS
  // ============================================================================

  const finalConfig = {
    showUrlCopy: true,
    showTextCopy: true,
    successTimeout: 2000,
    layout: 'horizontal' as const,
    ...config,
    labels: {
      url: t('copy.copyLink'),
      text: t('copy.copyText'),
      ...config.labels
    }
  };

  // ============================================================================
  // LOCAL STATE
  // ============================================================================

  const { copy: copyUrl, copied: copiedUrl } = useCopyToClipboard(finalConfig.successTimeout);
  const { copy: copyText, copied: copiedText } = useCopyToClipboard(finalConfig.successTimeout);

  const copiedStates = { url: copiedUrl, text: copiedText };

  const [errors, setErrors] = useState({
    url: null as string | null,
    text: null as string | null
  });

  // ============================================================================
  // COPY HANDLERS
  // ============================================================================

  /**
   * 📋 Generic Copy Handler με error handling
   */
  const handleCopy = useCallback(async (type: 'url' | 'text') => {
    try {
      setErrors(prev => ({ ...prev, [type]: null }));

      let textToCopy: string;

      if (type === 'url') {
        textToCopy = copyData.url;
      } else {
        // Compose full text με title, description και URL
        const parts = [
          copyData.title,
          copyData.text || '',
          copyData.url
        ].filter(Boolean);
        textToCopy = parts.join('\\n\\n');
      }

      // Copy to clipboard via centralized hook
      const copyFn = type === 'url' ? copyUrl : copyText;
      const success = await copyFn(textToCopy);

      if (success) {
        onCopySuccess?.(type);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('copy.copyError');
      setErrors(prev => ({ ...prev, [type]: errorMessage }));
      onCopyError?.(type, errorMessage);

      // Auto-clear error after timeout
      setTimeout(() => {
        setErrors(prev => ({ ...prev, [type]: null }));
      }, finalConfig.successTimeout);
    }
  }, [copyData, onCopySuccess, onCopyError, finalConfig.successTimeout, copyUrl, copyText, t]);

  /**
   * 🔗 Handle URL Copy
   */
  const handleCopyUrl = useCallback(() => {
    if (!loading) handleCopy('url');
  }, [handleCopy, loading]);

  /**
   * 📝 Handle Text Copy
   */
  const handleCopyText = useCallback(() => {
    if (!loading) handleCopy('text');
  }, [handleCopy, loading]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🎨 Get Button Style Classes για copy states
   */
  const getButtonClasses = (type: 'url' | 'text') => {
    const isCopied = copiedStates[type];
    const hasError = errors[type];

    return designSystem.cn(
      // Base button styles
      'flex-1 h-12',
      TRANSITION_PRESETS.STANDARD_ALL,
      designSystem.presets.button.outline,

      // State-specific styles using design system
      isCopied && designSystem.cn(
        designSystem.getStatusColor('success', 'border'),
        designSystem.getStatusColor('success', 'bg'),
        designSystem.getStatusColor('success', 'text'),
        // Enterprise semantic success styling via design system
      ),

      hasError && designSystem.cn(
        designSystem.getStatusColor('error', 'border'),
        designSystem.getStatusColor('error', 'bg'),
        designSystem.getStatusColor('error', 'text'),
        // Enterprise semantic error styling via design system
      ),

      !isCopied && !hasError && designSystem.cn(
        'border',
        type === 'url'
          ? HOVER_BORDER_EFFECTS.BLUE
          : HOVER_BORDER_EFFECTS.PURPLE
      ),

      // Loading state
      loading && 'opacity-50 cursor-not-allowed'
    );
  };

  /**
   * 🎯 Get Layout Classes
   */
  const getLayoutClasses = () => {
    const layoutMap = {
      horizontal: 'flex gap-3',
      vertical: 'flex flex-col gap-3',
      grid: 'grid grid-cols-2 gap-3'
    };

    return designSystem.cn(layoutMap[finalConfig.layout]);
  };

  /**
   * 🔘 Render Copy Button
   */
  const renderCopyButton = (type: 'url' | 'text') => {
    const isCopied = copiedStates[type];
    const hasError = errors[type];
    const isUrl = type === 'url';

    return (
      <Button
        key={type}
        type="button"
        variant="outline"
        disabled={loading}
        onClick={isUrl ? handleCopyUrl : handleCopyText}
        className={getButtonClasses(type)}
        aria-label={`${finalConfig.labels[type]} - ${
          isCopied ? t('copy.copySuccess') :
          hasError ? t('copy.copyError') : t('copy.clickToCopy')
        }`}
      >
        {isCopied ? (
          <>
            <Check className={`${iconSizes.sm} mr-2`} />
            {t('copy.copied')}
          </>
        ) : hasError ? (
          <>
            <AlertCircle className={`${iconSizes.sm} mr-2`} />
            {t('copy.error')}
          </>
        ) : (
          <>
            {isUrl ? (
              <Copy className={`${iconSizes.sm} mr-2`} />
            ) : (
              <ExternalLink className={`${iconSizes.sm} mr-2`} />
            )}
            {finalConfig.labels[type]}
          </>
        )}
      </Button>
    );
  };

  // ============================================================================
  // ACCESSIBILITY & PERFORMANCE
  // ============================================================================

  /**
   * ♿ Screen Reader Announcements
   */
  const getAriaLive = () => {
    const hasCopied = Object.values(copiedStates).some(Boolean);
    const hasErrors = Object.values(errors).some(Boolean);

    if (hasCopied || hasErrors) {
      return 'polite';
    }
    return 'off';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section
      className={designSystem.cn("space-y-3", className)}
      aria-live={getAriaLive()}
      role="region"
      aria-label={t('copy.quickActionsLabel')}
    >
      {/* Section Header με Design System */}
      <header className={designSystem.cn(
        "pt-4 border-t",
        designSystem.colorScheme.responsive.muted.split(' ')[0] // border-muted
      )} role="banner">
        <h3 className={designSystem.cn(
          designSystem.getTypographyClass('sm', 'medium'),
          designSystem.colorScheme.responsive.muted.split(' ')[1], // text-muted-foreground
          "mb-3"
        )}>
          {t('copy.quickActions')}
        </h3>
      </header>

      {/* Copy Buttons Grid */}
      <main className={getLayoutClasses()} role="main">
        {finalConfig.showUrlCopy && renderCopyButton('url')}
        {finalConfig.showTextCopy && renderCopyButton('text')}
      </main>

      {/* Error Messages (if any) */}
      {(errors.url || errors.text) && (
        <aside className={designSystem.cn(
          "p-3 rounded-lg",
          designSystem.getStatusColor('error', 'bg'),
          // Enterprise semantic error background
        )} role="alert" aria-label={t('copy.copyErrors')}>
          <p className={designSystem.cn(
            designSystem.getTypographyClass('sm'),
            designSystem.getStatusColor('error', 'text'),
            // Enterprise semantic error text
          )}>
            {errors.url || errors.text}
          </p>
        </aside>
      )}

    </section>
  );
};

// ============================================================================
// CONVENIENCE COMPONENTS για Common Use Cases
// ============================================================================

/**
 * 📱 Compact Copy Actions για mobile
 */
export const CompactCopyActions: React.FC<Omit<CopyActionsProps, 'config'>> = (props) => (
  <CopyActionsSection
    {...props}
    config={{
      layout: 'vertical',
      labels: {
        url: 'Link',
        text: 'Text'
      }
    }}
  />
);

/**
 * 🔗 URL Only Copy Action
 */
export const UrlOnlyCopyAction: React.FC<Omit<CopyActionsProps, 'config'>> = (props) => (
  <CopyActionsSection
    {...props}
    config={{
      showTextCopy: false,
      layout: 'horizontal'
    }}
  />
);

/**
 * 📝 Text Only Copy Action
 */
export const TextOnlyCopyAction: React.FC<Omit<CopyActionsProps, 'config'>> = (props) => (
  <CopyActionsSection
    {...props}
    config={{
      showUrlCopy: false,
      layout: 'horizontal'
    }}
  />
);

// ============================================================================
// EXPORTS
// ============================================================================

export default CopyActionsSection;
