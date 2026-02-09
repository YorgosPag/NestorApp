'use client';

/**
 * @fileoverview Accounting Subapp — CSV Import Dialog
 * @description Dialog for importing bank transactions from CSV files
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-008 Bank Reconciliation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ImportBatch } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (accountId: string, file: File) => Promise<ImportBatch | null>;
  onSuccess: () => void;
}

type BankCode = 'nbg' | 'eurobank' | 'piraeus' | 'alpha';

interface BankOption {
  code: BankCode;
  labelKey: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BANK_OPTIONS: BankOption[] = [
  { code: 'nbg', labelKey: 'banks.nbg' },
  { code: 'eurobank', labelKey: 'banks.eurobank' },
  { code: 'piraeus', labelKey: 'banks.piraeus' },
  { code: 'alpha', labelKey: 'banks.alpha' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportCSVDialog({
  open,
  onOpenChange,
  onImport,
  onSuccess,
}: ImportCSVDialogProps) {
  const { t } = useTranslation('accounting');

  const [selectedBank, setSelectedBank] = useState<BankCode | ''>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedBank || !selectedFile) return;

    try {
      setUploading(true);
      setError(null);

      const result = await onImport(selectedBank, selectedFile);

      if (result) {
        setSelectedBank('');
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onSuccess();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('bank.importError');
      setError(message);
    } finally {
      setUploading(false);
    }
  }, [selectedBank, selectedFile, onImport, onSuccess, t]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setSelectedBank('');
        setSelectedFile(null);
        setError(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
      onOpenChange(isOpen);
    },
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('bank.importCSVTitle')}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleUpload();
          }}
        >
          {/* Bank Selection */}
          <fieldset className="space-y-2">
            <Label htmlFor="bank-select">{t('bank.selectBank')}</Label>
            <Select
              value={selectedBank || undefined}
              onValueChange={(v) => setSelectedBank(v as BankCode)}
            >
              <SelectTrigger id="bank-select">
                <SelectValue placeholder={t('bank.selectBankPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {BANK_OPTIONS.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    {t(bank.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* File Input */}
          <fieldset className="space-y-2">
            <Label htmlFor="csv-file">{t('bank.selectFile')}</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="mr-2 h-4 w-4" />
                {t('bank.chooseFile')}
              </Button>
              {selectedFile && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="csv-file"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="sr-only"
            />
          </fieldset>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Upload Button */}
          <Button
            type="submit"
            disabled={!selectedBank || !selectedFile || uploading}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? t('bank.uploading') : t('bank.upload')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
