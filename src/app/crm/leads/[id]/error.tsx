/**
 * 🏢 ENTERPRISE: Lead Details Error Boundary
 * @route /crm/leads/[id]
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LeadDetailsError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Λεπτομέρειες Lead" />;
}
