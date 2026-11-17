'use client';

/**
 * @fileoverview ADR-943 §5.9 · §5.14 — **«Λήψη πληρωμών»** στο προφίλ: ο μηχανικός γίνεται δικαιούχος του παρόχου
 *   (EveryPay Marketplace) για να δέχεται προκαταβολές με κράτηση.
 * @related usePayoutAccount.ts · PayoutStatusPanel.tsx · PayoutRegistrationForm.tsx · PayoutUpdateForm.tsx · payout-labels.ts
 * @module components/account/payouts/ReceivePaymentsCard
 *
 * 🔑 **Πληρωμές ≠ αποδόσεις** (Stripe Connect): ο ιδιοκτήτης πληρώνει όταν ο πάροχος δέχεται μεταφορές· τα χρήματα
 *    αποδίδονται **μόνο** μετά την ταυτοποίηση. Η κάρτα δείχνει και τα δύο, και τι εκκρεμεί.
 * 🔑 **Ελάχιστα δεδομένα**: τα στοιχεία περνούν στον πάροχο και **δεν** αποθηκεύονται από εμάς· η ταυτοποίηση γίνεται
 *    στη hosted σελίδα του παρόχου.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { SectionFrame } from '@/components/ui/section-frame';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PayoutAccountState } from '@/lib/payments/payout-account';

import { CARD_KEYS, EDIT_KEYS, PAYOUT_NS } from './payout-labels';
import { PayoutRegistrationForm } from './PayoutRegistrationForm';
import { PayoutStatusPanel } from './PayoutStatusPanel';
import { PayoutUpdateForm } from './PayoutUpdateForm';
import { usePayoutAccount } from './usePayoutAccount';

/** Αλλαγή στοιχείων: μόνο όταν υπάρχει δικαιούχος στον πάροχο και δεν είναι ανεσταλμένος. */
const EDITABLE_STATES: ReadonlySet<PayoutAccountState> = new Set(['action-required', 'verifying', 'rejected', 'ready']);

export function ReceivePaymentsCard(): React.ReactElement {
  const { t } = useTranslation([PAYOUT_NS]);
  const { load, register, update } = usePayoutAccount();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const account = load.phase === 'ready' ? load.account : null;
  const closeEditor = (didSave: boolean) => { setEditing(false); setSaved(didSave); };
  return (
    <SectionFrame title={t(CARD_KEYS.title)} headingLevel="h2" gap={2}>
      <p className="m-0 text-sm text-muted-foreground">{t(CARD_KEYS.lead)}</p>
      {load.phase === 'loading' ? <p role="status" className="m-0 text-sm text-muted-foreground">{t(CARD_KEYS.loading)}</p> : null}
      {load.phase === 'failed' ? <p role="alert" className="m-0 text-sm text-destructive">{t(CARD_KEYS.failed)}</p> : null}
      {account !== null ? <PayoutStatusPanel account={account} /> : null}
      {saved ? <p role="status" className="m-0 text-sm text-card-foreground">{t(EDIT_KEYS.saved)}</p> : null}
      {account?.state === 'none' ? <PayoutRegistrationForm onSubmit={register} /> : null}
      {account !== null && EDITABLE_STATES.has(account.state) && editing ? (
        <PayoutUpdateForm details={account.details} onUpdate={update} onClose={closeEditor} />
      ) : null}
      {account !== null && EDITABLE_STATES.has(account.state) && !editing ? (
        <Button type="button" variant="outline" className="self-start" onClick={() => { setSaved(false); setEditing(true); }}>
          {t(EDIT_KEYS.open)}
        </Button>
      ) : null}
    </SectionFrame>
  );
}
