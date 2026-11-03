/**
 * @fileoverview Τα zod **σχήματα** των σωμάτων αιτήματος της βιβλιοθήκης ρητρών (ADR-928 Φ1).
 * @module subapps/procurement/subcontracts/schema/clause.schema
 *
 * 🔑 Ρόλοι χωρισμένοι, όπως στον κατάλογο (ADR-923 §5.9): το zod κρίνει **σχήμα και μέγεθος** (το σώμα δεν είναι
 * χώρος για 10 MB κειμένου)· τη **σημασιολογία** (ζώνες, ορφανές παράμετροι, άθροισμα μεριδίων) την κρίνουν οι
 * επικυρωτές του τομέα, που καλούνται και από τη σπορά και από την οθόνη. Κάθε σχήμα δηλώνει τον τύπο που παράγει
 * (`z.ZodType<…>`), άρα σχήμα και τύπος δεν αποκλίνουν σιωπηλά.
 */

import { z } from 'zod';
import { ISO_WEEKDAYS, type IsoWeekday } from '@/lib/calendar/weekly-hours';
import { isCalendarDay } from '@/lib/date/calendar-day';
import { isUomCode, type UomCode } from '@/lib/uom/uom-registry';
import { CLAUSE_TEXT_PARAMETER_MAX_LENGTH } from '../clauses/validate-clause-parameter';
import {
  CLAUSE_TRANSLATION_ORIGINS,
  type ClauseBlock,
  type ClauseBody,
  type ClauseInline,
} from '../types/clause';
import {
  CLAUSE_PARAMETER_KINDS,
  CLAUSE_PARTIES,
  COMMERCIAL_TERM_BINDING_KEYS,
  type ClauseParameterDefinition,
  type ClauseParameterTolerance,
  type ClauseParameterValue,
  type LocalizedText,
} from '../types/clause-parameter';

/** Τα όρια μεγέθους των σωμάτων — ένας πίνακας, κανένας δεύτερος αριθμός στα σχήματα. */
export const SUBCONTRACT_LIMITS = {
  maxKeyLength: 120,
  maxLabelLength: 300,
  maxInlineTextLength: 4000,
  maxInlinesPerRun: 200,
  maxBlocks: 100,
  maxListItems: 100,
  maxParameters: 30,
  maxOptions: 30,
  maxReasonLength: 2000,
  maxLines: 200,
  maxStages: 20,
  maxClauseRefs: 100,
} as const;

const key = z.string().min(1).max(SUBCONTRACT_LIMITS.maxKeyLength);
const integer = z.number().int();

export const expectedRevisionSchema = z.number().int().min(1);
export const reasonSchema = z.string().max(SUBCONTRACT_LIMITS.maxReasonLength).nullable();
export const calendarDaySchema = z.string().refine(isCalendarDay);

export const localizedTextSchema: z.ZodType<LocalizedText> = z.record(z.string(), z.string().max(SUBCONTRACT_LIMITS.maxInlineTextLength));
export const uomCodeSchema = z.custom<UomCode>((value) => typeof value === 'string' && isUomCode(value));
export const weekdaySchema = z.custom<IsoWeekday>((value) => ISO_WEEKDAYS.some((day) => day === value));

const inlineSchema: z.ZodType<ClauseInline> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().max(SUBCONTRACT_LIMITS.maxInlineTextLength) }),
  z.object({ kind: z.literal('param'), key }),
]);
const runSchema = z.array(inlineSchema).max(SUBCONTRACT_LIMITS.maxInlinesPerRun);

export const clauseBlockSchema: z.ZodType<ClauseBlock> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('paragraph'), inlines: runSchema }),
  z.object({ kind: z.literal('list'), ordered: z.boolean(), items: z.array(runSchema).max(SUBCONTRACT_LIMITS.maxListItems) }),
]);
export const clauseBlocksSchema = z.array(clauseBlockSchema).max(SUBCONTRACT_LIMITS.maxBlocks);

export const clauseBodySchema: z.ZodType<ClauseBody> = z.object({
  heading: z.string().max(SUBCONTRACT_LIMITS.maxLabelLength),
  blocks: clauseBlocksSchema,
});

export const clauseParameterValueSchema: z.ZodType<ClauseParameterValue> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('percent'), value: integer }),
  z.object({ kind: z.literal('money'), value: integer }),
  z.object({ kind: z.literal('days'), value: integer }),
  z.object({ kind: z.literal('ratio'), value: z.array(integer).max(SUBCONTRACT_LIMITS.maxOptions) }),
  z.object({ kind: z.literal('weekday'), value: weekdaySchema }),
  z.object({ kind: z.literal('milestone'), value: key }),
  z.object({ kind: z.literal('unit'), value: uomCodeSchema }),
  z.object({ kind: z.literal('enum'), value: key }),
  z.object({ kind: z.literal('party'), value: z.enum(CLAUSE_PARTIES) }),
  z.object({ kind: z.literal('text'), value: z.string().max(CLAUSE_TEXT_PARAMETER_MAX_LENGTH) }),
]);

const rangeSchema = z.object({ min: integer.nullable(), max: integer.nullable() });
const keyListSchema = z.array(key).max(SUBCONTRACT_LIMITS.maxOptions);

const toleranceSchema: z.ZodType<ClauseParameterTolerance> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('numeric'), acceptable: rangeSchema, walkAway: rangeSchema }),
  z.object({ kind: z.literal('options'), acceptable: keyListSchema, forbidden: keyListSchema }),
  z.object({ kind: z.literal('fixed') }),
]);

const keyedLabelsSchema = z.array(z.object({ key, label: localizedTextSchema })).max(SUBCONTRACT_LIMITS.maxOptions);

export const clauseParameterDefinitionSchema: z.ZodType<ClauseParameterDefinition> = z.object({
  key,
  kind: z.enum(CLAUSE_PARAMETER_KINDS),
  label: localizedTextSchema,
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('clause') }),
    z.object({ kind: z.literal('term'), term: z.enum(COMMERCIAL_TERM_BINDING_KEYS) }),
  ]),
  preferred: clauseParameterValueSchema,
  tolerance: toleranceSchema.nullable(),
  terms: keyedLabelsSchema.optional(),
  options: keyedLabelsSchema.optional(),
});

const parametersSchema = z.array(clauseParameterDefinitionSchema).max(SUBCONTRACT_LIMITS.maxParameters);

// ── Σώματα αιτήματος ────────────────────────────────────────────────────────

export const createClauseBodySchema = z.object({
  clauseKey: key,
  title: localizedTextSchema,
  body: clauseBodySchema,
  parameters: parametersSchema,
  proposalReason: reasonSchema,
});

export const proposeClauseVersionBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  body: clauseBodySchema,
  parameters: parametersSchema,
  proposalReason: reasonSchema,
});

export const approveClauseVersionBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  effectiveFrom: calendarDaySchema.nullable(),
  reason: reasonSchema,
});

export const decideClauseVersionBodySchema = z.object({ expectedRevision: expectedRevisionSchema, reason: reasonSchema });

export const revisionOnlyBodySchema = z.object({ expectedRevision: expectedRevisionSchema });

export const archiveBodySchema = z.object({ expectedRevision: expectedRevisionSchema, archived: z.boolean() });

export const proposeTranslationBodySchema = z.object({
  expectedRevision: expectedRevisionSchema,
  language: z.string().min(2).max(8),
  body: clauseBodySchema,
  origin: z.enum(CLAUSE_TRANSLATION_ORIGINS),
});
