/**
 * POST /api/subcontracts/agreements/[id]/deviations/decide — **απόφαση απόκλισης** ενός εγγράφου από τις ζώνες της
 * εταιρείας (ADR-928 §5.2.1 τρόπος 3): `approved` ή `rejected`. Όποιος τη ζήτησε δεν την αποφασίζει (403
 * `selfApproval`). Η απόρριψη αφήνει την απόκλιση και την έκδοση μπλοκαρισμένη, ώσπου ο συντάκτης να αλλάξει την τιμή.
 * Auth: `subcontracts:agreements:approve_deviation` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { decideSubcontractAgreementDeviation } from '@/server/subcontracts/agreement-deviation-writer.server';
import { decideDeviationBodySchema } from '@/subapps/procurement/subcontracts/schema/agreement.schema';
import { subcontractWriteRoute, type AgreementParams } from '../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof decideDeviationBodySchema, AgreementParams, unknown>(
  { category: 'STANDARD', authority: 'approveDeviation' },
  decideDeviationBodySchema,
  (auth, body, params) => decideSubcontractAgreementDeviation(auth, params.id, body),
);
