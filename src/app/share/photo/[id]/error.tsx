/**
 * 🏢 ENTERPRISE: Share Photo Details Error Boundary
 * @route /share/photo/[id]
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SharePhotoDetailsError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Κοινοποίηση Φωτογραφίας" />;
}
