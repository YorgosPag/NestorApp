'use client';

/**
 * @fileoverview **«ΑΠΟΣΤΟΛΗ ΕΠΙΒΕΒΑΙΩΣΗΣ» ΑΠΟ ΤΙΣ ΡΥΘΜΙΣΕΙΣ** — μία διεύθυνση, μία πράξη (ADR-841 §7 Α21.18 · Α21.20).
 * @related app/api/agency-profile/card/email-confirmations/route.ts · components/mandate/ShowcaseEmailConfirmationControl.tsx
 * @module hooks/mandate/useEmailConfirmationSend
 *
 * 🔑 **Ρητές φάσεις, ποτέ `isLoading` + `error` μαζί** — ίδιο δόγμα με το `MandateConsentContent`.
 * ⚠️ `failed` ≠ άρνηση (N.12): «δεν μάθαμε» δεν λέει ποτέ στον άνθρωπο ότι η διεύθυνση είναι λάθος.
 * 🔑 Α21.20 — `acknowledgeReturned` ταξιδεύει **μόνο** όταν ο άνθρωπος πάτησε «Το διόρθωσα»: ποτέ προεπιλογή.
 */

import { useCallback, useState } from 'react';

import { EMAIL_CONFIRMATION_ISSUE_PATH } from '@/components/mandate/showcase-card-paths';
import { refusalOf } from '@/lib/http/response-refusal';
import {
  SHOWCASE_EMAIL_CONFIRMATION_ISSUE_REFUSALS,
  type ShowcaseEmailConfirmationIssueRefusal,
} from '@/types/showcase-email-confirmation';

export type EmailConfirmationSendPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent' }
  | { readonly kind: 'refused'; readonly reason: ShowcaseEmailConfirmationIssueRefusal }
  | { readonly kind: 'failed' };

export function useEmailConfirmationSend(): {
  readonly phase: EmailConfirmationSendPhase;
  readonly send: (locationId: string, email: string, acknowledgeReturned?: boolean) => Promise<void>;
} {
  const [phase, setPhase] = useState<EmailConfirmationSendPhase>({ kind: 'idle' });

  const send = useCallback(async (locationId: string, email: string, acknowledgeReturned = false) => {
    setPhase({ kind: 'sending' });
    try {
      const response = await fetch(EMAIL_CONFIRMATION_ISSUE_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, email, acknowledgeReturned }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok) return setPhase({ kind: 'sent' });
      const reason = refusalOf(body, SHOWCASE_EMAIL_CONFIRMATION_ISSUE_REFUSALS);
      setPhase(reason === null ? { kind: 'failed' } : { kind: 'refused', reason });
    } catch {
      setPhase({ kind: 'failed' });
    }
  }, []);

  return { phase, send };
}
