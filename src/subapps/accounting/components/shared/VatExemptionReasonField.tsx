'use client';

/**
 * @fileoverview **Αιτία εξαίρεσης ΦΠΑ μιας γραμμής** (ADR-ACC-003 §7 · §8.3 · §22).
 * @module subapps/accounting/components/shared/VatExemptionReasonField
 *
 * 🔑 Οι επιλογές βγαίνουν από τον ΕΝΑ κατάλογο (`VAT_EXEMPTION_REASONS`), ομαδοποιημένες· κάθε επιλογή γράφει
 * «κωδικός. τίτλος άρθρου». Κάτω από το πεδίο, η **παραπομπή που θα τυπωθεί** (`vatExemptionCitation`, η ίδια
 * συνάρτηση με το PDF), στην έκδοση του Κώδικα ΦΠΑ που ισχύει την ημερομηνία έκδοσης.
 * 🔑 Radix Select (ADR-001)· χωρίς επιλογή η τιμή είναι `undefined` (placeholder), ποτέ `''` (CHECK 3.48).
 * 🔑 Χωρίς αιτία: μήνυμα στο πεδίο με `aria-invalid` + `aria-describedby` — ο ίδιος κανόνας
 *    (`isVatExemptionMissing`) με τον έλεγχο πριν τη διαβίβαση.
 */

import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  VAT_EXEMPTION_GROUPS,
  VAT_EXEMPTION_NAMESPACE,
  isVatExemptionCode,
  vatExemptionCitation,
  vatExemptionGroupLabel,
  vatExemptionReasonsIn,
  vatExemptionTitle,
  type VatExemptionCode,
} from '@/subapps/accounting/services/config/vat-exemption-reasons';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface VatExemptionReasonFieldProps {
  readonly id: string;
  readonly value: number | null | undefined;
  /** Ημερομηνία έκδοσης (ISO) — ορίζει ποια έκδοση του Κώδικα ΦΠΑ αναγράφεται. */
  readonly issueDate: string;
  readonly onValueChange: (code: VatExemptionCode) => void;
  readonly disabled?: boolean;
  /** Ευρήματα ελέγχου γι' αυτό το πεδίο, εκτός του `fieldset` (ADR-ACC-003 §22.8) — προστίθενται στο `aria-describedby`. */
  readonly reviewNoteId?: string;
}

export function VatExemptionReasonField({
  id, value, issueDate, onValueChange, disabled, reviewNoteId,
}: VatExemptionReasonFieldProps) {
  const { t } = useTranslation(VAT_EXEMPTION_NAMESPACE);
  const selected = isVatExemptionCode(value) ? value : null;
  const hintId = `${id}-hint`;

  return (
    <fieldset className="mt-3">
      <Label htmlFor={id}>{t('field.label')}</Label>
      <Select
        value={selected === null ? undefined : String(selected)}
        onValueChange={(raw) => {
          const code = Number(raw);
          if (isVatExemptionCode(code)) onValueChange(code);
        }}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={selected === null}
          aria-describedby={reviewNoteId ? `${hintId} ${reviewNoteId}` : hintId}
        >
          <SelectValue placeholder={t('field.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {VAT_EXEMPTION_GROUPS.map((group) => (
            <SelectGroup key={group}>
              <SelectLabel>{vatExemptionGroupLabel(t, group)}</SelectLabel>
              {vatExemptionReasonsIn(group).map(({ code }) => (
                <SelectItem key={code} value={String(code)}>
                  {t('field.option', { code, title: vatExemptionTitle(t, code) })}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <VatExemptionLineNote id={hintId} value={value} issueDate={issueDate} />
    </fieldset>
  );
}

interface VatExemptionLineNoteProps {
  readonly id?: string;
  readonly value: number | null | undefined;
  readonly issueDate: string;
}

/**
 * Η παραπομπή μιας γραμμής «Άνευ ΦΠΑ» σε μορφή ανάγνωσης — ή το μήνυμα ότι λείπει. Ίδιο κείμενο στη φόρμα
 * (κάτω από τον επιλογέα) και στην καρτέλα του τιμολογίου.
 */
export function VatExemptionLineNote({ id, value, issueDate }: VatExemptionLineNoteProps) {
  const { t } = useTranslation(VAT_EXEMPTION_NAMESPACE);
  const colors = useSemanticColors();
  const missing = !isVatExemptionCode(value);
  const text = isVatExemptionCode(value)
    ? t('field.summary', { code: value, ...vatExemptionCitation(t, value, issueDate) })
    : t('field.required');

  return (
    <p id={id} className={cn('mt-1 text-xs', missing ? 'text-destructive' : colors.text.muted)}>
      {text}
    </p>
  );
}
