'use client';

/**
 * @fileoverview ADR-943 Φ4 — **τα πεδία της προκαταβολής** μέσα στην προσφορά: ζητείται; · ποσό (ως 50% του συνόλου) ·
 *   πολιτική ακύρωσης · αξία αυτοψίας — και ο πίνακας ακύρωσης όπως θα τον δει ο ιδιοκτήτης.
 * @related IssuanceQuoteFields.tsx (ο γονέας) · issuance-quote-draft.ts (`advanceTermsFromDraft` — η ΙΔΙΑ κρίση με τον
 *   μειωτή) · IssuanceAdvanceSchedule.tsx
 * @module components/document-registry/IssuanceAdvanceFields
 *
 * 🔑 Η πολιτική **δεν** έχει προεπιλογή: τη διαλέγει ο επαγγελματίας ρητά (Κ-5).
 * 🔑 Ο επαγγελματίας βλέπει **ό,τι θα δει ο ιδιοκτήτης** (ίδιο component) πριν στείλει.
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ADVANCE_POLICY, CANCELLATION_POLICIES, maxAdvanceMinorOf } from '@/lib/document-validity/issuance-advance';
import { formatMinor } from '@/lib/money/money';

import { ChoiceField } from './IssuanceChoiceField';
import { IssuanceAdvanceSchedule } from './IssuanceAdvanceSchedule';
import { policyText } from './issuance-advance-labels';
import { advanceTermsFromDraft, type AdvanceDraft } from './issuance-quote-draft';

export interface IssuanceAdvanceFieldsProps {
  readonly advance: AdvanceDraft;
  /** Το σύνολο της προσφοράς με ΦΠΑ, όταν το ποσό στέκει — αλλιώς `null` (το όριο δεν λέγεται ακόμη). */
  readonly totalMinor: number | null;
  readonly onChange: (next: AdvanceDraft) => void;
}

function AdvanceAmounts({ advance, totalMinor, onChange }: IssuanceAdvanceFieldsProps): React.ReactElement {
  const { t } = useTranslation(['document-registry']);
  const amountId = useId();
  const amountHintId = useId();
  const inspectionId = useId();
  const inspectionHintId = useId();
  const set = (patch: Partial<AdvanceDraft>) => onChange({ ...advance, ...patch });
  return (
    <>
      <Label htmlFor={amountId} className="text-sm font-medium">{t('document-registry:issuance.advance.amountLabel')}</Label>
      <Input id={amountId} inputMode="decimal" autoComplete="off" aria-describedby={amountHintId} value={advance.amount} onChange={(event) => set({ amount: event.target.value })} />
      <p id={amountHintId} className="m-0 text-xs text-muted-foreground">
        {totalMinor === null
          ? t('document-registry:issuance.advance.amountHintNoTotal', { percent: String(ADVANCE_POLICY.maxPercentOfTotal) })
          : t('document-registry:issuance.advance.amountHint', { percent: String(ADVANCE_POLICY.maxPercentOfTotal), max: formatMinor(maxAdvanceMinorOf(totalMinor)) })}
      </p>
      <ChoiceField
        legend={t('document-registry:issuance.advance.policyLegend')} options={CANCELLATION_POLICIES} value={advance.policy}
        onChange={(policy) => set({ policy })} labelOf={(policy) => policyText(t, policy)}
      />
      <Label htmlFor={inspectionId} className="text-sm font-medium">{t('document-registry:issuance.advance.inspectionLabel')}</Label>
      <Input id={inspectionId} inputMode="decimal" autoComplete="off" aria-describedby={inspectionHintId} value={advance.inspectionValue} onChange={(event) => set({ inspectionValue: event.target.value })} />
      <p id={inspectionHintId} className="m-0 text-xs text-muted-foreground">{t('document-registry:issuance.advance.inspectionHint')}</p>
    </>
  );
}

export function IssuanceAdvanceFields({ advance, totalMinor, onChange }: IssuanceAdvanceFieldsProps): React.ReactElement {
  const { t } = useTranslation(['document-registry']);
  const requestedId = useId();
  const terms = totalMinor === null ? 'invalid' : advanceTermsFromDraft(advance, totalMinor);
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-foreground">{t('document-registry:issuance.advance.legend')}</legend>
      <Label htmlFor={requestedId} className="flex items-center gap-2 text-sm font-normal">
        <Checkbox id={requestedId} checked={advance.requested} onCheckedChange={(checked) => onChange({ ...advance, requested: checked === true })} />
        <span>{t('document-registry:issuance.advance.request')}</span>
      </Label>
      {advance.requested ? <AdvanceAmounts advance={advance} totalMinor={totalMinor} onChange={onChange} /> : null}
      {advance.requested && terms !== null && terms !== 'invalid' ? <IssuanceAdvanceSchedule terms={terms} /> : null}
      {advance.requested && terms === 'invalid' && advance.amount !== '' ? (
        <p className="m-0 text-xs text-destructive" role="status">{t('document-registry:issuance.advance.invalid')}</p>
      ) : null}
    </fieldset>
  );
}
