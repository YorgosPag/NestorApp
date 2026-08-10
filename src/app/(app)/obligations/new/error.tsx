/**
 * 🏢 ENTERPRISE: New Obligation Error Boundary
 * @route /obligations/new
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function NewObligationError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="New Obligation" />;
}
