/**
 * @fileoverview **Το σχήμα του αιτήματος αλλαγής σταδίου** — κοινό για route και πελάτη (ADR-929).
 * @module services/crm/opportunity-stage-schema
 *
 * `POST /api/opportunities/[id]/stage` — `{ expectedStage, request }`. Το `expectedStage` είναι το στάδιο που
 * **είδε** ο άνθρωπος· διαφορετικό από το αποθηκευμένο ⇒ 409 (κάποιος άλλος τη μετακίνησε στο μεταξύ).
 * Τα όρια ζουν στους καταλόγους (`opportunity-stages`, `opportunity-lost-reasons`) — εδώ μόνο δένονται.
 */

import { z } from 'zod';

import { OPPORTUNITY_STAGE_IDS, type OpportunityStage } from '@/config/crm/opportunity-stages';
import { LOST_REASON_NOTE_MAX, OPPORTUNITY_LOST_REASONS } from '@/config/crm/opportunity-lost-reasons';
import type { StageTransitionRequest } from './opportunity-stage-transition';

const stageSchema = z.enum(OPPORTUNITY_STAGE_IDS);

const transitionRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('open'), target: stageSchema }),
  z.object({
    kind: z.literal('won'),
    finalValue: z.number().positive().max(999_999_999),
    closedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    kind: z.literal('lost'),
    lostReason: z.enum(OPPORTUNITY_LOST_REASONS),
    lostReasonNote: z.string().max(LOST_REASON_NOTE_MAX).optional(),
  }),
]);

export const opportunityStageBody = z.object({
  expectedStage: stageSchema,
  request: transitionRequestSchema,
});

export type OpportunityStageBody = z.infer<typeof opportunityStageBody>;

/** Ο τύπος του σχήματος ΕΙΝΑΙ ο τύπος του πυρήνα — αν αποκλίνουν, σπάει η μεταγλώττιση εδώ. */
const _requestShapeMatchesCore: (body: OpportunityStageBody['request']) => StageTransitionRequest = (body) => body;
void _requestShapeMatchesCore;

/** Η απάντηση του route. */
export type OpportunityStageResponse =
  | { readonly outcome: 'unchanged'; readonly stage: OpportunityStage }
  | { readonly outcome: 'applied'; readonly stage: OpportunityStage; readonly previousStage: OpportunityStage; readonly reopened: boolean };

/** Οι λεπτομέρειες του 409. */
export interface OpportunityStageConflict {
  readonly currentStage: string | null;
  readonly updatedBy: string | null;
}
