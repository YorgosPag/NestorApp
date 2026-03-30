'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Ban,
  FileX2,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { API_ROUTES } from '@/config/domain-constants';
import type { Invoice, CancellationReasonCode } from '@/subapps/accounting/types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrency } from '../../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface CancelInvoiceDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type CancelStatus = 'idle' | 'cancelling' | 'success' | 'error';

/**
 * Determines if invoice is a draft (voidable) or issued (requires credit note).
 * Mirrors backend VOIDABLE_STATUSES / CREDIT_NOTE_STATUSES sets.
 */
type CancelPath = 'void' | 'credit_note';

function resolveCancelPath(status: string): CancelPath {
  if (status === 'draft' || status === 'rejected') return 'void';
  return 'credit_note';
}

// ============================================================================
// REASON CODES
// ============================================================================

const REASON_CODES: readonly CancellationReasonCode[] = [
  'BILLING_ERROR',
  'DUPLICATE',
  'ORDER_CANCELLED',
  'TERMS_CHANGED',
  'GOODS_RETURNED',
  'OTHER',
];

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Cancel Invoice / Issue Credit Note Dialog.
 *
 * - Path A (Draft/Rejected): Soft-delete + journal reversal (void)
 * - Path B (Sent/Accepted): Creates credit note (ελληνικός νόμος, Ν. 4308/2014)
 *
 * Follows SAP/NetSuite enterprise pattern:
 * - Mandatory reason dropdown
 * - Notes required when reason = OTHER
 * - Irreversible action (8/8 enterprise platforms)
 *
 * @see RESEARCH-A1-INVOICE-CANCELLATION-UI.md
 * @see ADR-ACC-002, AUDIT-2026-03-29 Task A-1
 */
export function CancelInvoiceDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: CancelInvoiceDialogProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();
  const { user } = useAuth();

  const path = resolveCancelPath(invoice.mydata.status);
  const isVoid = path === 'void';

  const [reasonCode, setReasonCode] = useState<CancellationReasonCode | ''>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CancelStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const selectRef = useRef<HTMLButtonElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setReasonCode('');
      setNotes('');
      setStatus('idle');
      setErrorMessage('');
    }
  }, [open]);

  // Focus select on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => selectRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const notesRequired = reasonCode === 'OTHER';
  const isFormValid = reasonCode !== '' && (!notesRequired || notes.trim().length > 0);
  const isCancelling = status === 'cancelling';

  const handleSubmit = useCallback(async () => {
    if (!user || !isFormValid) return;

    setStatus('cancelling');
    setErrorMessage('');

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        API_ROUTES.ACCOUNTING.INVOICES.BY_ID(invoice.invoiceId),
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reasonCode,
            notes: notes.trim() || '',
          }),
        }
      );

      const json = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: {
          invoiceId: string;
          action: 'voided' | 'credit_note_issued';
          creditNoteId?: string;
          creditNoteNumber?: number;
        };
      };

      if (!response.ok || !json.success) {
        setStatus('error');
        setErrorMessage(json.error ?? t('cancelDialog.errorGeneric'));
        return;
      }

      setStatus('success');
      onSuccess();

      // Auto-close after 2.5s on success
      setTimeout(() => onOpenChange(false), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setErrorMessage(message);
    }
  }, [user, isFormValid, reasonCode, notes, invoice.invoiceId, t, onSuccess, onOpenChange]);

  const dialogTitle = isVoid
    ? t('cancelDialog.titleVoid')
    : t('cancelDialog.titleCreditNote');

  const DialogIcon = isVoid ? Ban : FileX2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DialogIcon className="h-5 w-5 text-destructive" />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {isVoid
                ? t('cancelDialog.warningVoid')
                : t('cancelDialog.warningCreditNote')}
            </p>
          </div>

          {/* Invoice summary */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
            <p className="text-sm font-medium">
              {invoice.series}-{invoice.number}
            </p>
            <p className={cn('text-sm', colors.text.muted)}>
              {invoice.customer.name}
            </p>
            <p className="text-sm font-medium">
              {formatCurrency(invoice.totalGrossAmount)}
            </p>
          </div>

          {/* Reason code (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">
              {t('cancelDialog.reasonLabel')} *
            </Label>
            <Select
              value={reasonCode}
              onValueChange={(val) => setReasonCode(val as CancellationReasonCode)}
              disabled={isCancelling}
            >
              <SelectTrigger id="cancel-reason" ref={selectRef}>
                <SelectValue placeholder={t('cancelDialog.reasonPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {REASON_CODES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {t(`cancelDialog.reasons.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes (required if OTHER, optional otherwise) */}
          <div className="space-y-1.5">
            <Label htmlFor="cancel-notes">
              {t('cancelDialog.notesLabel')}
              {notesRequired && ' *'}
            </Label>
            <Textarea
              id="cancel-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('cancelDialog.notesPlaceholder')}
              maxLength={2000}
              disabled={isCancelling}
              aria-invalid={notesRequired && notes.trim().length === 0}
            />
            {notesRequired && notes.trim().length === 0 && (
              <p className="text-xs text-destructive">
                {t('cancelDialog.notesRequiredHint')}
              </p>
            )}
          </div>

          {/* Status messages */}
          {status === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                {isVoid
                  ? t('cancelDialog.successVoid')
                  : t('cancelDialog.successCreditNote')}
              </span>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCancelling}
          >
            {t('cancelDialog.backButton')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isCancelling || !isFormValid || status === 'success'}
          >
            {isCancelling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('cancelDialog.processing')}
              </>
            ) : isVoid ? (
              t('cancelDialog.confirmVoid')
            ) : (
              t('cancelDialog.confirmCreditNote')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
