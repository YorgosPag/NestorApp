'use client';

/**
 * @fileoverview ADR-943 Φ5γ (Ζ-5 · Θ-5) — **η απόφαση του γραφείου στη διαφορά της προκαταβολής**: όλα στον μηχανικό ·
 *   όλα πίσω · διαίρεση, με αιτιολογία. Οριστική — εκτελείται αμέσως από τον ΕΝΑ εκτελεστή χρημάτων.
 * @related lib/document-validity/issuance-advance-reducer.ts (`resolve-advance-dispute` — η κρίση) ·
 *   RegistryIssuanceAdvanceLine.tsx (πού ζει) · RegistryIssuanceDialogs.tsx (`IssuanceDialogShell`)
 * @module components/document-registry/RegistryIssuanceAdvanceDispute
 *
 * 🏆 Upwork dispute · Airbnb Resolution Center: ο τρίτος αποφασίζει **με ποσά**, όχι με κείμενο. Πέρα από αυτούς: ο
 *    άνθρωπος βλέπει την αντίρρηση και το ακριβές αποτέλεσμα **πριν** πατήσει, από τα ίδια ποσά που θα κινηθούν.
 * 🔒 Ε-9′: η αιτιολογία μένει στο γραφείο — μηχανικός και ιδιοκτήτης βλέπουν μόνο τα ποσά.
 */

import React, { useId, useState } from 'react';

import { ChoiceField } from '@/components/document-registry/IssuanceChoiceField';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { ISSUANCE_ADVANCE_DISPUTE_KEYS, ISSUANCE_KEYS, PROPOSE_KEYS } from '@/components/document-registry/issuance-labels';
import { amountMinorOf } from '@/components/document-registry/issuance-quote-draft';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { IssuanceDialogShell } from '@/components/document-registry/RegistryIssuanceDialogs';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ADVANCE_POLICY, advanceCollectedMinor, advanceStateOf, type AdvanceState } from '@/lib/document-validity/issuance-advance';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { formatMinor } from '@/lib/money/money';

const OUTCOMES = ['release-all', 'refund-all', 'split'] as const;
type Outcome = (typeof OUTCOMES)[number];

type Disputed = Extract<AdvanceState, { kind: 'disputed' }>;

/** Πόσα στον μηχανικό — από την επιλογή· `null` ⇒ η διαίρεση δεν στέκει (κουμπί ανενεργό). */
function releaseMinorOf(outcome: Outcome | null, splitText: string, collectedMinor: number): number | null {
  if (outcome === 'release-all') return collectedMinor;
  if (outcome === 'refund-all') return 0;
  if (outcome !== 'split') return null;
  const minor = amountMinorOf(splitText);
  return minor !== null && minor < collectedMinor ? minor : null;
}

function DisputeForm({ view, state, close }: { readonly view: RegistryIssuanceView; readonly state: Disputed; readonly close: () => void }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [splitText, setSplitText] = useState('');
  const [reason, setReason] = useState('');
  const splitId = useId();
  const reasonId = useId();
  const collected = advanceCollectedMinor(state);
  const releaseMinor = releaseMinorOf(outcome, splitText, collected);
  const trimmed = reason.trim();
  const labels: Readonly<Record<Outcome, string>> = {
    'release-all': t(ISSUANCE_ADVANCE_DISPUTE_KEYS.releaseAll),
    'refund-all': t(ISSUANCE_ADVANCE_DISPUTE_KEYS.refundAll),
    split: t(ISSUANCE_ADVANCE_DISPUTE_KEYS.split),
  };
  const submit = () => {
    if (actions === null || releaseMinor === null || trimmed === '') return;
    close();
    actions.act({ action: 'resolve-advance-dispute', ...issuanceTargetOf(view), releaseMinor, reason: trimmed });
  };
  return (
    <>
      <p className="m-0 text-sm text-foreground">{t(ISSUANCE_ADVANCE_DISPUTE_KEYS.objection, { reason: state.reason })}</p>
      <p className="m-0 text-sm text-muted-foreground">{t(ISSUANCE_ADVANCE_DISPUTE_KEYS.held, { amount: formatMinor(collected) })}</p>
      <ChoiceField legend={t(ISSUANCE_ADVANCE_DISPUTE_KEYS.legend)} options={OUTCOMES} value={outcome} onChange={setOutcome} labelOf={(value) => labels[value]} />
      {outcome === 'split' ? (
        <>
          <Label htmlFor={splitId} className="text-sm font-medium">{t(ISSUANCE_ADVANCE_DISPUTE_KEYS.splitLabel)}</Label>
          <Input id={splitId} inputMode="decimal" autoComplete="off" value={splitText} onChange={(event) => setSplitText(event.target.value)} />
          <p className="m-0 text-xs text-muted-foreground">{t(ISSUANCE_ADVANCE_DISPUTE_KEYS.splitHint, { amount: formatMinor(collected) })}</p>
        </>
      ) : null}
      {releaseMinor === null ? null : (
        <p className="m-0 text-sm font-medium text-foreground">
          {t(ISSUANCE_ADVANCE_DISPUTE_KEYS.summary, { release: formatMinor(releaseMinor), refund: formatMinor(collected - releaseMinor) })}
        </p>
      )}
      <Label htmlFor={reasonId} className="text-sm font-medium">{t(ISSUANCE_ADVANCE_DISPUTE_KEYS.reasonLabel)}</Label>
      <Textarea id={reasonId} value={reason} required maxLength={ADVANCE_POLICY.resolutionReasonMax} onChange={(event) => setReason(event.target.value)} />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(ISSUANCE_ADVANCE_DISPUTE_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={releaseMinor !== null && trimmed !== ''}
      />
    </>
  );
}

/**
 * Η διαφορά στην κάρτα: χωρίς απόφαση ⇒ κουμπί «Απόφαση για τη διαφορά» (μόνο με δικαίωμα)· με απόφαση ⇒ τα ποσά της.
 * Τίποτα για κάθε άλλη κατάσταση.
 */
export function RegistryIssuanceAdvanceDispute({ view, record }: { readonly view: RegistryIssuanceView; readonly record: IssuanceAssignmentRecord }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const state = advanceStateOf(record);
  if (state.kind !== 'disputed') return null;
  if (state.resolution !== null) {
    const amounts = { release: formatMinor(state.resolution.releaseMinor), refund: formatMinor(state.resolution.refundMinor) };
    return <span className="text-foreground">{t(ISSUANCE_ADVANCE_DISPUTE_KEYS.decided, amounts)}</span>;
  }
  if (!(actions?.canAct ?? false)) return null;
  return (
    <IssuanceDialogShell
      trigger={t(ISSUANCE_ADVANCE_DISPUTE_KEYS.trigger)} title={t(ISSUANCE_ADVANCE_DISPUTE_KEYS.title)} description={t(ISSUANCE_ADVANCE_DISPUTE_KEYS.description)}
    >
      {(close) => <DisputeForm view={view} state={state} close={close} />}
    </IssuanceDialogShell>
  );
}
