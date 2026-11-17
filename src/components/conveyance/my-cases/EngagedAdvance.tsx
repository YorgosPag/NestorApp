'use client';

/**
 * @fileoverview ADR-943 Φ5α — **η προκαταβολή** στον χώρο της ανάθεσης (πλευρά επαγγελματία): πού είναι τα χρήματα, και
 *   η πράξη «Έγινε η αυτοψία» που ανοίγει το παράθυρο αντίρρησης (48ω) πριν την αυτόματη αποδέσμευση.
 * @related lib/document-validity/issuance-advance.ts (`advanceGlanceOf` — η ματιά) ·
 *   services/conveyance/conveyance-engagement-gateway.ts (`declareIssuanceWorkStarted`) ·
 *   app/api/engagements/[engagementId]/issuance/start-work/route.ts (η πόρτα)
 * @module components/conveyance/my-cases/EngagedAdvance
 *
 * 🏆 **Πρότυπο Airbnb (πληρωμή στο check-in)**: τα χρήματα κρατούνται ώσπου ο επαγγελματίας να δηλώσει έναρξη· η οθόνη
 *    λέει **πάντα** τι ακολουθεί και πότε («αποδεσμεύεται στις …»), ποτέ σκέτη κατάσταση.
 * 🔑 Η δήλωση θέλει **επιβεβαίωση** με τις συνέπειές της γραμμένες (48ω αντίρρησης, μετά αυτόματη αποδέσμευση).
 * 🔒 Ε-9′: καμία αιτιολογία αντίρρησης εδώ — ό,τι είπε ο ιδιοκτήτης ανήκει στο γραφείο.
 * ⚠️ Κυριολεκτικά κλειδιά (CHECK 3.34) — και για τους κωδικούς άρνησης, ποτέ `${code}`.
 */

import React, { useState } from 'react';

import { policyText } from '@/components/document-registry/issuance-advance-labels';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AdvanceGlance } from '@/lib/document-validity/issuance-advance';
import type { IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { formatMinor } from '@/lib/money/money';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  declareIssuanceWorkStarted,
  startWorkRejectionOf,
  type StartWorkRejection,
} from '@/services/conveyance/conveyance-engagement-gateway';

const K = 'conveyance:engagement.issuance.advance.';

const KEYS = {
  title: `${K}title`,
  amount: `${K}amount`,
  held: `${K}held`,
  releasePending: `${K}releasePending`,
  disputed: `${K}disputed`,
  released: `${K}released`,
  trigger: `${K}trigger`,
  confirmTitle: `${K}confirmTitle`,
  confirmDescription: `${K}confirmDescription`,
  cancel: `${K}cancel`,
  confirm: `${K}confirm`,
  sending: `${K}sending`,
  sent: `${K}sent`,
} as const;

const ERROR_KEYS: Readonly<Record<StartWorkRejection | 'generic', string>> = {
  NOT_FOUND: `${K}errors.NOT_FOUND`,
  ENGAGEMENT_NOT_ACTIVE: `${K}errors.ENGAGEMENT_NOT_ACTIVE`,
  UNAVAILABLE: `${K}errors.UNAVAILABLE`,
  STALE: `${K}errors.STALE`,
  TRANSITION_REFUSED: `${K}errors.TRANSITION_REFUSED`,
  SETTLEMENT_UNAVAILABLE: `${K}errors.SETTLEMENT_UNAVAILABLE`,
  generic: `${K}errors.generic`,
};

export interface EngagedAdvanceProps {
  readonly engagementId: string;
  readonly stage: IssuanceStage;
  readonly advance: AdvanceGlance;
  /** Ξαναδιάβασμα της όψης μετά από επιτυχία ή `STALE`. */
  readonly onChanged: () => void;
}

/** Πού είναι τα χρήματα και τι ακολουθεί — μία γραμμή ανά κατάσταση· οι υπόλοιπες δεν αφορούν τον μηχανικό εδώ. */
function AdvanceStatus({ advance }: { readonly advance: AdvanceGlance }): React.ReactElement | null {
  const { t, i18n } = useTranslation(['conveyance']);
  switch (advance.state) {
    case 'held': return <p className="m-0 text-xs text-muted-foreground">{t(KEYS.held)}</p>;
    case 'release-pending':
      return (
        <p className="m-0 text-xs text-muted-foreground" role="status">
          {t(KEYS.releasePending, { date: advance.releaseAt === null ? '' : formatOperatorDateTime(advance.releaseAt, i18n.language) })}
        </p>
      );
    case 'disputed': return <p className="m-0 text-xs text-muted-foreground" role="status">{t(KEYS.disputed)}</p>;
    case 'released': return <p className="m-0 text-xs text-muted-foreground">{t(KEYS.released, { amount: formatMinor(advance.collectedMinor) })}</p>;
    case 'none': case 'awaiting-payment': case 'refunded': return null;
  }
}

/** Η δήλωση: κάθε άρνηση της πόρτας ονομασμένη· `STALE` ⇒ ξαναδιάβασμα. */
function useStartWork(props: EngagedAdvanceProps, close: () => void) {
  const { t, i18n } = useTranslation(['conveyance']);
  const { success, error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const submit = () => {
    setBusy(true);
    declareIssuanceWorkStarted(props.engagementId, { expectedStage: props.stage })
      .then((result) => {
        success(t(KEYS.sent, { date: formatOperatorDateTime(result.releaseAt, i18n.language) }));
        close();
        props.onChanged();
      })
      .catch((cause: unknown) => {
        const code = startWorkRejectionOf(cause);
        error(t(ERROR_KEYS[code ?? 'generic']));
        if (code === 'STALE') props.onChanged();
      })
      .finally(() => setBusy(false));
  };
  return { busy, submit };
}

export function EngagedAdvance(props: EngagedAdvanceProps): React.ReactElement {
  const { t } = useTranslation(['conveyance', 'document-registry']);
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const { busy, submit } = useStartWork(props, close);
  const { terms } = props.advance;
  return (
    <section aria-labelledby="issuance-advance-title" className="flex flex-col gap-2">
      <h3 id="issuance-advance-title" className="m-0 text-sm font-semibold">{t(KEYS.title)}</h3>
      {terms !== null && (
        <p className="m-0 text-sm">{t(KEYS.amount, { amount: formatMinor(terms.amountMinor), policy: policyText(t, terms.policy) })}</p>
      )}
      <AdvanceStatus advance={props.advance} />
      {props.advance.state === 'held' && (
        <Button type="button" size="sm" className="w-fit" onClick={() => setOpen(true)}>{t(KEYS.trigger)}</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(KEYS.confirmTitle)}</DialogTitle>
            <DialogDescription>{t(KEYS.confirmDescription)}</DialogDescription>
          </DialogHeader>
          <DialogActionFooter
            cancelLabel={t(KEYS.cancel)} confirmLabel={t(KEYS.confirm)} busyLabel={t(KEYS.sending)}
            onCancel={close} onConfirm={() => { if (!busy) submit(); }} isSubmitting={busy} canSubmit
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
