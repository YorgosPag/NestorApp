/**
 * 🏢 ENTERPRISE: DXF Module Error Boundary
 * @route /dxf/*
 * @enterprise SAP/Salesforce/Microsoft - Centralized Error Handling
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DXFError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="DXF Viewer" />;
}
