// ============================================================================
// IMPORT CONTACTS DIALOG - Bulk CSV/JSON import using centralized DataImportService
// ============================================================================
//
// SSoT: Uses contact-data-exchange.ts -> DataImportService
//
// ============================================================================

'use client';

import { cn } from '@/lib/design-system';
import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { parseContactImportFile } from '@/utils/contacts/contact-data-exchange';
import type { ContactImportRecord } from '@/utils/contacts/contact-data-exchange';
import type { ImportResult } from '@/services/data-exchange/DataImportService';
import { createModuleLogger } from '@/lib/telemetry';
import { getStatusColor } from '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const logger = createModuleLogger('ImportContactsDialog');

// ============================================================================
// TYPES
// ============================================================================

interface ImportContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (records: ContactImportRecord[]) => void;
}

type ImportState = 'idle' | 'parsing' | 'preview' | 'error';

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportContactsDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ImportContactsDialogProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<ImportState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult<ContactImportRecord> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setState('idle');
      setSelectedFile(null);
      setResult(null);
      setParseError(null);
    }
    onOpenChange(isOpen);
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setState('parsing');
    setParseError(null);

    try {
      const importResult = await parseContactImportFile(file);
      setResult(importResult);
      setState(importResult.errors.length > 0 && importResult.validRecords === 0 ? 'error' : 'preview');
    } catch (err) {
      logger.error('Failed to parse import file', { error: err });
      setParseError(t('import.parseError'));
      setState('error');
    }
  };

  // Confirm import
  const handleConfirmImport = () => {
    if (!result || result.validRecords === 0) return;
    onImportComplete(result.data as ContactImportRecord[]);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className={iconSizes.md} />
            {t('import.title')}
          </DialogTitle>
          <DialogDescription>
            {t('import.description')}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2 py-2">
          {/* File picker */}
          <div className="flex flex-col items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={state === 'parsing'}
              className="w-full"
            >
              <FileText className={`${iconSizes.sm} mr-2`} />
              {selectedFile ? selectedFile.name : t('import.selectFile')}
            </Button>
            <p className={cn("text-xs", colors.text.muted)}>{t('import.acceptedFormats')}</p>
          </div>

          {/* Parsing state */}
          {state === 'parsing' && (
            <p className={cn("text-center text-sm animate-pulse", colors.text.muted)}>
              {t('import.parsing')}
            </p>
          )}

          {/* Preview results */}
          {state === 'preview' && result && (
            <div className="space-y-2 rounded-lg border p-2 bg-muted/30">
              <div className={`flex items-center gap-2 text-sm font-medium ${getStatusColor('active', 'text')}`}>
                <CheckCircle2 className={iconSizes.sm} />
                {t('import.previewReady')}
              </div>
              <ul className={cn("text-sm space-y-1", colors.text.muted)}>
                <li>{t('import.totalRecords', { count: result.totalRecords })}</li>
                <li>{t('import.validRecords', { count: result.validRecords })}</li>
                {result.invalidRecords > 0 && (
                  <li className="text-amber-600">
                    {t('import.invalidRecords', { count: result.invalidRecords })}
                  </li>
                )}
                {result.warnings.length > 0 && (
                  <li className="text-amber-600">
                    {t('import.warnings', { count: result.warnings.length })}
                  </li>
                )}
              </ul>
              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer text-destructive">
                    {t('import.showErrors', { count: result.errors.length })}
                  </summary>
                  <ul className="mt-1 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 20).map((err, i) => (
                      <li key={i} className="text-destructive">
                        {t('import.row')} {err.row}: {err.message} {err.field ? `(${err.field})` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Error state */}
          {state === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2">
              <AlertCircle className={`${iconSizes.sm} text-destructive mt-0.5`} />
              <p className="text-sm text-destructive">
                {parseError || t('import.allInvalid')}
              </p>
            </div>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('import.cancel')}
          </Button>
          <Button
            onClick={handleConfirmImport}
            disabled={state !== 'preview' || !result || result.validRecords === 0}
          >
            {t('import.confirm', { count: result?.validRecords ?? 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
