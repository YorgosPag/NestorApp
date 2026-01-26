/**
 * 🏢 ENTERPRISE: Claims Repair Error Boundary
 * @route /admin/users/claims-repair
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ClaimsRepairError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Claims Repair" />;
}
