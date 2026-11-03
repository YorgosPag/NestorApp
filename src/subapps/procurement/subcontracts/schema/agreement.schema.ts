/**
 * @fileoverview Τα zod **σχήματα** του συμφωνητικού (ADR-928 §5.4 · Φ2) — σχήμα και μέγεθος μόνο.
 * @module subapps/procurement/subcontracts/schema/agreement.schema
 *
 * Ξαναχρησιμοποιεί τα σχήματα γραμμής και όρων της Φ1 (`agreementLineSchema` · `commercialTermsSchema`) — **ένας**
 * ορισμός του «σωστό σχήμα γραμμής» για πρότυπο και συμφωνητικό. Η σημασιολογία στους επικυρωτές του τομέα.
 * 🔑 Κανένα πεδίο για στιγμιότυπα μερών ή για απόφαση απόκλισης: ό,τι δεν δέχεται το σχήμα δεν μπορεί να το στείλει ο
 * πελάτης (Φ2 αποφάσεις 4, 6).
 */

import { z } from 'zod';
import { TRADE_CODES } from '@/subapps/procurement/types/trade';
import type { SignatoryFieldSet } from '@/subapps/procurement/types/signatory-fields';
import type { SubcontractAgreementDraftInput } from '../agreements/agreement-draft';
import type { ClauseSelectionInput } from '../agreements/judge-deviations';
import { AGREEMENT_ENTRY_CHANNELS, type AgreementOrigin } from '../types/agreement';
import { AGREEMENT_DOCUMENT_MODES } from '../types/trade-template';
import {
  calendarDaySchema,
  clauseParameterValueSchema,
  expectedRevisionSchema,
  localizedTextSchema,
  reasonSchema,
  SUBCONTRACT_LIMITS,
} from './clause.schema';
import { agreementLineSchema, commercialTermsSchema } from './trade-template.schema';

const id = z.string().min(1).max(SUBCONTRACT_LIMITS.maxKeyLength);
const ids = z.array(id).max(SUBCONTRACT_LIMITS.maxOptions);
const label = z.string().max(SUBCONTRACT_LIMITS.maxLabelLength);
const optionalLabel = label.nullable();

const originSchema: z.ZodType<AgreementOrigin> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('direct') }),
  z.object({ kind: z.literal('rfq_award'), rfqId: id, quoteId: id }),
  z.object({ kind: z.literal('entered_on_behalf'), channel: z.enum(AGREEMENT_ENTRY_CHANNELS) }),
]);

/** Ο υπογράφων της εταιρείας (ADR-336): κείμενο που τυπώνεται — όνομα και επώνυμο υποχρεωτικά. */
const signatorySchema: z.ZodType<SignatoryFieldSet> = z.object({
  firstName: label.min(1),
  lastName: label.min(1),
  role: optionalLabel,
  profession: optionalLabel,
  escoUri: optionalLabel,
  escoLabel: optionalLabel,
  iscoCode: optionalLabel,
  mobile: optionalLabel,
  email: optionalLabel,
  vatNumber: optionalLabel,
});

const clauseSelectionInputSchema: z.ZodType<ClauseSelectionInput> = z.object({
  clauseKey: id,
  version: z.number().int().min(1),
  parameterValues: z.record(id, clauseParameterValueSchema),
  deviationReasons: z.record(id, z.string().min(1).max(SUBCONTRACT_LIMITS.maxReasonLength)),
});

export const agreementDraftInputSchema: z.ZodType<SubcontractAgreementDraftInput> = z.object({
  documentMode: z.enum(AGREEMENT_DOCUMENT_MODES),
  origin: originSchema,
  trade: z.enum(TRADE_CODES),
  templateId: id.nullable(),
  title: localizedTextSchema,
  scope: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('single_project'), projectId: id, buildingIds: ids }),
    z.object({ kind: z.literal('multi_project') }),
  ]),
  subcontractorContactId: id,
  projectOwners: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({ kind: z.literal('collective') }),
    z.object({ kind: z.literal('named'), contactIds: ids }),
  ]),
  issuerSignatory: signatorySchema.nullable(),
  lines: z.array(agreementLineSchema).max(SUBCONTRACT_LIMITS.maxLines),
  terms: commercialTermsSchema,
  clauses: z.array(clauseSelectionInputSchema).max(SUBCONTRACT_LIMITS.maxClauseRefs),
  languages: z.object({ secondary: z.string().max(8).nullable() }),
  validUntil: calendarDaySchema.nullable(),
});

export const createAgreementBodySchema = z.object({ draft: agreementDraftInputSchema });

export const updateAgreementBodySchema = z.object({ expectedRevision: expectedRevisionSchema, draft: agreementDraftInputSchema });

export const transitionAgreementBodySchema = z.object({ expectedRevision: expectedRevisionSchema, mobilizedOn: calendarDaySchema.nullable().default(null) });

export const addAssignmentBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  projectId: id,
  buildingIds: ids,
  startDate: calendarDaySchema.nullable(),
  durationDays: z.number().int().min(1).nullable(),
  note: reasonSchema,
});

export const decideDeviationBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  clauseKey: id,
  parameterKey: id,
  decision: z.enum(['approved', 'rejected']),
  reason: reasonSchema,
});
