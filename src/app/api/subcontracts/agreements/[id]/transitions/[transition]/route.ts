/**
 * POST /api/subcontracts/agreements/[id]/transitions/[transition] — **μετάβαση κύκλου ζωής** (ADR-928 §5.5):
 * `issue` (παγώνει αναθεώρηση) · `accept` (Τρόπος Β: γεννά συμφωνητικό) · `mobilize` · `complete` · `discard` ·
 * `withdraw` · `expire` · `terminate`. Άγνωστη μετάβαση ⇒ 400· μη επιτρεπτή ⇒ 409 με το είδος.
 * Auth: `subcontracts:agreements:manage` · Rate: standard · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { transitionSubcontractAgreement } from '@/server/subcontracts/agreement-lifecycle-writer.server';
import { transitionAgreementBodySchema } from '@/subapps/procurement/subcontracts/schema/agreement.schema';
import { agreementTransitionOf, subcontractWriteRoute, type AgreementTransitionParams } from '../../../../_shared/subcontract-route';

export const POST = subcontractWriteRoute<typeof transitionAgreementBodySchema, AgreementTransitionParams, unknown>(
  { category: 'STANDARD', authority: 'agreements' },
  transitionAgreementBodySchema,
  (auth, body, params) =>
    transitionSubcontractAgreement(auth, params.id, agreementTransitionOf(params.transition), {
      expectedRevision: body.expectedRevision,
      mobilizedOn: body.mobilizedOn,
    }),
);
