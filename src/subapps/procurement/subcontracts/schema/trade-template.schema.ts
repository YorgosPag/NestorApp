/**
 * @fileoverview Τα zod **σχήματα** του προτύπου ειδικότητας — γραμμές (schedule of values) και εμπορικοί όροι (ADR-928 §5.3 · §5.4).
 * @module subapps/procurement/subcontracts/schema/trade-template.schema
 *
 * Σχήμα και μέγεθος μόνο· η σημασιολογία (μερίδια = 100%, ζώνες, ΦΠΑ από τον ΕΝΑ πίνακα) στους επικυρωτές του τομέα.
 * Τα σχήματα γραμμής και όρων τα ξαναχρησιμοποιεί το συμφωνητικό της Φ2.
 */

import { z } from 'zod';
import { isGreekVatRatePercent, type GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import { AGREEMENT_LINE_KINDS, AGREEMENT_LINE_PRICINGS, type AgreementLine } from '../types/agreement-line';
import { CLAUSE_PARTIES } from '../types/clause-parameter';
import { REQUIRED_DOCUMENT_KINDS, type CommercialTerms } from '../types/commercial-terms';
import {
  HOLIDAY_SHIFTS,
  PAYMENT_BASES,
  RECURRENCE_UNITS,
  SETTLEMENT_INSTRUMENTS,
  type PaymentPlan,
  type RetentionTerms,
} from '../types/payment-plan';
import { AGREEMENT_DOCUMENT_MODES, type SubcontractTradeTemplateDefinition } from '../types/trade-template';
import {
  clauseBlocksSchema,
  clauseParameterValueSchema,
  expectedRevisionSchema,
  localizedTextSchema,
  SUBCONTRACT_LIMITS,
  uomCodeSchema,
  weekdaySchema,
} from './clause.schema';

const key = z.string().min(1).max(SUBCONTRACT_LIMITS.maxKeyLength);
const integer = z.number().int();
const vatRateSchema = z.custom<GreekVatRatePercent>(isGreekVatRatePercent);
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).max(SUBCONTRACT_LIMITS.maxOptions);

const retentionSchema: z.ZodType<RetentionTerms> = z.object({
  rate: integer,
  release: list(z.object({
    share: integer,
    trigger: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('provisional_acceptance') }),
      z.object({ kind: z.literal('final_acceptance') }),
      z.object({ kind: z.literal('months_after'), event: z.enum(['provisional_acceptance', 'final_acceptance']), months: integer }),
    ]),
  })),
});

const settlementSharesSchema = list(z.object({ instrument: z.enum(SETTLEMENT_INSTRUMENTS), share: integer, chequeMaturityDays: integer.optional() }));

const paymentPlanSchema: z.ZodType<PaymentPlan> = z.object({
  basis: z.enum(PAYMENT_BASES),
  schedule: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('on_completion') }),
    z.object({ kind: z.literal('on_milestones') }),
    z.object({ kind: z.literal('on_request') }),
    z.object({
      kind: z.literal('recurring'),
      every: integer,
      unit: z.enum(RECURRENCE_UNITS),
      anchor: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('weekday'), weekday: weekdaySchema }),
        z.object({ kind: z.literal('month_days'), days: list(integer) }),
        z.object({ kind: z.literal('start_date') }),
      ]),
      holidayShift: z.enum(HOLIDAY_SHIFTS),
    }),
  ]),
  finalSettlement: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('milestone'), milestone: key }),
    z.object({ kind: z.literal('final_acceptance') }),
    z.object({ kind: z.literal('days_after_completion'), days: integer }),
  ]),
  settlement: z.object({ regular: settlementSharesSchema, final: settlementSharesSchema.nullable() }),
  capAtEarnedValue: z.boolean(),
  milestones: list(z.object({
    milestone: key,
    amount: z.discriminatedUnion('kind', [z.object({ kind: z.literal('fixed'), value: integer }), z.object({ kind: z.literal('percent'), value: integer })]),
  })),
  advance: z.object({
    amount: integer,
    recovery: z.discriminatedUnion('kind', [z.object({ kind: z.literal('per_payment'), rate: integer }), z.object({ kind: z.literal('on_final') })]),
  }).nullable(),
  retention: retentionSchema.nullable(),
});

export const commercialTermsSchema: z.ZodType<CommercialTerms> = z.object({
  vat: z.object({ treatment: z.enum(['excluded', 'included']), rate: vatRateSchema }),
  withholding: z.object({ applies: z.boolean(), rate: integer }),
  paymentPlan: paymentPlanSchema,
  penalty: z.object({ perDay: integer, capOfContractValue: integer }).nullable(),
  minimumOutputs: list(z.object({ lineId: key, milliUnitsPerDay: integer })),
  crew: z.object({
    minimumHeadcount: integer,
    members: list(z.object({ role: localizedTextSchema, trade: z.enum(TRADE_CODES).nullable(), ratioParts: integer, dailyWage: integer.nullable() })),
  }).nullable(),
  costSharing: list(z.object({ description: localizedTextSchema, shares: list(z.object({ party: z.enum(CLAUSE_PARTIES), share: integer })) })),
  requiredDocuments: list(z.object({
    kind: z.enum(REQUIRED_DOCUMENT_KINDS),
    when: z.discriminatedUnion('kind', [z.object({ kind: z.literal('days_before_start'), days: integer }), z.object({ kind: z.literal('before_each_payment') })]),
  })),
  cashLimitPerPayment: integer,
});

export const agreementLineSchema: z.ZodType<AgreementLine> = z.object({
  id: key,
  kind: z.enum(AGREEMENT_LINE_KINDS),
  pricing: z.enum(AGREEMENT_LINE_PRICINGS),
  description: localizedTextSchema,
  atoeCode: key.nullable(),
  skuRef: z.object({ supplierCompanyId: key, variantId: key }).nullable(),
  unit: uomCodeSchema,
  estimatedMilliQuantity: integer.nullable(),
  unitPrice: integer,
  clientUnitPrice: integer.nullable(),
  printClientPrice: z.boolean(),
  comment: localizedTextSchema.nullable(),
  measurementRule: z.object({ blocks: clauseBlocksSchema }).nullable(),
  stages: z.array(z.object({ key, label: localizedTextSchema, share: integer })).max(SUBCONTRACT_LIMITS.maxStages),
  insuredDaysCap: z.object({ unit: uomCodeSchema, milliUnitsPerInsuredDay: integer }).nullable(),
  paymentOverride: z.object({ basis: z.enum(PAYMENT_BASES).optional(), retention: retentionSchema.nullable().optional(), capAtEarnedValue: z.boolean().optional() }).nullable(),
});

export const tradeTemplateDefinitionSchema: z.ZodType<SubcontractTradeTemplateDefinition> = z.object({
  code: key,
  trade: z.enum(TRADE_CODES),
  title: localizedTextSchema,
  defaultDocumentMode: z.enum(AGREEMENT_DOCUMENT_MODES),
  lines: z.array(agreementLineSchema).max(SUBCONTRACT_LIMITS.maxLines),
  clauses: z.array(z.object({ clauseKey: key, parameterOverrides: z.record(key, clauseParameterValueSchema) })).max(SUBCONTRACT_LIMITS.maxClauseRefs),
  defaultTerms: commercialTermsSchema,
});

export const createTradeTemplateBodySchema = z.object({ definition: tradeTemplateDefinitionSchema });

export const updateTradeTemplateBodySchema = z.object({ expectedRevision: expectedRevisionSchema, definition: tradeTemplateDefinitionSchema });
