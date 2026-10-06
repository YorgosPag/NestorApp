'use client';

/**
 * @fileoverview **«Επιβεβαιώστε πρώτα το email σας»** — η όψη της πύλης πριν από τον δεύτερο παράγοντα (ADR-851 Φ2).
 * @related useEmailVerificationGate.ts (η κρίση και οι πράξεις)
 * @module components/account/email-verification/EmailVerificationGate
 *
 * 🏆 **Πρότυπο**: ο άνθρωπος βλέπει **γιατί** δεν προχωρά και **τι να κάνει**, πριν πατήσει κουμπί που θα αποτύγχανε —
 * με «στείλτε ξανά» δίπλα. Και ένα βήμα παραπάνω: η πύλη ανοίγει **μόνη της** όταν ο σύνδεσμος πατηθεί σε άλλη
 * καρτέλα (βλ. hook)· το «Το επιβεβαίωσα» είναι η ρητή εκδοχή της ίδιας ερώτησης, ποτέ ο μόνος δρόμος.
 *
 * Render-only: καμία κατάσταση εδώ.
 */

import React from 'react';
import { MailCheck } from 'lucide-react';

import { AccountNotice } from '@/components/account/AccountNotice';
import { AccountStepIntro } from '@/components/account/AccountStepIntro';
import { Button } from '@/components/ui/button';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';

import { EMAIL_GATE_KEYS, EMAIL_GATE_MAIL_NOTICE } from './email-verification-labels';
import type { EmailVerificationGate as Gate } from './useEmailVerificationGate';

const TITLE_ID = 'email-gate-title';

export function EmailVerificationGate({ gate }: { readonly gate: Gate }): React.JSX.Element {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const layout = useLayoutClasses();
  const { email, mail, recheck } = gate;
  const mailNotice = EMAIL_GATE_MAIL_NOTICE[mail];

  return (
    <section className={layout.flexColGap4} aria-labelledby={TITLE_ID}>
      <AccountStepIntro icon={MailCheck} titleId={TITLE_ID} title={t(EMAIL_GATE_KEYS.title)} body={t(EMAIL_GATE_KEYS.body, { email })} />

      {mailNotice && <AccountNotice tone={mailNotice.tone}>{t(mailNotice.key, { email })}</AccountNotice>}
      {recheck === 'still-unverified' && <AccountNotice tone="error">{t(EMAIL_GATE_KEYS.stillUnverified)}</AccountNotice>}

      <nav className={layout.flexCenterGap2}>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => { void gate.resend(); }}
          disabled={mail === 'sending' || mail === 'sent' || mail === 'throttled'}
        >
          {t(mail === 'sending' ? EMAIL_GATE_KEYS.resending : EMAIL_GATE_KEYS.resend)}
        </Button>
        <Button type="button" className="flex-1" onClick={() => { void gate.confirm(); }} disabled={recheck === 'checking'}>
          {t(recheck === 'checking' ? EMAIL_GATE_KEYS.rechecking : EMAIL_GATE_KEYS.recheck)}
        </Button>
      </nav>
    </section>
  );
}
