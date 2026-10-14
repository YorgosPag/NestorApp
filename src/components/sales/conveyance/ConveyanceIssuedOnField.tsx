'use client';

/**
 * ADR-901 Φ1 · ADR-915 Φ3β — το πεδίο «Ημερομηνία έκδοσης» του διαλόγου ελέγχου.
 *
 * Τα γεγονότα **του ίδιου του αρχείου** (`reviewIssuedOnOf`) το προσυμπληρώνουν:
 * - `document-text` (διαβάστηκε από το έγγραφο) ⇒ **μόνο ανάγνωση**· η διαφωνία γίνεται με **επιστροφή** του εγγράφου,
 *   ποτέ με αντικατάσταση της ημερομηνίας (τη φυλάει και ο πυρήνας: `issued_on_contradicts_document`).
 * - `attested` (δήλωση προηγούμενου ελέγχου) ⇒ προσυμπληρωμένο και επεξεργάσιμο.
 * - Α4: όταν η τυπωμένη λήξη διαφωνεί με τον κανόνα, ο ελεγκτής το **βλέπει** εδώ.
 *
 * @module components/sales/conveyance/ConveyanceIssuedOnField
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Label } from '@/components/ui/label';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { ReviewIssuedOn } from '@/lib/conveyance/review-attestation';

interface ConveyanceIssuedOnFieldProps {
  readonly value: Date | undefined;
  readonly onChange: (date: Date | undefined) => void;
  readonly known: ReviewIssuedOn;
}

const ORIGIN_HINT_KEY: Readonly<Record<NonNullable<ReviewIssuedOn['origin']>, string>> = {
  'document-text': 'dialogs.issuedOnFromDocument',
  attested: 'dialogs.issuedOnFromAttestation',
};

export function ConveyanceIssuedOnField({ value, onChange, known }: ConveyanceIssuedOnFieldProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const locked = known.origin === 'document-text' && known.issuedOn !== null;
  const hintKey = known.origin === null ? 'dialogs.issuedOnHint' : ORIGIN_HINT_KEY[known.origin];
  return (
    <fieldset className="space-y-1">
      <Label htmlFor="conveyance-issued-on">{t('dialogs.issuedOnLabel')}</Label>
      <DatePickerField
        id="conveyance-issued-on"
        value={value}
        onSelect={onChange}
        placeholder={t('signing.notSet')}
        disabled={locked}
        disabledDates={{ after: new Date() }}
      />
      <p className={cn('text-xs', colors.text.muted)}>{t(hintKey)}</p>
      {known.discrepancy && (
        <p role="note" className={cn('text-xs', colors.text.warning)}>
          {t('dialogs.expiryDiscrepancy', { printed: formatDate(known.discrepancy.printed), rule: formatDate(known.discrepancy.rule) })}
        </p>
      )}
    </fieldset>
  );
}
