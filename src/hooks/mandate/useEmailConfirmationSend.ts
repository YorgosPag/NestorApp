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
import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
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
      // 🔴 **Μέσω `apiClient`** (ADR-787 §5.3 ζ): η επιβεβαίωση φεύγει για την κάρτα **του χώρου**.
      await apiClient.post(EMAIL_CONFIRMATION_ISSUE_PATH, { locationId, email, acknowledgeReturned });
      setPhase({ kind: 'sent' });
    } catch (error) {
      // ⚠️ Ο λόγος ζει στο `reason`, όχι στο `error` ⇒ `refusalOf`, όχι `apiErrorCodeOf`. Δίκτυο ⇒ `null` ⇒ `failed`.
      const reason = refusalOf(apiErrorBodyOf(error), SHOWCASE_EMAIL_CONFIRMATION_ISSUE_REFUSALS);
      setPhase(reason === null ? { kind: 'failed' } : { kind: 'refused', reason });
    }
  }, []);

  return { phase, send };
}
