'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';

/**
 * ENTERPRISE ROUTE REDIRECT
 *
 * This page redirects /spaces/apartments to /units to maintain
 * backward compatibility while implementing the new Physical Space
 * vs Sellable Asset architecture.
 *
 * RATIONALE:
 * - /units contains complex enterprise components (PropertyGridView, AdvancedFilters)
 * - Avoid code duplication by redirecting instead of duplicating
 * - Maintains URL consistency for new navigation structure
 * - Preserves existing functionality during architecture migration
 *
 * 🏢 ENTERPRISE: Preserves URL parameters during redirect (contextual navigation)
 * 🔧 Next.js 15: useSearchParams() requires Suspense boundary
 */

/**
 * 🏢 ENTERPRISE: Inner component that uses useSearchParams
 * Wrapped in Suspense as required by Next.js 15
 */
function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const colors = useSemanticColors();

  useEffect(() => {
    // 🏢 ENTERPRISE: Preserve URL parameters during redirect (contextual navigation)
    const queryString = searchParams.toString();
    const targetUrl = queryString ? `/units?${queryString}` : '/units';
    router.replace(targetUrl);
  }, [router, searchParams]);

  // Loading state while redirecting
  return (
    <div className={`flex h-screen items-center justify-center ${colors.bg.primary}`}>
      <div className="text-center space-y-4">
        <AnimatedSpinner size="large" className="mx-auto" />
        <p className="text-sm text-muted-foreground">
          Ανακατεύθυνση στα Διαμερίσματα...
        </p>
      </div>
    </div>
  );
}

/**
 * 🔧 Next.js 15: Page component with Suspense boundary
 */
export default function SpacesApartmentsRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <AnimatedSpinner size="large" className="mx-auto" />
          <p className="text-sm text-muted-foreground">
            Φόρτωση...
          </p>
        </div>
      </div>
    }>
      <RedirectContent />
    </Suspense>
  );
}