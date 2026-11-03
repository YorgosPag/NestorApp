/**
 * POST …/versions/[version]/translations/[language]/approve — **έγκριση μετάφρασης** (ADR-928 §5.2.2). Μπαγιάτικη
 * (άλλο `sourceHash`) ⇒ 409· ο μεταφραστής δεν εγκρίνει τον εαυτό του ⇒ 403.
 * Auth: `subcontracts:clauses:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { approveSubcontractClauseTranslation } from '@/server/subcontracts/clause-translation-writer.server';
import { revisionOnlyBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute, versionTargetOf, type ClauseVersionParams } from '../../../../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof revisionOnlyBodySchema, ClauseVersionParams & { language: string }, unknown>(
  { category: 'STANDARD', authority: 'manage' },
  revisionOnlyBodySchema,
  (auth, body, params) => approveSubcontractClauseTranslation(auth, versionTargetOf(params, body.expectedRevision), params.language),
);
