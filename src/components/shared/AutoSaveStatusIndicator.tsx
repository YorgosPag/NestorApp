/**
 * @file AutoSaveStatusIndicator — Auto-Save Status UI Component
 * @module components/shared/AutoSaveStatusIndicator
 *
 * 🏢 ENTERPRISE: ADR-248 — Centralized Auto-Save System
 *
 * Reusable status indicator for auto-save state.
 * Replaces scattered inline status displays across 8+ components.
 *
 * Variants:
 * - inline: Status text with icon (for form headers)
 * - badge: Colored badge with label (for page headers)
 * - compact: Colored dot only (for toolbars)
 *
 * @see src/types/auto-save.ts
 * @see docs/centralized-systems/reference/adrs/ADR-248-centralized-auto-save.md
 * @created 2026-03-19
 */

/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import React, { useMemo } from 'react';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AutoSaveStatusIndicatorProps, SaveStatus } from '@/types/auto-save';
import '@/lib/design-system';

// ============================================
// RELATIVE TIME FORMATTER
// ============================================

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}

// ============================================
// STATUS CONFIG MAP
// ============================================

interface StatusConfig {
  icon: React.ElementType;
  dotColor: string;
  textColor: string;
  badgeBg: string;
  animate?: boolean;
}

const STATUS_CONFIG: Record<SaveStatus, StatusConfig> = {
  idle: {
    icon: CheckCircle2,
    dotColor: 'bg-gray-400 dark:bg-gray-500',
    textColor: 'text-gray-500 dark:text-gray-400',
    badgeBg: 'bg-gray-100 dark:bg-gray-800',
  },
  saving: {
    icon: Loader2,
    dotColor: 'bg-blue-500 dark:bg-blue-400',
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-50 dark:bg-blue-900/30',
    animate: true,
  },
  success: {
    icon: CheckCircle2,
    dotColor: 'bg-green-500 dark:bg-green-400',
    textColor: 'text-green-600 dark:text-green-400',
    badgeBg: 'bg-green-50 dark:bg-green-900/30',
  },
  error: {
    icon: AlertCircle,
    dotColor: 'bg-red-500 dark:bg-red-400',
    textColor: 'text-red-600 dark:text-red-400',
    badgeBg: 'bg-red-50 dark:bg-red-900/30',
  },
};

// ============================================
// COMPONENT
// ============================================

export function AutoSaveStatusIndicator({
  status,
  lastSaved,
  error,
  variant = 'inline',
  showTimestamp = true,
  onRetry,
  className,
}: AutoSaveStatusIndicatorProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // Relative timestamp (updates on re-render triggered by parent)
  const timestamp = useMemo(() => {
    if (!lastSaved || !showTimestamp) return null;
    return formatRelativeTime(lastSaved, new Date());
  }, [lastSaved, showTimestamp]);

  // Status label
  const label = useMemo(() => {
    switch (status) {
      case 'saving':
        return t('autoSave.saving');
      case 'success':
        return t('autoSave.saved');
      case 'error':
        return error || t('autoSave.error');
      case 'idle':
        return lastSaved ? t('autoSave.saved') : '';
      default:
        return '';
    }
  }, [status, error, lastSaved, t]);

  // Don't render anything if idle and never saved
  if (status === 'idle' && !lastSaved) return null;

  // ── Compact variant: colored dot only ──────────────────
  if (variant === 'compact') {
    return (
      <output
        aria-live="polite"
        aria-label={label}
        title={label}
        className={cn('inline-block', className)}
      >
        <span
          className={cn(
            'inline-block h-2 w-2 rounded-full',
            config.dotColor,
            config.animate && 'animate-pulse'
          )}
        />
      </output>
    );
  }

  // ── Badge variant: colored badge with label ────────────
  if (variant === 'badge') {
    return (
      <output
        aria-live="polite"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
          config.badgeBg,
          config.textColor,
          className
        )}
      >
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            config.dotColor,
            config.animate && 'animate-pulse'
          )}
        />
        <span>{label}</span>
        {status === 'success' && timestamp && (
          <span className="opacity-70">{timestamp}</span>
        )}
        {status === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 hover:opacity-80 transition-opacity"
            aria-label={t('autoSave.retry')}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </output>
    );
  }

  // ── Inline variant (default): icon + text ──────────────
  return (
    <output
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        config.textColor,
        className
      )}
    >
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          config.animate && 'animate-spin'
        )}
      />
      <span>{label}</span>
      {status === 'success' && timestamp && (
        <span className="opacity-60">{timestamp}</span>
      )}
      {status === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-1 underline hover:no-underline transition-all"
          aria-label={t('autoSave.retry')}
        >
          {t('autoSave.retry')}
        </button>
      )}
    </output>
  );
}
