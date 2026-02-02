/**
 * =============================================================================
 * 🏢 ENTERPRISE: Global Error Boundary
 * =============================================================================
 *
 * Global error boundary για Next.js 15 App Router.
 * Uses centralized RouteErrorFallback for consistent error UI across the app.
 *
 * NOTE: global-error.tsx requires <html> and <body> tags because it replaces
 * the entire document when triggered. RouteErrorFallback uses useTourSafe()
 * for graceful degradation (works with or without TourProvider).
 *
 * @route Global (catches all unhandled errors)
 * @enterprise SAP/Salesforce/Microsoft - Graceful Degradation Pattern
 * @updated 2026-02-02 - Uses useTourSafe() for standalone operation
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Component
 *
 * Uses centralized RouteErrorFallback wrapped in html/body tags.
 * No provider stack needed - RouteErrorFallback uses useTourSafe() for graceful degradation.
 *
 * Features: Email providers, Copy details, Notify admin, Anonymous report
 *
 * @note Required <html> and <body> tags for global-error.tsx
 * @note No TourProvider needed - useTourSafe() handles missing context gracefully
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="el">
      <body>
        {/* 🏢 ENTERPRISE: Standalone error UI - no dependencies */}
        <RouteErrorFallback
          error={error}
          reset={reset}
          componentName="Application"
          enableReporting={true}
        />
      </body>
    </html>
  );
}
