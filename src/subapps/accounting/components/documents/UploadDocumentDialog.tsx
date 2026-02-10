'use client';

/**
 * @fileoverview Accounting Subapp — Upload Document Dialog
 * @description Dialog for submitting a document URL for AI processing
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-005 AI Document Processing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import type { DocumentType } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fiscalYear: number;
  onSuccess: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DOCUMENT_TYPE_CODES: DocumentType[] = [
  'purchase_invoice', 'receipt', 'utility_bill', 'telecom_bill',
  'fuel_receipt', 'bank_statement', 'other',
];

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

// ============================================================================
// HELPERS
// ============================================================================

function guessFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/');
    return segments[segments.length - 1] || 'document';
  } catch {
    return 'document';
  }
}

function guessMimeType(url: string): string {
  const lower = url.toLowerCase();
  for (const [ext, mime] of Object.entries(MIME_TYPES)) {
    if (lower.includes(`.${ext}`)) return mime;
  }
  return 'application/octet-stream';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UploadDocumentDialog({
  open,
  onOpenChange,
  fiscalYear,
  onSuccess,
}: UploadDocumentDialogProps) {
  const { t } = useTranslation('accounting');
  const { user } = useAuth();

  const [fileUrl, setFileUrl] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!user || !fileUrl.trim()) return;

    try {
      setSubmitting(true);
      setError(null);

      const token = await user.getIdToken();
      const fileName = guessFileName(fileUrl);
      const mimeType = guessMimeType(fileUrl);

      const response = await fetch('/api/accounting/documents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileUrl: fileUrl.trim(),
          fileName,
          mimeType,
          fileSize: 0,
          fiscalYear,
          documentType,
        }),
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      // Reset and close
      setFileUrl('');
      setDocumentType('other');
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit document';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [user, fileUrl, documentType, fiscalYear, onOpenChange, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('documents.uploadTitle')}</DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <fieldset>
            <Label htmlFor="upload-url">{t('documents.fileUrl')}</Label>
            <Input
              id="upload-url"
              type="url"
              placeholder="https://..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('documents.fileUrlHint')}
            </p>
          </fieldset>

          <fieldset>
            <Label htmlFor="upload-type">{t('documents.documentType')}</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
              <SelectTrigger id="upload-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {t(`documentTypes.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('forms.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !fileUrl.trim()}>
              {submitting ? <Spinner size="small" className="mr-2" /> : null}
              {t('documents.submitForAnalysis')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
