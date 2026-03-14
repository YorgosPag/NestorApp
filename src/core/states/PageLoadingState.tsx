'use client';

/**
 * =============================================================================
 * 🏢 PAGE LOADING STATE — Centralized Page-Level Loading (ADR-229)
 * =============================================================================
 *
 * Single source of truth για page-level loading spinners.
 * Αντικαθιστά 6+ scattered patterns σε parking, storage, buildings κλπ.
 *
 * @module core/states/PageLoadingState
 * @version 1.0.0
 * @see ADR-229-centralized-page-loading-states.md
 *
 * Usage:
 * ```tsx
 * // Default spinner (Loader2)
 * <PageLoadingState message={t('pages.parking.loading')} />
 *
 * // Domain icon (Car, Warehouse, Building, etc.)
 * <PageLoadingState icon={Car} message={t('pages.parking.loading')} />
 * ```
 */

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Spinner } from '@/components/ui/spinner';

// =============================================================================
// TYPES
// =============================================================================

export interface PageLoadingStateProps {
  /** Domain icon (Car, Warehouse, etc.) — rendered with animate-spin */
  icon?: LucideIcon;
  /** Translated loading message */
  message: string;
  /** fullscreen = h-screen, contained = flex-1 (inside PageContainer) */
  layout?: 'fullscreen' | 'contained';
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PageLoadingState({
  icon: Icon,
  message,
  layout = 'fullscreen',
}: PageLoadingStateProps) {
  const iconSizes = useIconSizes();

  const layoutClass = layout === 'fullscreen'
    ? 'flex h-screen items-center justify-center'
    : 'flex flex-1 items-center justify-center';

  return (
    <section className={layoutClass} role="status" aria-live="polite">
      <div className="text-center">
        {Icon && (
          <Icon className={cn(iconSizes.xl, 'mx-auto mb-2 text-muted-foreground')} />
        )}
        <Spinner size="large" className="mx-auto mb-4" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </section>
  );
}
