/**
 * POST …/clauses/[id]/versions/[version]/translations — **πρόχειρη μετάφραση** έκδοσης (ADR-928 §5.2.2). Ίδιο σύνολο
 * παραμέτρων με το ελληνικό, πάνω στο τρέχον `sourceHash`. Auth: `subcontracts:clauses:propose` · Rate: standard ·
 * ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { proposeSubcontractClauseTranslation } from '@/server/subcontracts/clause-translation-writer.server';
import { proposeTranslationBodySchema } from '@/subapps/procurement/subcontracts/schema/clause.schema';
import { subcontractWriteRoute, versionTargetOf, type ClauseVersionParams } from '../../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof proposeTranslationBodySchema, ClauseVersionParams, unknown>(
  { category: 'STANDARD', authority: 'propose' },
  proposeTranslationBodySchema,
  (auth, body, params) =>
    proposeSubcontractClauseTranslation(auth, versionTargetOf(params, body.expectedRevision), { language: body.language, body: body.body, origin: body.origin }),
);
