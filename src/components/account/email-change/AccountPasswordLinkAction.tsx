'use client';

/**
 * @fileoverview **«Ορίστε κωδικό πρόσβασης»** — ο δρόμος προς την αλλαγή email για όποιον δεν έχει κωδικό (ADR-850).
 * @related AccountEmailField.tsx (ο ξενιστής, που το φορτώνει ΤΕΜΠΕΛΙΚΑ)
 * @module components/account/email-change/AccountPasswordLinkAction
 *
 * 🏆 **Πρότυπο Figma**: ο λογαριασμός που μπήκε με Google *(ή ο πολίτης χωρίς κανέναν
 * πάροχο, ADR-844)* αλλάζει email από την εφαρμογή **αφού ορίσει κωδικό**.
 *
 * ⚠️ **Χωριστό αρχείο επειδή φορτώνεται τεμπέλικα** (CHECK 3.34): τα κείμενά του αφορούν
 * **μόνο** λογαριασμούς χωρίς κωδικό — στατικά θα φόρτωναν σε **κάθε** επισκέπτη του
 * προφίλ. Ίδιο σκεπτικό με το `FirstContactStandIn`.
 */

import React from 'react';

import { useAuth } from '@/auth';
import { AccountNotice } from '@/components/account/AccountNotice';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';

import { EMAIL_CHANGE_KEYS } from './email-change-labels';

/** Ο σύνδεσμος ορισμού κωδικού — ρητά, ποτέ `boolean` + `error`. */
type PasswordLinkState = 'idle' | 'sending' | 'sent' | 'failed';

export function AccountPasswordLinkAction({ email }: { readonly email: string }): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const { resetPassword } = useAuth();
  const [state, setState] = React.useState<PasswordLinkState>('idle');

  // 🔑 **Ο ΥΠΑΡΧΩΝ δρόμος** — `resetPassword` του context. Σε λογαριασμό χωρίς κωδικό, το
  //    `confirmPasswordReset` τον **προσθέτει**, και απαιτεί το ίδιο γραμματοκιβώτιο.
  async function request(): Promise<void> {
    if (email === '' || state === 'sending') return;
    setState('sending');
    try {
      await resetPassword(email);
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  return (
    <>
      {/* ⚠️ `type="button"`: ζούμε μέσα στη φόρμα του προφίλ. */}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => { void request(); }}
        disabled={email === '' || state === 'sending' || state === 'sent'}
      >
        {state === 'sending' ? t(EMAIL_CHANGE_KEYS.setPasswordSending) : t(EMAIL_CHANGE_KEYS.setPassword)}
      </Button>
      {state === 'sent' && (
        <AccountNotice tone="success">{t(EMAIL_CHANGE_KEYS.setPasswordSent, { email })}</AccountNotice>
      )}
      {state === 'failed' && (
        <AccountNotice tone="error">{t(EMAIL_CHANGE_KEYS.setPasswordFailed)}</AccountNotice>
      )}
    </>
  );
}
