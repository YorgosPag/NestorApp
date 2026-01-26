/**
 * 🏢 ENTERPRISE: Account Profile Error Boundary
 * @route /account/profile
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AccountProfileError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Account Profile" />;
}
