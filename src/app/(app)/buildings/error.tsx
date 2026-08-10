/**
 * =============================================================================
 * 🏢 ENTERPRISE: Buildings Error Boundary
 * =============================================================================
 *
 * Error boundary για το Buildings route.
 * Uses centralized RouteErrorFallback for consistent error UI across the app.
 *
 * @route /buildings
 * @enterprise SAP/Salesforce/Microsoft - Single Source of Truth Pattern
 * @updated 2026-01-26 - Migrated to centralized RouteErrorFallback
 */

'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface BuildingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Buildings Error Component
 *
 * Uses centralized RouteErrorFallback for consistent error experience.
 * Features: Email providers, Copy details, Notify admin, Anonymous report
 */
export default function BuildingsError({ error, reset }: BuildingsErrorProps) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      componentName="Buildings"
      enableReporting
    />
  );
}