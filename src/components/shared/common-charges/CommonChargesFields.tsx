'use client';

/**
 * **Τα πεδία των κοινοχρήστων** (ADR-777 §8.93) — ποσό τον μήνα · «χωρίς κοινόχρηστα» · τι περιλαμβάνουν.
 *
 * @related `lib/common-charges/common-charges.ts` (τύπος · κανόνες) · `components/owner-property/improve/CommonChargesImproveSection.tsx`
 *   («Βελτίωσε την αγγελία σου») · `features/property-details/components/PropertyFieldsEditForm.tsx` (φόρμα γραφείου)
 *
 * 🔑 **ΕΝΑ component για ιδιώτη ΚΑΙ γραφείο**: δεν ξέρει ποιο έγγραφο είναι ούτε πότε αποθηκεύεται — εκπέμπει
 * **μερική διόρθωση**, και ο καλών αποφασίζει (ουρά ανά απάντηση, ή κατάσταση φόρμας).
 *
 * 🔑 **Το ποσό εκπέμπεται όταν ο άνθρωπος ΤΕΛΕΙΩΣΕΙ** (blur), όχι σε κάθε πλήκτρο: το «12» καθ' οδόν προς το «120»
 * δεν είναι απάντηση, και εκεί που κάθε απάντηση αποθηκεύεται αμέσως θα έγραφε τρεις φορές.
 *
 * 🔑 **Τρεις καταστάσεις, ορατές**: κενό πεδίο = δεν δηλώθηκε · «Χωρίς κοινόχρηστα» = `0` · ποσό. Και για το
 * «τι περιλαμβάνουν»: τίποτα πατημένο = δεν ρωτήθηκε · «Τίποτα από αυτά» = `[]`.
 */

import React from 'react';

import { CheckLine } from '@/components/shared/form/CheckLine';
import { useCommittedDraft, type DraftReading } from '@/components/shared/form/useCommittedDraft';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  COMMON_CHARGE_INCLUSIONS,
  isCommonChargesAmount,
  MAX_COMMON_CHARGES_MONTHLY,
  type CommonChargeInclusion,
  type CommonCharges,
  type CommonChargesPatch,
} from '@/lib/common-charges/common-charges';
import { COMMON_CHARGE_INCLUSION_KEY } from '@/lib/common-charges/common-charges-keys';

/** Τα κείμενα της ερώτησης ζουν δίπλα στο λεξιλόγιό της (`properties-enums`) — δες `common-charges-keys.ts` για το γιατί. */
const NS = 'properties-enums';
const F = `${NS}:commonCharges.form`;

export interface CommonChargesFieldsProps {
  readonly value: CommonCharges;
  readonly onChange: (patch: CommonChargesPatch) => void;
  readonly disabled: boolean;
  /** Πρόθεμα για τα `id` — δύο στιγμιότυπα στην ίδια σελίδα δεν συγκρούονται. */
  readonly idPrefix: string;
}

/** Το κείμενο του πεδίου για ένα αποθηκευμένο ποσό: το `0` το λέει το κουτάκι, όχι το πεδίο. */
function draftOf(amount: number | null): string {
  return amount === null || amount === 0 ? '' : String(amount);
}

/** Κενό ⇒ «δεν δηλώθηκε»· ακέραιο εντός ορίων ⇒ το ποσό· οτιδήποτε άλλο ⇒ άκυρο (δεν εκπέμπεται). */
function parseDraft(draft: string): DraftReading<number> {
  const trimmed = draft.trim();
  if (trimmed === '') return { ok: true, value: null };
  const amount = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  return isCommonChargesAmount(amount) ? { ok: true, value: amount } : { ok: false };
}

function AmountField({ value, onChange, disabled, idPrefix }: CommonChargesFieldsProps) {
  const { t } = useTranslation([NS]);
  const { draft, setDraft, invalid, commit } = useCommittedDraft(value.monthlyAmount, draftOf, parseDraft, (monthlyAmount) =>
    onChange({ monthlyAmount }),
  );
  const none = value.monthlyAmount === 0;
  const inputId = `${idPrefix}-common-charges-amount`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">{t(`${F}.amount`)}</Label>
      <Input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        size="sm"
        className="max-w-40 text-right text-xs"
        aria-describedby={hintId}
        aria-invalid={invalid}
        disabled={disabled || none}
      />
      <p id={hintId} role={invalid ? 'alert' : undefined} className={invalid ? 'm-0 text-xs text-destructive' : 'm-0 text-xs text-muted-foreground'}>
        {invalid ? t(`${F}.amountInvalid`, { max: MAX_COMMON_CHARGES_MONTHLY }) : t(`${F}.amountHint`)}
      </p>
      <CheckLine
        label={t(`${F}.none`)}
        checked={none}
        disabled={disabled}
        onToggle={(checked) => onChange({ monthlyAmount: checked ? 0 : null })}
      />
    </div>
  );
}

/** Το επόμενο σύνολο όταν αλλάζει μία παροχή. Το άδειασμα γυρίζει στο «δεν ρωτήθηκε» — το «τίποτα» λέγεται ρητά. */
function toggledInclusions(
  current: readonly CommonChargeInclusion[] | null,
  inclusion: CommonChargeInclusion,
  included: boolean,
): CommonChargeInclusion[] | null {
  const held = current ?? [];
  const next = COMMON_CHARGE_INCLUSIONS.filter((candidate) =>
    candidate === inclusion ? included : held.includes(candidate),
  );
  return next.length > 0 ? next : null;
}

function InclusionsField({ value, onChange, disabled }: CommonChargesFieldsProps) {
  const { t } = useTranslation([NS]);
  const { includes } = value;

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="p-0 text-xs text-muted-foreground">{t(`${F}.includesLegend`)}</legend>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
        {COMMON_CHARGE_INCLUSIONS.map((inclusion) => (
          <li key={inclusion}>
            <CheckLine
              label={t(COMMON_CHARGE_INCLUSION_KEY[inclusion])}
              checked={includes?.includes(inclusion) ?? false}
              disabled={disabled}
              onToggle={(checked) => onChange({ includes: toggledInclusions(includes, inclusion, checked) })}
            />
          </li>
        ))}
      </ul>
      <CheckLine
        label={t(`${F}.includesNothing`)}
        checked={includes !== null && includes.length === 0}
        disabled={disabled}
        onToggle={(checked) => onChange({ includes: checked ? [] : null })}
      />
    </fieldset>
  );
}

export function CommonChargesFields(props: CommonChargesFieldsProps) {
  const amount = props.value.monthlyAmount;
  return (
    <div className="flex flex-col gap-3">
      <AmountField {...props} />
      {/* «Τι περιλαμβάνουν» έχει νόημα μόνο δίπλα σε θετικό ποσό — ίδιος κανόνας με τον αναγνώστη (ποτέ ορφανός προσδιοριστής). */}
      {amount !== null && amount > 0 && <InclusionsField {...props} />}
    </div>
  );
}
