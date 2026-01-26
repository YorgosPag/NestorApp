/**
 * 🏢 ENTERPRISE: CRM Dashboard Error Boundary
 * @route /crm/dashboard
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CRMDashboardError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="CRM Dashboard" />;
}
