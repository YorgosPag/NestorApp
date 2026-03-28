'use client';

/**
 * =============================================================================
 * 🏢 PAGE ERROR STATE — Centralized Page-Level Error (ADR-229)
 * =============================================================================
 *
 * Single source of truth για page-level error displays.
 * Αντικαθιστά hardcoded text-red-500 με semantic text-destructive.
 * Χρησιμοποιεί τον canonical Button component αντί inline <button>.
 *
 * @module core/states/PageErrorState
 * @version 1.0.0
 * @see ADR-229-centralized-page-loading-states.md
 *
 * Usage:
 * ```tsx
 * <PageErrorState
 *   title={t('pages.parking.error.title')}
 *   message={error}
 *   onRetry={refetch}
 *   retryLabel={t('pages.parking.error.retry')}
 * />
 * ```
 */

import { AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Button } from '@/components/ui/button';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TYPES
// =============================================================================

export interface PageErrorStateProps {
  /** Error title */
  title: string;
  /** Error detail message */
  message?: string;
  /** Retry callback — shows retry Button when provided */
  onRetry?: () => void;
  /** Custom retry button label */
  retryLabel?: string;
  /** fullscreen = h-screen, contained = flex-1 */
  layout?: 'fullscreen' | 'contained';
  /** Custom error icon (default: AlertTriangle) */
  icon?: LucideIcon;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PageErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  layout = 'fullscreen',
  icon: Icon = AlertTriangle,
}: PageErrorStateProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const layoutClass = layout === 'fullscreen'
    ? 'flex h-screen items-center justify-center'
    : 'flex flex-1 items-center justify-center';

  return (
    <section className={layoutClass} role="alert">
      <div className="text-center">
        <Icon className={cn(iconSizes.xl, 'mx-auto mb-4 text-destructive')} />
        <p className="text-destructive text-lg font-medium mb-2">{title}</p>
        {message && (
          <p className={cn("mb-4", colors.text.muted)}>{message}</p>
        )}
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            {retryLabel ?? 'Retry'}
          </Button>
        )}
      </div>
    </section>
  );
}
