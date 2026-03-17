'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import type { Invoice } from '@/subapps/accounting/types';
import {
  detectInvoiceEmailLanguage,
  buildInvoiceEmailSubject,
  buildInvoiceEmailContent,
  type InvoiceEmailLanguage,
} from '@/subapps/accounting/services/email/invoice-email-template';

// ============================================================================
// TYPES
// ============================================================================

interface SendInvoiceEmailDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ============================================================================
// SEND STATUS
// ============================================================================

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Send Invoice Email Dialog.
 *
 * Allows the user to review and edit the recipient, subject, and language
 * before sending the invoice PDF via email (server-side Mailgun).
 *
 * @see ADR-ACC-019 Invoice Email Sending
 */
export function SendInvoiceEmailDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: SendInvoiceEmailDialogProps) {
  const { t } = useTranslation('accounting');
  const { user } = useAuth();

  // Detect language from customer country
  const detectedLanguage = detectInvoiceEmailLanguage(invoice.customer.country);

  const [recipientEmail, setRecipientEmail] = useState<string>(
    invoice.customer.email ?? ''
  );
  const [language, setLanguage] = useState<InvoiceEmailLanguage>(detectedLanguage);
  const [subject, setSubject] = useState<string>('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Recompute subject when language changes
  useEffect(() => {
    setSubject(buildInvoiceEmailSubject(invoice, language));
  }, [invoice, language]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSendStatus('idle');
      setErrorMessage('');
      setRecipientEmail(invoice.customer.email ?? '');
      setLanguage(detectInvoiceEmailLanguage(invoice.customer.country));
    }
  }, [open, invoice]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSend = useCallback(async () => {
    if (!user) return;

    const trimmedEmail = recipientEmail.trim();

    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage(t('forms.sendEmailDialog.invalidEmail'));
      return;
    }

    setSendStatus('sending');
    setErrorMessage('');

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/accounting/invoices/${invoice.invoiceId}/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipientEmail: trimmedEmail,
            subject,
            language,
          }),
        }
      );

      const json = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { mailgunMessageId: string | null };
      };

      if (!response.ok || !json.success) {
        setSendStatus('error');
        setErrorMessage(json.error ?? t('forms.sendEmailDialog.errorTitle'));
        return;
      }

      setSendStatus('success');
      onSuccess();

      // Auto-close after 2 seconds on success
      setTimeout(() => onOpenChange(false), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSendStatus('error');
      setErrorMessage(message);
    }
  }, [user, recipientEmail, subject, language, invoice.invoiceId, t, onSuccess, onOpenChange]);

  // Build a lightweight HTML preview (content block only, no branded wrapper)
  const previewHtml = buildInvoiceEmailContent(invoice, language);

  const isEmailValid = isValidEmail(recipientEmail.trim());
  const isSending = sendStatus === 'sending';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('forms.sendEmailDialog.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label htmlFor="send-email-to">
              {t('forms.sendEmailDialog.toLabel')}
            </Label>
            <Input
              id="send-email-to"
              ref={inputRef}
              type="email"
              placeholder={t('forms.sendEmailDialog.toPlaceholder')}
              value={recipientEmail}
              onChange={(e) => {
                setRecipientEmail(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              disabled={isSending}
              aria-invalid={recipientEmail.length > 0 && !isEmailValid}
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="send-email-subject">
              {t('forms.sendEmailDialog.subjectLabel')}
            </Label>
            <Input
              id="send-email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label htmlFor="send-email-language">
              {t('forms.sendEmailDialog.languageLabel')}
            </Label>
            <Select
              value={language}
              onValueChange={(val) => setLanguage(val as InvoiceEmailLanguage)}
              disabled={isSending}
            >
              <SelectTrigger id="send-email-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="el">{t('forms.sendEmailDialog.languageEl')}</SelectItem>
                <SelectItem value="en">{t('forms.sendEmailDialog.languageEn')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PDF attachment note */}
          <p className="text-xs text-muted-foreground">
            📎 {t('forms.sendEmailDialog.pdfAttachmentNote')}
          </p>

          {/* Email body preview */}
          <div className="space-y-1.5">
            <Label>{t('forms.sendEmailDialog.previewLabel')}</Label>
            <div
              className="rounded-md border border-border bg-muted/30 p-3 text-sm overflow-auto max-h-52"
              /* biome-ignore lint/security/noDangerouslySetInnerHtml: preview of server-generated HTML */
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>

          {/* Status messages */}
          {sendStatus === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>
                {t('forms.sendEmailDialog.successMessage', {
                  email: recipientEmail.trim(),
                })}
              </span>
            </div>
          )}

          {sendStatus === 'error' && errorMessage && (
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
            disabled={isSending}
          >
            {t('forms.sendEmailDialog.cancelButton')}
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !isEmailValid || sendStatus === 'success'}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('forms.sendEmailDialog.sending')}
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {t('forms.sendEmailDialog.sendButton')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
