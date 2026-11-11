/**
 * Μικρά δομικά στοιχεία της σελίδας πληρωμής τιμολογίου (ADR-ACC-018 §16): namespace, πεδίο με αντιγραφή,
 * σύμβολο QR.
 *
 * Το QR ζωγραφίζεται **συγχρονισμένα** από τη γεωμετρία του ΕΝΟΣ περιτυλίγματος `qrcode` (`qrModuleRuns`, ίδιο
 * σύμβολο με το PDF), ως `<path>`. Δεν χρειάζεται `dangerouslySetInnerHTML`, ασύγχρονο βήμα ή εικόνα. Τα χρώματα
 * είναι **σταθερά** μαύρο σε λευκό: ο κωδικός θέλει αντίθεση, όχι θέμα (`lib/qr/qr-code.ts`).
 *
 * @module components/shared/pages/invoice-payment/invoice-payment-primitives
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { copyToClipboard } from '@/lib/share-utils';
import { qrModuleRuns } from '@/lib/qr/qr-code';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

/** Το namespace της σελίδας: μικρό, ώστε ο ανώνυμος πελάτης να μη φορτώνει όλη τη λογιστική. */
export const INVOICE_PUBLIC_PAYMENT_NS = 'accounting-public-payment';

type CopyOutcome = 'idle' | 'copied' | 'failed';

interface CopyFieldProps {
  readonly label: string;
  /** Ό,τι εμφανίζεται (π.χ. IBAN σε ομάδες των 4). */
  readonly display: string;
  /** Ό,τι αντιγράφεται (π.χ. IBAN χωρίς κενά). Απόν ⇒ το `display`. */
  readonly value?: string;
  readonly emphasis?: boolean;
}

/** Ένα στοιχείο πληρωμής με κουμπί αντιγραφής. Το αποτέλεσμα ανακοινώνεται σε `aria-live`. */
export function CopyField({ label, display, value, emphasis = false }: CopyFieldProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const [outcome, setOutcome] = useState<CopyOutcome>('idle');
  const copy = useCallback(() => {
    void copyToClipboard(value ?? display).then((copied) => setOutcome(copied ? 'copied' : 'failed'));
  }, [display, value]);

  return (
    <>
      <dt className={cn('text-xs', colors.text.muted)}>{label}</dt>
      <dd className="flex min-w-0 items-center justify-between gap-2">
        <span className={cn('min-w-0 break-all font-mono', emphasis ? 'text-base font-semibold' : 'text-sm')}>{display}</span>
        <Button type="button" variant="ghost" size="icon" onClick={copy} aria-label={t('pay.copy', { field: label })}>
          {outcome === 'copied' ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </Button>
        <span className="sr-only" aria-live="polite">
          {outcome === 'copied' && t('pay.copied', { field: label })}
          {outcome === 'failed' && t('pay.copyFailed')}
        </span>
      </dd>
    </>
  );
}

/** Οι σκούρες μονάδες του συμβόλου ως ΕΝΑ path (μία οριζόντια σειρά = ένα ορθογώνιο). */
function qrPathOf(payload: string): { readonly d: string; readonly side: number } {
  const symbol = qrModuleRuns(payload, 'screen');
  const q = symbol.quietModules;
  const d = symbol.runs.map(([row, column, length]) => `M${column + q} ${row + q}h${length}v1h-${length}z`).join('');
  return { d, side: symbol.size + q * 2 };
}

/** Το EPC QR, διανυσματικό, πάντα μαύρο σε λευκό. */
export function PaymentQrSymbol({ payload, label }: { readonly payload: string; readonly label: string }): React.ReactElement {
  const { d, side } = useMemo(() => qrPathOf(payload), [payload]);
  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="h-44 w-44 rounded-md bg-white"
    >
      <path d={d} fill="#000000" />
    </svg>
  );
}
