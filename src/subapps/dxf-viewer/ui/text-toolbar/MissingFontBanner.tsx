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
import type { MissingFontReport } from '../../text-engine/fonts/font-loader';

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
      className="flex items-center justify-between gap-3 border-b border-[hsl(var(--text-warning))] bg-[hsl(var(--bg-warning))]/40 px-4 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-col">
        <span className="font-medium text-foreground">
          {t('textFonts:missingBanner.title', { count })}
        </span>
        <span className="text-xs text-[hsl(var(--text-warning))]">
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
