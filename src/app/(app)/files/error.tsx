/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Manager Error Boundary
 * =============================================================================
 *
 * Error boundary για το File Manager route.
 * Uses centralized RouteErrorFallback for consistent error UI across the app.
 *
 * @route /files
 * @enterprise SAP/Salesforce/Microsoft - Single Source of Truth Pattern
 * @updated 2026-01-26 - Migrated to centralized RouteErrorFallback
 */

'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * File Manager Error Component
 *
 * Uses centralized RouteErrorFallback for consistent error experience.
 * Features: Email providers, Copy details, Notify admin, Anonymous report
 */
export default function FileManagerError({ error, reset }: ErrorProps) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      componentName="File Manager"
      enableReporting
    />
  );
}
