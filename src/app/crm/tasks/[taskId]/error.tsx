/**
 * ENTERPRISE: CRM Task Detail Error Boundary
 * @route /crm/tasks/[taskId]
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 * @see ADR-100: User Profile Sync (task detail page)
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CRMTaskDetailError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="CRM Task Detail" />;
}
