/**
 * 🏢 ENTERPRISE: DXF Viewer Error Boundary
 * @route /dxf/viewer
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DxfViewerError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="DXF Viewer" />;
}
