/**
 * 🏢 ENTERPRISE: Enterprise Migration Error Boundary
 * @route /admin/enterprise-migration
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function EnterpriseMigrationError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Enterprise Migration" />;
}
