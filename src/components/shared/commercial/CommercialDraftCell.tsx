'use client';

/**
 * =============================================================================
 * CommercialDraftCell — διάθεση + τιμή σε ΕΝΑ κελί γρήγορης επεξεργασίας
 * =============================================================================
 *
 * Η γρήγορη επεξεργασία της καρτέλας κτιρίου (θέσεις · αποθήκες) έγραφε ένα σκέτο «Τιμή» στο
 * @deprecated `price` — που ο επιλυτής διάβαζε **πάντα** ως πώληση. Εδώ το κελί της στήλης
 * «Τιμή» γίνεται ο **ίδιος** επεξεργαστής με την κάρτα «Διάθεση & τιμή» (ADR-777 §8.60.18),
 * συμπυκνωμένος: επιλογέας διάθεσης και από κάτω **τα πεδία που ζητά** η διάθεση, με τη μονάδα
 * ως υπόδειξη («Ενοίκιο (€/μήνα)»). Revit Schedule: η γραμμή επεξεργάζεται τις **ίδιες**
 * παραμέτρους με την παλέτα Properties.
 *
 * @module components/shared/commercial/CommercialDraftCell
 */

import React from 'react';
import { isTransactionOwnedCommercialStatus } from '@/constants/commercial-statuses';
import { COMMERCIAL_PRICE_FIELD_ROLE, priceFieldsForStatus } from '@/lib/properties/commercial-draft';
import type { CommercialDraftState } from './useCommercialDraft';
import { CommercialStatusSelect } from './CommercialStatusSelect';
import { CommercialPriceInput } from './CommercialPriceInput';

export interface CommercialDraftCellProps {
  readonly commercial: CommercialDraftState;
  readonly disabled: boolean;
  /** Πρόθεμα `id` — μοναδικό ανά γραμμή. */
  readonly idPrefix: string;
}

export function CommercialDraftCell({ commercial, disabled, idPrefix }: CommercialDraftCellProps) {
  const { draft } = commercial;
  const pricesDisabled = disabled || isTransactionOwnedCommercialStatus(draft.commercialStatus);
  return (
    <fieldset className="flex min-w-36 flex-col gap-1">
      <CommercialStatusSelect
        id={`${idPrefix}-commercial-status`}
        value={draft.commercialStatus}
        onValueChange={commercial.setStatus}
        disabled={disabled}
        compact
      />
      {priceFieldsForStatus(draft.commercialStatus).map((field) => (
        <CommercialPriceInput
          key={field}
          id={`${idPrefix}-${field}`}
          role={COMMERCIAL_PRICE_FIELD_ROLE[field]}
          value={draft[field]}
          onValueChange={(raw) => commercial.setPrice(field, raw)}
          disabled={pricesDisabled}
          compact
        />
      ))}
    </fieldset>
  );
}
