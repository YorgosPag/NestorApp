/**
 * =============================================================================
 * 🏢 STATIC PAGE LOADING — Server Component for Suspense Fallbacks (ADR-229)
 * =============================================================================
 *
 * For Suspense fallbacks in page.tsx exports — NO hooks, NO 'use client'.
 * Uses hardcoded Tailwind sizes since useIconSizes() is not available.
 *
 * Visual appearance matches PageLoadingState for consistency.
 *
 * @module core/states/StaticPageLoading
 * @version 1.0.0
 * @see ADR-229-centralized-page-loading-states.md
 *
 * Usage:
 * ```tsx
 * // In page.tsx default export (server context)
 * <Suspense fallback={<StaticPageLoading icon={Car} />}>
 *   <PageContent />
 * </Suspense>
 * ```
 */

import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface StaticPageLoadingProps {
  /** Domain icon (Car, Warehouse, etc.) — rendered with animate-spin */
  icon?: LucideIcon;
  /** Static loading text (default: "Φόρτωση...") */
  message?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StaticPageLoading({
  icon: Icon,
  message = 'Φόρτωση...',
}: StaticPageLoadingProps) {
  const SpinnerIcon = Icon ?? Loader2;

  return (
    <section
      className="flex h-screen items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <SpinnerIcon className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </section>
  );
}
