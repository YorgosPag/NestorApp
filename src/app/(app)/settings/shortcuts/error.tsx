/**
 * 🏢 ENTERPRISE: Keyboard Shortcuts Error Boundary
 * @route /settings/shortcuts
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function KeyboardShortcutsError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Keyboard Shortcuts" />;
}
