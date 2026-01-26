/**
 * 🏢 ENTERPRISE: CRM Pipeline Error Boundary
 * @route /crm/pipeline
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CRMPipelineError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="CRM Pipeline" />;
}
