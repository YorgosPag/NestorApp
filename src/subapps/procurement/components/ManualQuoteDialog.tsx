'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { POProjectSelector } from '@/components/procurement/POEntitySelectors';
import { TradeSelector } from '@/subapps/procurement/components/TradeSelector';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TradeCode } from '@/subapps/procurement/types/trade';

interface ManualQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorContactId: string;
}

export function ManualQuoteDialog({
  open,
  onOpenChange,
  vendorContactId,
}: ManualQuoteDialogProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();

  const [projectId, setProjectId] = useState('');
  const [trade, setTrade] = useState<TradeCode | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = projectId.trim() !== '' && trade !== '';

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setProjectId('');
      setTrade('');
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, vendorContactId, trade, source: 'manual' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t('quotes.errors.createFailed'));
      handleOpenChange(false);
      router.push(`/procurement/quotes/${json.data.id}/review`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('quotes.errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('quotes.create')}</DialogTitle>
          <DialogDescription>{t('quotes.dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t('quotes.project')}</Label>
            <POProjectSelector
              value={projectId}
              onSelect={(id) => setProjectId(id)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('quotes.trade')}</Label>
            <TradeSelector value={trade} onChange={setTrade} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {t('quotes.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? <Spinner size="small" /> : t('quotes.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
