/**
 * POST /api/subcontracts/agreements — νέα **προσφορά υπεργολάβου** σε πρόχειρο (ADR-928 §5.4 · Φ2). Ο πελάτης στέλνει
 * ids· μέρη και έργο τα λύνει ο διακομιστής· αριθμός εγγράφου από τον μετρητή του χώρου.
 * Auth: `subcontracts:agreements:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { createSubcontractAgreement } from '@/server/subcontracts/agreement-writer.server';
import { createAgreementBodySchema } from '@/subapps/procurement/subcontracts/schema/agreement.schema';
import { subcontractCreateRoute } from '../_shared/subcontract-route';

export const POST = subcontractCreateRoute({ category: 'STANDARD', authority: 'agreements' }, createAgreementBodySchema, (auth, body) =>
  createSubcontractAgreement(auth, body.draft),
);
