/**
 * 🏢 ENTERPRISE: Storage Details Error Boundary
 * @route /storage/[id]
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StorageDetailsError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Λεπτομέρειες Αποθήκευσης" />;
}
