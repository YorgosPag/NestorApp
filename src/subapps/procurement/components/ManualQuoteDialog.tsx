'use client';

import { useId, useState } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form/FormActions';
import { Label } from '@/components/ui/label';
import { POProjectSelector } from '@/components/procurement/POEntitySelectors';
import { TradeSelector } from '@/subapps/procurement/components/TradeSelector';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { fetchJson, jsonRequest } from '@/lib/api/fetch-json';
import type { TradeCode } from '@/subapps/procurement/types/trade';

interface ManualQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorContactId: string;
}

/** Κατάσταση + υποβολή: POST μέσω `fetchJson` (μήνυμα του server) και ένας δρόμος υποβολής (ADR-598 «(η)»). */
function useManualQuoteForm({ onOpenChange, vendorContactId }: Omit<ManualQuoteDialogProps, 'open'>, t: Translate) {
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [trade, setTrade] = useState<TradeCode | ''>('');
  const canSubmit = projectId.trim() !== '' && trade !== '';

  const submission = useFormSubmission({
    canSubmit,
    submit: () => fetchJson<{ data: { id: string } }>(
      '/api/quotes',
      jsonRequest('POST', { projectId, vendorContactId, trade, source: 'manual' }),
    ),
    onSuccess: (json) => {
      handleOpenChange(false);
      router.push(`/procurement/quotes/${json.data.id}/review`);
    },
    errorFallback: t('quotes.errors.createFailed'),
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setProjectId('');
      setTrade('');
      submission.clearError();
    }
    onOpenChange(next);
  }

  return { projectId, setProjectId, trade, setTrade, canSubmit, handleOpenChange, ...submission };
}

export function ManualQuoteDialog({ open, onOpenChange, vendorContactId }: ManualQuoteDialogProps) {
  const { t } = useTranslation('quotes');
  const idBase = useId(); // `${idBase}-<πεδίο>`: η <Label> ονομάζει το combobox (ADR-598 G11)
  const formId = `${idBase}-form`;
  const f = useManualQuoteForm({ onOpenChange, vendorContactId }, t);

  return (
    <Dialog open={open} onOpenChange={f.handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('quotes.create')}</DialogTitle>
          <DialogDescription>{t('quotes.dialog.description')}</DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={f.handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-project`}>{t('quotes.project')}</Label>
            <POProjectSelector id={`${idBase}-project`} value={f.projectId} onSelect={(id) => f.setProjectId(id)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${idBase}-trade`}>{t('quotes.trade')}</Label>
            <TradeSelector id={`${idBase}-trade`} value={f.trade} onChange={f.setTrade} />
          </div>
        </form>

        <FormActions
          formId={formId}
          submitLabel={t('quotes.create')}
          pendingLabel={t('quotes.loading')}
          cancelLabel={t('quotes.cancel')}
          onCancel={() => f.handleOpenChange(false)}
          submitting={f.submitting}
          submitDisabled={!f.canSubmit}
          error={f.error}
        />
      </DialogContent>
    </Dialog>
  );
}
