'use client';

/**
 * @module ReportExportBar
 * @enterprise ADR-265 — Export buttons (PDF/Excel/CSV)
 *
 * Phase 1: All buttons are disabled stubs with "coming soon" tooltip.
 * Phase 2: onExport callback will trigger dynamic import of export services.
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ReportExportBarProps {
  /** Export handler — noop in Phase 1 */
  onExport?: (format: ExportFormat) => void;
  /** Force all buttons disabled */
  disabled?: boolean;
  /** Which formats to show (default: all) */
  formats?: ExportFormat[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORMAT_CONFIG: Record<ExportFormat, {
  icon: typeof FileDown;
  labelKey: string;
}> = {
  pdf: { icon: FileDown, labelKey: 'export.pdf' },
  excel: { icon: FileSpreadsheet, labelKey: 'export.excel' },
  csv: { icon: FileText, labelKey: 'export.csv' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportExportBar({
  onExport,
  disabled = false,
  formats = ['pdf', 'excel', 'csv'],
  className,
}: ReportExportBarProps) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();

  return (
    <TooltipProvider>
      <nav
        className={cn('flex items-center gap-2', className)}
        aria-label={t('export.title')}
      >
        {formats.map((format) => {
          const config = FORMAT_CONFIG[format];
          const Icon = config.icon;

          return (
            <Tooltip key={format}>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onExport?.(format)}
                    className="gap-1.5"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{t(config.labelKey)}</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {disabled && (
                <TooltipContent>
                  <p className={cn('text-xs', colors.text.muted)}>
                    {t('export.comingSoon')}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
