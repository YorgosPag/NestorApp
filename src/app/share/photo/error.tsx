/**
 * 🏢 ENTERPRISE: Share Photo Error Boundary
 * @route /share/photo
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SharePhotoError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Share Photo" />;
}
