/**
 * =============================================================================
 * 🏢 ENTERPRISE: ShareStatusBanner — Error / Loading Display
 * =============================================================================
 *
 * Tiny sub-component split from ShareSurfaceShell for SRP + size compliance.
 * Renders a status region visible to assistive tech during submit/error.
 *
 * @module components/ui/sharing/ShareStatusBanner
 * @see ADR-147 Unified Share Surface
 */

'use client';

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { ShareFlowStatus } from '@/types/sharing';

export interface ShareStatusBannerProps {
  status: ShareFlowStatus;
  error: string | null;
  errorPrefix: string;
}

export function ShareStatusBanner({
  status,
  error,
  errorPrefix,
}: ShareStatusBannerProps): React.ReactElement | null {
  const { t } = useTranslation('common-shared');

  if (status === 'submitting') {
    return (
      <output
        aria-live="polite"
        aria-label={t('shareSurface.a11y.statusRegion')}
        className={cn(
          'flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800',
          'dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200',
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>{t('shareSurface.submitting')}</span>
      </output>
    );
  }

  if (status === 'error' && error) {
    return (
      <output
        aria-live="assertive"
        aria-label={t('shareSurface.a11y.statusRegion')}
        role="alert"
        className={cn(
          'flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800',
          'dark:border-red-800 dark:bg-red-950 dark:text-red-200',
        )}
      >
        <AlertCircle
          className="mt-0.5 h-4 w-4 flex-shrink-0"
          aria-hidden="true"
        />
        <span>
          <strong>{errorPrefix}:</strong> {error}
        </span>
      </output>
    );
  }

  return null;
}
