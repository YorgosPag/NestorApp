/**
 * Τιμοκατάλογος MFP — τα σενάρια αποδοχής της Φάσης 3 (ADR-923 §5.11) ως δεδομένα:
 *   - **έκδοση 1** (από 1/1/2026): τα 7 SKU στην ομάδα «TOSH-CARR» + το απλό `099-99-001` **χωρίς**
 *     ομάδα έκπτωσης (η αρνητική περίπτωση της 2ε, §5.10.5 ε)·
 *   - **έκδοση 2** (από 1/7/2026, βάση την 1): +8% σε όλες·
 *   - συνθήκες: χονδρέμπορος «TOSH-CARR −50%» · συνεργάτης «50+10» · συνδεδεμένοι «−5% σε όλα».
 * Οι τιμές είναι **ενδεικτικές** (λεπτά, χωρίς ΦΠΑ) — ο κατάλογος Aries δεν δίνει τιμές.
 */

import type {
  DiscountConditionDefinition,
  PriceListDefinition,
  PriceListLineDefinition,
  PricingPartyRef,
} from '../../types/price-list';
import type { PricedRecord } from '../../pricing/resolve-catalog-price';
import type { PriceVersionRef } from '../../pricing/version-timeline';
import { priceLineSubjectKey } from '../../pricing/price-line-subject';
import { MFP_SIZES } from './mfp-fan-coil.fixture';
import { mfpVariantId } from './mfp-fan-coil-products.fixture';

export const SIMPLE_VARIANT_ID = 'cprod_099_99_001';
export const TOSH_CARR = 'cdgrp_tosh_carr';
export const WHOLESALE = 'ccgrp_wholesale';
export const PARTNER: PricingPartyRef = { kind: 'contact', contactId: 'cont_papadopoulos' };

export const MFP_PRICE_LIST: PricedRecord<PriceListDefinition> = {
  id: 'cprl_gen',
  definition: { code: 'gen', labels: { el: 'Γενικός τιμοκατάλογος' }, kind: 'sales', priceType: 'net_list' },
};

/** Τιμή λίστας έκδοσης 1, σε λεπτά, ανά μέγεθος MFP. */
export const MFP_V1_PRICES = [52000, 58000, 64000, 71000, 79000, 92000, 108000] as const;
export const SIMPLE_V1_PRICE = 1250;

export const VERSION_1: PriceVersionRef = { id: 'cplv_gen_1', number: 1, status: 'superseded', validFrom: '2026-01-01T00:00:00.000Z' };
export const VERSION_2: PriceVersionRef = { id: 'cplv_gen_2', number: 2, status: 'published', validFrom: '2026-07-01T00:00:00.000Z' };

function linesOf(versionId: string, factorPercent: number): PriceListLineDefinition[] {
  const scale = (price: number): number => Math.round((price * factorPercent) / 100);
  const mfp = MFP_SIZES.map((_, index): PriceListLineDefinition => ({
    versionId,
    subject: { kind: 'variant', variantId: mfpVariantId(index) },
    netPrice: scale(MFP_V1_PRICES[index]),
    priceQuantity: 1,
    unitCode: 'pcs',
    discountGroupId: TOSH_CARR,
    breakdown: null,
  }));
  const simple: PriceListLineDefinition = {
    versionId,
    subject: { kind: 'variant', variantId: SIMPLE_VARIANT_ID },
    netPrice: scale(SIMPLE_V1_PRICE),
    priceQuantity: 1,
    unitCode: 'pcs',
    discountGroupId: null,
    breakdown: null,
  };
  return [...mfp, simple];
}

export const VERSION_1_LINES = linesOf(VERSION_1.id, 100);
export const VERSION_2_LINES = linesOf(VERSION_2.id, 108);

/** Η αναζήτηση γραμμής του επιλυτή πάνω στα δύο σύνολα. */
export function fixtureLineFor(versionId: string, subjectKey: string): PricedRecord<PriceListLineDefinition> | null {
  const lines = versionId === VERSION_1.id ? VERSION_1_LINES : versionId === VERSION_2.id ? VERSION_2_LINES : [];
  const index = lines.findIndex((line) => priceLineSubjectKey(line.subject) === subjectKey);
  return index < 0 ? null : { id: `${versionId}_${index}`, definition: lines[index] };
}

const always = { validFrom: null, validUntil: null } as const;

export const WHOLESALE_TOSH_CARR: PricedRecord<DiscountConditionDefinition> = {
  id: 'cdcnd_wholesale_tc',
  definition: { ...always, discountGroupId: TOSH_CARR, audience: { kind: 'customerGroup', customerGroupId: WHOLESALE }, rule: { kind: 'chain', steps: [5000] } },
};

export const PARTNER_TOSH_CARR: PricedRecord<DiscountConditionDefinition> = {
  id: 'cdcnd_partner_tc',
  definition: { ...always, discountGroupId: TOSH_CARR, audience: { kind: 'partner', party: PARTNER }, rule: { kind: 'chain', steps: [5000, 1000] } },
};

export const SIGNED_IN_ALL: PricedRecord<DiscountConditionDefinition> = {
  id: 'cdcnd_signed_all',
  definition: { ...always, discountGroupId: null, audience: { kind: 'signedIn' }, rule: { kind: 'chain', steps: [500] } },
};

export const MFP_CONDITIONS = [WHOLESALE_TOSH_CARR, PARTNER_TOSH_CARR, SIGNED_IN_ALL] as const;
