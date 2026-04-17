/**
 * 🏢 ENTERPRISE: Backup & Restore Error Boundary
 * @route /admin/backup
 * @enterprise ADR-313 - Enterprise Backup & Restore
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BackupError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Backup & Restore" />;
}
