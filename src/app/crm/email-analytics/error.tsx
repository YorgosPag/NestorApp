/**
 * 🏢 ENTERPRISE: CRM Email Analytics Error Boundary
 * @route /crm/email-analytics
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CRMEmailAnalyticsError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="CRM Email Analytics" />;
}
