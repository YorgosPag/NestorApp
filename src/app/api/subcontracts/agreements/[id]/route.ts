/**
 * PATCH /api/subcontracts/agreements/[id] — αποθήκευση **πρόχειρου** (ADR-928 Φ2): CAS, μόνο σε `draft`. Οι αποκλίσεις
 * ξανακρίνονται· η απόφαση μένει μόνο όπου η τιμή δεν άλλαξε.
 * Auth: `subcontracts:agreements:manage` (στο έργο, αν το πρόχειρο μένει στο ίδιο έργο — ADR-928 §5.15) · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { projectOfAgreementEdit } from '@/server/subcontracts/agreement-resource.server';
import { updateSubcontractAgreementDraft } from '@/server/subcontracts/agreement-writer.server';
import { updateAgreementBodySchema } from '@/subapps/procurement/subcontracts/schema/agreement.schema';
import { subcontractWriteRoute, type AgreementParams } from '../../_shared/subcontract-route';

export const PATCH = subcontractWriteRoute<typeof updateAgreementBodySchema, AgreementParams, unknown>(
  { category: 'STANDARD', authority: 'agreements', resource: projectOfAgreementEdit },
  updateAgreementBodySchema,
  (auth, body, params) => updateSubcontractAgreementDraft(auth, params.id, body.expectedRevision, body.draft),
);
