'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
 */
export default function SpacesApartmentsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Enterprise-grade client-side redirect
    router.replace('/units');
  }, [router]);

  // Loading state while redirecting
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground">
          Ανακατεύθυνση στα Διαμερίσματα...
        </p>
      </div>
    </div>
  );
}