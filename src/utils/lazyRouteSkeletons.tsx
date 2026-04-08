'use client';

/**
 * =============================================================================
 * LAZY ROUTE LOADING SKELETONS - STATIC COMPONENTS
 * =============================================================================
 *
 * Enterprise Pattern: Zero-hook static skeletons for instant render
 * Used by createLazyRoute() as loading fallbacks during dynamic import
 *
 * @module utils/lazyRouteSkeletons
 * @enterprise ADR-294 - Dynamic Imports Optimization
 * @performance ZERO hooks — instant render (no 200-400ms hook delay)
 *
 * Pattern reference: Vercel, Google Cloud Console, Microsoft Azure Portal
 */

import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

export const PageLoadingSpinner = () => (
  <main className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
    <section className="text-center">
      <AnimatedSpinner size="large" className="mx-auto mb-6" aria-hidden="true" />
      <p className="text-muted-foreground">Loading...</p>
    </section>
  </main>
);

export const DashboardLoadingSkeleton = () => (
  <main className="min-h-screen bg-background" role="status" aria-label="Loading dashboard">
    <header className="border-b border-border bg-card">
      <section className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded-md w-48 animate-pulse" aria-hidden="true" />
            <div className="h-4 bg-muted rounded-md w-64 animate-pulse" aria-hidden="true" />
          </div>
          <div className="flex space-x-3">
            <div className="h-10 w-32 bg-muted rounded-md animate-pulse" aria-hidden="true" />
            <div className="h-10 w-10 bg-muted rounded-md animate-pulse" aria-hidden="true" />
          </div>
        </div>
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Loading statistics">
          {[0, 1, 2, 3].map((i) => (
            <article key={i} className="bg-background border border-border rounded-lg p-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded-md w-16 animate-pulse" aria-hidden="true" />
                <div className="h-8 bg-muted rounded-md w-20 animate-pulse" aria-hidden="true" />
                <div className="h-3 bg-muted rounded-md w-24 animate-pulse" aria-hidden="true" />
              </div>
            </article>
          ))}
        </section>
      </section>
    </header>
    <section className="p-6" aria-label="Loading content">
      <div className="h-64 bg-muted rounded-md animate-pulse" aria-hidden="true" />
    </section>
  </main>
);

export const FormLoadingSkeleton = () => (
  <main className="min-h-screen bg-background p-6" role="status" aria-label="Loading form">
    <section className="max-w-4xl mx-auto">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded-md w-48 animate-pulse" aria-hidden="true" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded-md w-24 animate-pulse" aria-hidden="true" />
                <div className="h-10 bg-muted rounded-md animate-pulse" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded-md w-32 animate-pulse" aria-hidden="true" />
            <div className="h-24 bg-muted rounded-md animate-pulse" aria-hidden="true" />
          </div>
          <div className="flex justify-end space-x-3">
            <div className="h-10 w-20 bg-muted rounded-md animate-pulse" aria-hidden="true" />
            <div className="h-10 w-20 bg-muted rounded-md animate-pulse" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  </main>
);

export const ListLoadingSkeleton = () => (
  <main className="min-h-screen bg-background" role="status" aria-label="Loading list">
    <header className="border-b border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-muted rounded-md w-32 animate-pulse" aria-hidden="true" />
        <div className="h-10 w-32 bg-muted rounded-md animate-pulse" aria-hidden="true" />
      </div>
    </header>
    <section className="p-6">
      <ul role="list" className="space-y-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <li key={i}>
            <article className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-5 bg-muted rounded-md w-32 animate-pulse" aria-hidden="true" />
                  <div className="h-4 bg-muted rounded-md w-48 animate-pulse" aria-hidden="true" />
                </div>
                <div className="h-10 w-10 bg-muted rounded-full animate-pulse" aria-hidden="true" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  </main>
);
