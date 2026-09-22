'use client';

/**
 * Email composer for quote renewal requests.
 * Pre-fills subject + body from ADR-328 §5.BB.6 template.
 * Caller provides onSend(to, subject, body) — actual transport is outside scope.
 */

import { useId, useState } from 'react';
import { EmailMessageFields } from './EmailMessageFields';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormDialog } from '@/components/ui/form/FormDialog';
import { useFormSubmission } from '@/hooks/useFormSubmission';

export interface QuoteRenewalRequestDialogProps {
  open: boolean;
  vendorEmail: string;
  vendorName: string;
  rfqTitle: string;
  quoteNumber: string;
  validUntilDate: string;
  total: string;
  senderName: string;
  /** Πετά σε αποτυχία — το μήνυμα εμφανίζεται μέσα στον διάλογο (ADR-598 «(θ)»). */
  onSend: (to: string, subject: string, body: string) => Promise<void>;
  onCancel: () => void;
}

/** ADR-598 «(θ)»: πριν, `try/finally` χωρίς `catch` ⇒ μια αποτυχία αποστολής χανόταν αθόρυβα. */
function useRenewalForm(props: QuoteRenewalRequestDialogProps, t: Translate) {
  const { vendorEmail, onSend } = props;
  const [subject, setSubject] = useState(() => t('rfqs.expiry.renewal.subjectDefault', { rfqTitle: props.rfqTitle }));
  const [body, setBody] = useState(() => t('rfqs.expiry.renewal.bodyDefault', {
    vendorName: props.vendorName,
    quoteNumber: props.quoteNumber,
    originalValidUntil: props.validUntilDate,
    total: props.total,
    senderName: props.senderName,
  }));
  const canSubmit = subject.trim() !== '' && body.trim() !== '';

  const submission = useFormSubmission({
    canSubmit,
    submit: () => onSend(vendorEmail, subject, body),
    errorFallback: t('rfqs.expiry.renewal.sendFailed'),
  });

  return { subject, setSubject, body, setBody, canSubmit, submission };
}

export function QuoteRenewalRequestDialog(props: QuoteRenewalRequestDialogProps) {
  const { open, vendorEmail, onCancel } = props;
  const { t } = useTranslation('quotes');
  const toId = useId(); // η <Label> ονομάζει το πεδίο (ADR-598 G11)
  const f = useRenewalForm(props, t);

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => { if (!v) onCancel(); }}
      title={t('rfqs.expiry.renewal.dialogTitle')}
      contentClassName="max-w-lg"
      formClassName="space-y-3 py-2"
      submission={f.submission}
      submitLabel={t('rfqs.expiry.renewal.sendButton')}
      pendingLabel={t('rfqs.expiry.renewal.sendingButton')}
      cancelLabel={t('rfqs.expiry.renewal.cancelButton')}
      onCancel={onCancel}
      submitDisabled={!f.canSubmit}
    >
      <div className="space-y-1">
        <Label htmlFor={toId} className="text-xs text-muted-foreground">{t('rfqs.expiry.renewal.toLabel')}</Label>
        <Input id={toId} value={vendorEmail} readOnly className="bg-muted text-muted-foreground" />
      </div>
      <EmailMessageFields
        subjectLabel={t('rfqs.expiry.renewal.subjectLabel')}
        bodyLabel={t('rfqs.expiry.renewal.bodyLabel')}
        subject={f.subject}
        body={f.body}
        onSubjectChange={f.setSubject}
        onBodyChange={f.setBody}
        bodyRows={9}
        disabled={f.submission.submitting}
      />
    </FormDialog>
  );
}
