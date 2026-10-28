'use client';

/**
 * Ρύθμιση «τι μπορεί να αλλάξει ο προμηθευτής» στη βασική απάντηση κάθε γραμμής (ADR-327 §8.5 Β) — Procore
 * «Unit & Quantity Lock». Ζει πάνω από τον πίνακα γραμμών: αφορά τις γραμμές, όχι το RFQ γενικά.
 *
 * @module subapps/procurement/components/RfqResponseLockControl
 */

import { useCallback, useId } from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getErrorMessage } from '@/lib/error-utils';
import type { RFQ, RfqResponseLock } from '../types/rfq';
import { useRfqResponseLock } from '../hooks/useRfqResponseLock';

interface Props {
  rfq: Pick<RFQ, 'id' | 'responseLock'>;
  /** Ίδιο σύνορο με τις γραμμές (`deriveSetupLockState`) — και ο server το ελέγχει. */
  disabled: boolean;
  onSaved: (rfq: RFQ) => void;
}

export function RfqResponseLockControl({ rfq, disabled, onSaved }: Props) {
  const { t } = useTranslation('quotes');
  const onError = useCallback(
    (error: unknown) => toast.error(getErrorMessage(error, t('rfqs.responseLock.saveFailed'))),
    [t],
  );
  const { lock, saving, setLock } = useRfqResponseLock(rfq, onSaved, onError);
  return (
    <fieldset className="space-y-2 rounded-md border border-border bg-card p-3" aria-busy={saving}>
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        {t('rfqs.responseLock.title')}
      </legend>
      <p className="text-xs text-muted-foreground">{t('rfqs.responseLock.hint')}</p>
      <LockSwitch field="quantity" label={t('rfqs.responseLock.quantity')} lock={lock} disabled={disabled} onChange={setLock} />
      <LockSwitch field="unit" label={t('rfqs.responseLock.unit')} lock={lock} disabled={disabled} onChange={setLock} />
    </fieldset>
  );
}

function LockSwitch({ field, label, lock, disabled, onChange }: {
  field: keyof RfqResponseLock;
  label: string;
  lock: RfqResponseLock;
  disabled: boolean;
  onChange: (patch: Partial<RfqResponseLock>) => Promise<void>;
}) {
  const id = useId();
  return (
    <p className="flex items-center gap-2">
      <Switch
        id={id}
        checked={lock[field]}
        disabled={disabled}
        onCheckedChange={(checked) => void onChange({ [field]: checked })}
      />
      <Label htmlFor={id} className="text-sm text-foreground">{label}</Label>
    </p>
  );
}
