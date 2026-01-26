/**
 * =============================================================================
 * 🏢 ENTERPRISE: Global Error Boundary
 * =============================================================================
 *
 * Global error boundary για Next.js 15 App Router.
 * Uses centralized RouteErrorFallback for consistent error UI across the app.
 *
 * NOTE: global-error.tsx requires <html> and <body> tags because it replaces
 * the entire document when triggered. RouteErrorFallback is wrapped accordingly.
 *
 * @route Global (catches all unhandled errors)
 * @enterprise SAP/Salesforce/Microsoft - Single Source of Truth Pattern
 * @updated 2026-01-26 - Migrated to centralized RouteErrorFallback
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
 * Features: Email providers, Copy details, Notify admin, Anonymous report
 *
 * @note Required <html> and <body> tags for global-error.tsx
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="el">
      <body>
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
