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
        className="flex items-center gap-2 rounded-md border border-border bg-[hsl(var(--bg-info))]/20 px-3 py-2 text-sm text-primary"
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
        className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
