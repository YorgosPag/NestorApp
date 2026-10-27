/**
 * Zod schemas για τιμοκαταλόγους, γραμμές, ομάδες και συνθήκες έκπτωσης (ADR-923 §5.11).
 * **Δομή** εδώ· η **σημασία** (άθροισμα ανάλυσης, μονοτονία κλιμάκων, ασάφεια) στο
 * `validate-pricing.ts`, ώστε να φτάνει ως εύρημα στο πεδίο αντί για 400 χωρίς διαδρομή.
 * Τα λεξιλόγια διαβάζονται **μόνο** από τη ρίζα τους (CHECK 3.73).
 * @module subapps/catalog/schema/zod/price-list.schema
 */

import { z } from 'zod';
import { DISCOUNT_TIER_BASES, type DiscountRule } from '@/lib/pricing/discount-rule';
import type {
  CostBreakdown,
  CustomerAssignmentDefinition,
  CustomerGroupDefinition,
  DiscountConditionDefinition,
  DiscountGroupDefinition,
  PriceAudience,
  PriceLineSubject,
  PriceListDefinition,
  PriceListLineDefinition,
  PricingPartyRef,
} from '../../types/price-list';
import type { PriceLineInput } from '../../types/price-list-requests';
import { PRICE_LIST_KINDS, PRICE_TYPES, isPriceQuantity, type PriceQuantity } from '../../vocabulary/pricing';
import { catalogCodeSchema, entityIdSchema, labelsSchema, measurementUnitCodeSchema } from './common.schema';

const isoInstantSchema = z.string().datetime({ offset: true });

const minorAmountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Δομή μόνο: το εύρος 0..100% το κρίνει ο επικυρωτής (εύρημα στο πεδίο). */
const basisPointsSchema = z.number().int();

const stepsSchema = z.array(basisPointsSchema);

const subjectSchema: z.ZodType<PriceLineSubject, z.ZodTypeDef, unknown> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('variant'), variantId: entityIdSchema }),
  z.object({ kind: z.literal('costItem'), atoeCode: z.string().trim().min(1).max(64), region: z.string().trim().min(1).max(64).nullable() }),
]);

const breakdownSchema: z.ZodType<CostBreakdown, z.ZodTypeDef, unknown> = z.object({
  material: minorAmountSchema,
  labor: minorAmountSchema,
  equipment: minorAmountSchema,
  defaultWasteBp: basisPointsSchema,
  materialVariantId: entityIdSchema.nullable(),
});

/** Τα πεδία της γραμμής **χωρίς** την έκδοση — κοινά για τον ορισμό και τη δέσμη του αιτήματος (η έκδοση = διαδρομή). */
const priceLineFields = {
  subject: subjectSchema,
  netPrice: minorAmountSchema,
  priceQuantity: z.custom<PriceQuantity>(isPriceQuantity),
  unitCode: measurementUnitCodeSchema,
  discountGroupId: entityIdSchema.nullable(),
  breakdown: breakdownSchema.nullable(),
};

export const priceListLineDefinitionSchema: z.ZodType<PriceListLineDefinition, z.ZodTypeDef, unknown> = z.object({
  versionId: entityIdSchema,
  ...priceLineFields,
});

export const priceLineInputSchema: z.ZodType<PriceLineInput, z.ZodTypeDef, unknown> = z.object(priceLineFields);

export { audienceSchema as priceAudienceSchema, isoInstantSchema, subjectSchema as priceLineSubjectSchema };

export const discountGroupDefinitionSchema: z.ZodType<DiscountGroupDefinition, z.ZodTypeDef, unknown> = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
});

export const customerGroupDefinitionSchema: z.ZodType<CustomerGroupDefinition, z.ZodTypeDef, unknown> = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
});

const partyRefSchema: z.ZodType<PricingPartyRef, z.ZodTypeDef, unknown> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('contact'), contactId: entityIdSchema }),
  z.object({ kind: z.literal('workspace'), companyId: entityIdSchema }),
]);

export const customerAssignmentDefinitionSchema: z.ZodType<CustomerAssignmentDefinition, z.ZodTypeDef, unknown> = z.object({
  party: partyRefSchema,
  customerGroupId: entityIdSchema,
});

const audienceSchema: z.ZodType<PriceAudience, z.ZodTypeDef, unknown> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anonymous') }),
  z.object({ kind: z.literal('signedIn') }),
  z.object({ kind: z.literal('customerGroup'), customerGroupId: entityIdSchema }),
  z.object({ kind: z.literal('partner'), party: partyRefSchema }),
]);

// Μετά το `audienceSchema`: ο τιμοκατάλογος δηλώνει κοινό (ADR-923 §5.11 απόφαση Α).
export const priceListDefinitionSchema: z.ZodType<PriceListDefinition, z.ZodTypeDef, unknown> = z.object({
  code: catalogCodeSchema,
  labels: labelsSchema,
  kind: z.enum(PRICE_LIST_KINDS),
  priceType: z.enum(PRICE_TYPES),
  audience: audienceSchema.nullable(),
  changeFenceBp: basisPointsSchema.nullable(),
});

export const discountRuleSchema: z.ZodType<DiscountRule, z.ZodTypeDef, unknown> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chain'), steps: stepsSchema }),
  z.object({
    kind: z.literal('tiers'),
    basis: z.enum(DISCOUNT_TIER_BASES),
    tiers: z.array(z.object({ min: z.number().finite(), steps: stepsSchema })),
  }),
]);

export const discountConditionDefinitionSchema: z.ZodType<DiscountConditionDefinition, z.ZodTypeDef, unknown> = z.object({
  discountGroupId: entityIdSchema.nullable(),
  audience: audienceSchema,
  validFrom: isoInstantSchema.nullable(),
  validUntil: isoInstantSchema.nullable(),
  rule: discountRuleSchema,
});
