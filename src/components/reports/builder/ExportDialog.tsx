/**
 * @module components/reports/builder/ExportDialog
 * @enterprise ADR-268 Phase 3 — Export configuration dialog
 *
 * Shows when cross-filter is active → scope choice.
 * Shows watermark dropdown for PDF.
 * Loading UX: button spinner + toast notification.
 *
 * @see QA.md Q59 (cross-filter scope), Q61 (loading UX), Q63 (watermark)
 */

'use client';

import '@/lib/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type {
  ExportFormat,
  WatermarkMode,
  ExportScope,
} from '@/services/report-engine/builder-export-types';
import type { ChartCrossFilter } from '@/config/report-builder/report-builder-types';

// ============================================================================
// Types
// ============================================================================

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (format: ExportFormat, watermark: WatermarkMode, scope: ExportScope) => Promise<void>;
  crossFilter: ChartCrossFilter | null;
  totalRecords: number;
  filteredRecords: number;
  exporting: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ExportDialog({
  open,
  onOpenChange,
  onExport,
  crossFilter,
  totalRecords,
  filteredRecords,
  exporting,
}: ExportDialogProps) {
  const { t } = useTranslation('report-builder');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [watermark, setWatermark] = useState<WatermarkMode>('none');
  const [scope, setScope] = useState<ExportScope>('all');

  const handleExport = () => {
    void onExport(format, watermark, scope);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('export.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {crossFilter
              ? t('export.crossFilterActive', {
                  field: crossFilter.fieldKey,
                  value: crossFilter.label,
                })
              : t('export.title')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Format selector */}
          <fieldset className="space-y-2">
            <Label>{t('export.format')}</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <span className="flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    {t('export.pdf')}
                  </span>
                </SelectItem>
                <SelectItem value="excel">
                  <span className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {t('export.excel')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </fieldset>

          {/* Watermark — PDF only */}
          {format === 'pdf' && (
            <fieldset className="space-y-2">
              <Label>{t('export.watermark')}</Label>
              <Select
                value={watermark}
                onValueChange={(v) => setWatermark(v as WatermarkMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('export.watermarkNone')}</SelectItem>
                  <SelectItem value="confidential">{t('export.watermarkConfidential')}</SelectItem>
                  <SelectItem value="confidential-user">{t('export.watermarkConfidentialUser')}</SelectItem>
                </SelectContent>
              </Select>
            </fieldset>
          )}

          {/* Scope — only when cross-filter active */}
          {crossFilter && (
            <fieldset className="space-y-2">
              <Label>{t('export.scope')}</Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as ExportScope)}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="cursor-pointer font-normal">
                    {t('export.scopeAll', { count: totalRecords })}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="filtered" id="scope-filtered" />
                  <Label htmlFor="scope-filtered" className="cursor-pointer font-normal">
                    {t('export.scopeFiltered', { count: filteredRecords })}
                  </Label>
                </div>
              </RadioGroup>
            </fieldset>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={exporting}>
            {t('export.cancel')}
          </AlertDialogCancel>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('export.exporting')}
              </>
            ) : (
              t('export.confirm')
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
