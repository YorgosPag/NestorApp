/**
 * 🏢 ENTERPRISE: CRM Communications Error Boundary
 * @route /crm/communications
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CRMCommunicationsError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="CRM Communications" />;
}
