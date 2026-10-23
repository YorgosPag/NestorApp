'use client';

/**
 * @fileoverview **«Απόφαση για αρχείο»** — παραδίδεται · μένει εσωτερικό · αυτόματα, με αιτιολογία (ADR-916 §5.18 Φ-Δ.4).
 * @related HandoverFileRow.tsx (η γραμμή) · hooks/property-handover/useHandoverOfficeActions (η πράξη) ·
 *          lib/property-handover/handover-file-decision-plan (η ΙΔΙΑ κρίση με την πόρτα)
 * @module components/property-handover-office/HandoverFileDecisionDialog
 *
 * 🔑 **Ο διάλογος ΔΕΝ κρίνει**: οι επιλογές είναι **ακριβώς** το `offer.choices` (άγκυρα Ζ29) — ποτέ επιλογή που η πόρτα
 *    θα αρνηθεί. Η αιτιολογία είναι **υποχρεωτική** (Purview «business justification»)· το εμπιστευτικό θέλει **ρητή**
 *    επιβεβαίωση πριν φύγει (DLP override). Η πόρτα τα ξαναελέγχει όλα, όποιος κι αν είναι ο πελάτης.
 */

import React from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { Textarea } from '@/components/ui/textarea';
import type { HandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyHandoverPreviewFile } from '@/types/property-handover';
import {
  HANDOVER_FILE_DECISION_REASON_MAX,
  HANDOVER_FILE_DECISION_REASON_MIN,
  type HandoverFileDecisionChoice,
  type HandoverFileDecisionOffer,
} from '@/types/property-handover-file-decision';

const K = 'properties-detail:handover.fileDecision';

type OpenOffer = Extract<HandoverFileDecisionOffer, { kind: 'open' }>;

interface HandoverFileDecisionDialogProps {
  readonly file: PropertyHandoverPreviewFile;
  readonly offer: OpenOffer;
  readonly actions: HandoverOfficeActions;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Τα πεδία του διαλόγου — η επιλογή, η αιτιολογία, η επιβεβαίωση εμπιστευτικού. */
function DecisionFields({ offer, choice, onChoice, reason, onReason, confirmed, onConfirmed }: {
  readonly offer: OpenOffer;
  readonly choice: HandoverFileDecisionChoice;
  readonly onChoice: (choice: HandoverFileDecisionChoice) => void;
  readonly reason: string;
  readonly onReason: (reason: string) => void;
  readonly confirmed: boolean;
  readonly onConfirmed: (confirmed: boolean) => void;
}): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const confirmId = React.useId();
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <SegmentedControl<HandoverFileDecisionChoice> value={choice} onValueChange={onChoice} aria-label={t(`${K}.choiceLabel`)}>
        {offer.choices.map((option) => <SegmentedControlItem key={option} value={option}>{t(`${K}.choice.${option}`)}</SegmentedControlItem>)}
      </SegmentedControl>
      {choice === 'automatic' && <p className="m-0 text-sm text-muted-foreground">{t(`${K}.automaticMeans.${offer.automatic}`)}</p>}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{t(`${K}.reasonLabel`, { min: HANDOVER_FILE_DECISION_REASON_MIN })}</span>
        <Textarea rows={3} maxLength={HANDOVER_FILE_DECISION_REASON_MAX} value={reason} onChange={(event) => onReason(event.target.value)} />
      </label>
      {choice === 'deliver' && offer.deliverNeedsConfirmation && (
        <p className="m-0 flex items-start gap-2 text-sm text-foreground">
          <Checkbox id={confirmId} checked={confirmed} onCheckedChange={(state) => onConfirmed(state === true)} />
          <label htmlFor={confirmId}>{t(`${K}.confirmConfidential`)}</label>
        </p>
      )}
    </fieldset>
  );
}

export function HandoverFileDecisionDialog({ file, offer, actions, open, onOpenChange }: HandoverFileDecisionDialogProps): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const [choice, setChoice] = React.useState<HandoverFileDecisionChoice>(offer.choices[0]);
  const [reason, setReason] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  const needsConfirmation = choice === 'deliver' && offer.deliverNeedsConfirmation;
  const ready = reason.trim().length >= HANDOVER_FILE_DECISION_REASON_MIN && (!needsConfirmation || confirmed);

  const onConfirm = async () => {
    const done = await actions.decideFile({
      fileId: file.fileId, choice, expected: file.decision?.disposition ?? null, reason, confirmConfidential: needsConfirmation && confirmed,
    });
    if (done) onOpenChange(false);
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`${K}.title`, { name: file.displayName })}
      description={t(`${K}.description`)}
      confirmText={t(`${K}.confirmAction`)}
      variant={needsConfirmation ? 'warning' : 'default'}
      loading={actions.busyId === file.fileId}
      disabled={!ready}
      keepOpenWhilePending
      onConfirm={onConfirm}
    >
      <DecisionFields
        offer={offer} choice={choice} onChoice={setChoice} reason={reason} onReason={setReason}
        confirmed={confirmed} onConfirmed={setConfirmed}
      />
    </ConfirmDialog>
  );
}
