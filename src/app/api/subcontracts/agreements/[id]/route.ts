/**
 * PATCH /api/subcontracts/agreements/[id] — αποθήκευση **πρόχειρου** (ADR-928 Φ2): CAS, μόνο σε `draft`. Οι αποκλίσεις
 * ξανακρίνονται· η απόφαση μένει μόνο όπου η τιμή δεν άλλαξε.
 * Auth: `subcontracts:agreements:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { updateSubcontractAgreementDraft } from '@/server/subcontracts/agreement-writer.server';
import { updateAgreementBodySchema } from '@/subapps/procurement/subcontracts/schema/agreement.schema';
import { subcontractWriteRoute, type AgreementParams } from '../../_shared/subcontract-route';

export const PATCH = subcontractWriteRoute<typeof updateAgreementBodySchema, AgreementParams, unknown>(
  { category: 'STANDARD', authority: 'agreements' },
  updateAgreementBodySchema,
  (auth, body, params) => updateSubcontractAgreementDraft(auth, params.id, body.expectedRevision, body.draft),
);
