/**
 * POST /api/subcontracts/agreements/[id]/assignments — **ανάθεση εργοταξίου** σε συμφωνητικό πολλών έργων (ADR-928
 * §5.4 Δ2): χωρίς νέο έγγραφο, με στιγμιότυπο έργου. Μόνο σε `accepted` / `in_execution`.
 * Auth: `subcontracts:agreements:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { addSubcontractAgreementAssignment } from '@/server/subcontracts/agreement-writer.server';
import { addAssignmentBodySchema } from '@/subapps/procurement/subcontracts/schema/agreement.schema';
import { subcontractCreateRoute, type AgreementParams } from '../../../_shared/subcontract-route';

export const POST = subcontractCreateRoute<typeof addAssignmentBodySchema, AgreementParams, unknown>(
  { category: 'STANDARD', authority: 'agreements' },
  addAssignmentBodySchema,
  (auth, body, params) => addSubcontractAgreementAssignment(auth, params.id, body),
);
