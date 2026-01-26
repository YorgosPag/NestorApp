/**
 * 🏢 ENTERPRISE: Auth Action Error Boundary
 * @route /auth/action
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthActionError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Auth Action" />;
}
