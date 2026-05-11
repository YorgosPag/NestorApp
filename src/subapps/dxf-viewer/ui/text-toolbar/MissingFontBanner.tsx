'use client';

/**
 * MissingFontBanner — non-blocking notification banner for missing SHX fonts
 * (ADR-344 Phase 2, Q20).
 *
 * Shown below the toolbar when a DXF file references fonts not in the company
 * library. Users can view affected entities on the canvas or jump to upload.
 *
 * Rules:
 * - Zero inline styles (CLAUDE.md N.3)
 * - All strings via t('textFonts.*') (CLAUDE.md N.11)
 * - Radix UI primitives per ADR-001
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { MissingFontReport } from '../text-engine/fonts/font-loader';

interface MissingFontBannerProps {
  report: MissingFontReport;
  onViewAffected: () => void;
  onUpload: () => void;
  onDismiss: () => void;
}

export function MissingFontBanner({
  report,
  onViewAffected,
  onUpload,
  onDismiss,
}: MissingFontBannerProps) {
  const { t } = useTranslation(['textFonts']);
  const count = report.missing.length;

  if (count === 0) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950"
    >
      <div className="flex min-w-0 flex-col">
        <span className="font-medium text-amber-900 dark:text-amber-200">
          {t('textFonts:missingBanner.title', { count })}
        </span>
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {t('textFonts:missingBanner.subtitle')}
        </span>
      </div>

      <nav className="flex shrink-0 items-center gap-2">
        {report.affectedEntityIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onViewAffected}>
            {t('textFonts:missingBanner.viewAffected')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onUpload}>
          {t('textFonts:missingBanner.upload')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} aria-label={t('textFonts:missingBanner.dismiss')}>
          ✕
        </Button>
      </nav>
    </aside>
  );
}
