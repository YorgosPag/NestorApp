'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';

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
 */
export default function SpacesApartmentsRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iconSizes = useIconSizes();
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