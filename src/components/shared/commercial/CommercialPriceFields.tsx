'use client';

/**
 * =============================================================================
 * CommercialPriceFields — τα πεδία τιμής που ΖΗΤΑ η διάθεση
 * =============================================================================
 *
 * Γενίκευση της `PropertyCommercialPriceFields` (ADR-777 §8.60.18): η φόρμα ακινήτου και η
 * κάρτα «Εμπορικά» των θέσεων/αποθηκών ζωγραφίζουν **το ίδιο** component. Η κατάσταση
 * **οδηγεί** τα πεδία (`priceFieldsForStatus` — Revit «driven parameter»):
 *
 *   - `for-rent` ⇒ μόνο ενοίκιο «(€/μήνα)»
 *   - `for-sale-and-rent` ⇒ τιμή πώλησης «(€)» **και** ενοίκιο
 *   - κάθε άλλη ⇒ τιμή πώλησης
 *
 * Κάτω από κάθε ποσό ο **έλεγχος εύλογου** (€/m² ανά ρόλο και κλάση — ποτέ δεν μπλοκάρει) και
 * στο τέλος **ό,τι λείπει** για να φανεί η μονάδα στις πωλήσεις.
 *
 * @module components/shared/commercial/CommercialPriceFields
 */

import React from 'react';
import { PricePlausibilityWarning } from '@/components/properties/shared/PricePlausibilityWarning';
import { SalesDashboardRequirementsAlert } from '@/components/properties/shared/SalesDashboardRequirementsAlert';
import {
  COMMERCIAL_PRICE_FIELD_ROLE,
  priceFieldsForStatus,
  type CommercialDraft,
  type CommercialPriceField,
} from '@/lib/properties/commercial-draft';
import { CommercialPriceInput } from './CommercialPriceInput';

/**
 * Η κατάσταση που κρίνει ο έλεγχος εύλογου για κάθε πεδίο: το **ενοίκιο** κρίνεται πάντα ως
 * ενοίκιο (€/m²/μήνα)· η **τιμή πώλησης** με την κατάσταση της μονάδας — «εκτός αγοράς» δεν
 * ελέγχεται, όπως ήταν στη φόρμα ακινήτου.
 */
function plausibilityStatusOf(field: CommercialPriceField, status: CommercialDraft['commercialStatus']): string {
  return field === 'rentPrice' ? 'for-rent' : status;
}

export interface CommercialPriceFieldsProps {
  /** Το πρόχειρο: κατάσταση + ποσά ως κείμενο μηχανής. */
  readonly draft: CommercialDraft;
  readonly onPriceChange: (field: CommercialPriceField, raw: string) => void;
  /** Εμβαδόν για €/m² και για «τι λείπει» — `undefined` όταν η φόρμα δεν το έχει. */
  readonly grossArea: number | undefined;
  /** Ο τύπος που ορίζει την κλάση τιμής (κατοικία · επαγγελματικό · βοηθητικός χώρος). */
  readonly pricingType: string;
  readonly disabled: boolean;
  /** Πρόθεμα για τα `id` των πεδίων — μοναδικό ανά φόρμα. */
  readonly idPrefix: string;
}

export function CommercialPriceFields({
  draft,
  onPriceChange,
  grossArea,
  pricingType,
  disabled,
  idPrefix,
}: CommercialPriceFieldsProps) {
  const fields = priceFieldsForStatus(draft.commercialStatus);
  return (
    <>
      {fields.map((field) => (
        <fieldset key={field} className="space-y-1">
          <CommercialPriceInput
            id={`${idPrefix}-${field}`}
            role={COMMERCIAL_PRICE_FIELD_ROLE[field]}
            value={draft[field]}
            onValueChange={(raw) => onPriceChange(field, raw)}
            disabled={disabled}
          />
          <PricePlausibilityWarning
            commercialStatus={plausibilityStatusOf(field, draft.commercialStatus)}
            propertyType={pricingType}
            askingPrice={draft[field] || null}
            grossArea={grossArea}
            className="py-2 px-3 mt-1"
          />
        </fieldset>
      ))}
      <SalesDashboardRequirementsAlert
        commercialStatus={draft.commercialStatus}
        askingPrice={draft.askingPrice || null}
        rentPrice={draft.rentPrice || null}
        grossArea={grossArea}
        className="py-2 px-3 mt-1"
      />
    </>
  );
}
