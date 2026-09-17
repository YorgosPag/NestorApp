/**
 * @fileoverview **ΣΩΜΑ → ΥΠΗΡΕΣΙΑ** για τις πράξεις κλειστής διάθεσης με λογαριασμό (ADR-864 Φ3).
 * @related app/api/owner-properties/[ownerPropertyId]/route.ts · services/mandate/private-marketing-consent.service.ts
 * @module app/api/owner-properties/_shared/private-marketing-dispatch
 *
 * 🔑 **Η ταυτότητα του δρώντος ΔΕΝ έρχεται από το σώμα**: ο `ListingActor` είναι της συνεδρίας· το
 * σώμα λέει μόνο **τι** ζητείται. Το «γραφείο» και ο «ιδιοκτήτης» ξεχωρίζουν από την **πράξη**, και η
 * υπηρεσία επαληθεύει ότι ο δρων **είναι** αυτό που η πράξη προϋποθέτει (`locateMandate`).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { nowISO } from '@/lib/date-local';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import {
  grantPrivateMarketing,
  requestPrivateMarketing,
  revokePrivateMarketing,
  type PrivateMarketingOutcome,
} from '@/services/mandate/private-marketing-consent.service';

import type { AccountPrivateMarketingBody } from '@/lib/mandate/private-marketing-request-body';

export async function dispatchAccountPrivateMarketing(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  body: AccountPrivateMarketingBody,
  actor: ListingActor,
): Promise<PrivateMarketingOutcome> {
  const now = nowISO();
  switch (body.action) {
    case 'request':
      return requestPrivateMarketing(adminDb, { ownerPropertyId, actor, audience: body.audience, nowISO: now });
    case 'grant':
      return grantPrivateMarketing(adminDb, {
        ownerPropertyId,
        who: { kind: 'owner-account', actor },
        lines: body.consents,
        audience: body.audience,
        nowISO: now,
      });
    case 'attest':
      return grantPrivateMarketing(adminDb, {
        ownerPropertyId,
        who: { kind: 'agency', actor },
        line: { agencyCompanyId: null, requestId: body.requestId, submission: body.submission },
        documentFileId: body.documentFileId,
        audience: body.audience,
        nowISO: now,
      });
    case 'revoke':
      return revokePrivateMarketing(adminDb, {
        ownerPropertyId,
        who: { kind: 'owner-account', actor },
        agencyCompanyId: body.agencyCompanyId,
        outcome: body.outcome,
        nowISO: now,
      });
  }
}
