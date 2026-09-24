/**
 * 🏢 ENTERPRISE: Landing Heroes Error Boundary (ADR-881)
 * @route /admin/landing-heroes
 */
'use client';

import { RouteErrorFallback } from '@/components/ui/ErrorBoundary/ErrorBoundary';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function LandingHeroesError({ error, reset }: ErrorProps) {
  return <RouteErrorFallback error={error} reset={reset} componentName="Landing Heroes" />;
}
