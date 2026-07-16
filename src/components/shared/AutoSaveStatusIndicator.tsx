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

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useMemo } from 'react';
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AutoSaveStatusIndicatorProps, SaveStatus } from '@/types/auto-save';
import '@/lib/design-system';

// ============================================
// RELATIVE TIME FORMATTER
// ============================================

function formatSaveAge(date: Date, now: Date): string {
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
    dotColor: 'bg-muted-foreground',
    textColor: 'text-muted-foreground',
    badgeBg: 'bg-muted',
  },
  saving: {
    icon: Loader2,
    dotColor: 'bg-primary',
    textColor: 'text-primary',
    badgeBg: 'bg-[hsl(var(--bg-info))]/20',
    animate: true,
  },
  success: {
    icon: CheckCircle2,
    dotColor: 'bg-[hsl(var(--text-success))]',
    textColor: 'text-[hsl(var(--text-success))]',
    badgeBg: 'bg-[hsl(var(--bg-success))]/10',
  },
  error: {
    icon: AlertCircle,
    dotColor: 'bg-destructive',
    textColor: 'text-destructive',
    badgeBg: 'bg-destructive/10',
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
  const { t } = useTranslation(COMMON_NAMESPACES);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  // Relative timestamp (updates on re-render triggered by parent)
  const timestamp = useMemo(() => {
    if (!lastSaved || !showTimestamp) return null;
    return formatSaveAge(lastSaved, new Date());
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
      <Tooltip>
        <TooltipTrigger asChild>
          <output
            aria-live="polite"
            aria-label={label}
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
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
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
