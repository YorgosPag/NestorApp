/**
 * @fileoverview **Ο ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ** — γραφείο και ιδιοκτήτης ρωτούν τον ίδιο (ADR-864 §18.4 Δ2).
 * @related lib/mandate/private-marketing-panel.ts · services/mandate/private-marketing-actor.ts ·
 *   app/api/owner-properties/[ownerPropertyId]/private-marketing/route.ts
 * @module services/mandate/private-marketing-panel.service
 *
 * 🔑 **Εξουσιοδότηση = η ίδια εύρεση εντολής με τον γραφέα** (`mandatesVisibleTo`, Α28): ο ιδιοκτήτης
 * βλέπει **όλες** τις εντολές πάνω στη **δική του** προσωπική καταχώρηση· κάθε άλλος βλέπει **μόνο** τη
 * δική του. Καμία εντολή ⇒ `absent` — ίδιο σώμα με το ανύπαρκτο, ώστε ο αναγνώστης να μη γίνει μαντείο.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { latestLegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { consentValuesFor } from '@/lib/mandate/private-marketing-consent-text';
import { nextRequestAtOf } from '@/lib/mandate/private-marketing-standing';
import { evidencesOfMandate, evidenceViewOf, type EvidenceRetentionView } from '@/lib/mandate/mandate-evidence';
import {
  privateMarketingStandingViewOf,
  type PrivateMarketingPanel,
  type PrivateMarketingPanels,
} from '@/lib/mandate/private-marketing-panel';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import { retainUntilByEvidenceOf } from '@/services/mandate/evidence-registry';
import { consentActorOfProperty, mandatesVisibleTo } from '@/services/mandate/private-marketing-actor';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';
import { PRIVATE_MARKETING_DOCUMENT } from '@/types/private-marketing-consent';

type PrivateMarketingPanelsRead =
  | ({ readonly kind: 'found' } & PrivateMarketingPanels)
  | { readonly kind: 'absent' };

/**
 * **Μία εντολή → ένα πάνελ** — οι τιμές θέσεων λύνονται **εδώ** (Α25). Τον καλεί και το `/mandate/[token]`,
 * ώστε ο σύνδεσμος και οι δύο οθόνες λογαριασμού να δείχνουν **το ίδιο** κείμενο με τις **ίδιες** τιμές.
 */
function privateMarketingPanelOf(mandate: BrokeredListingMandate, agencyName: string, nowISOValue: string, retainUntilById: ReadonlyMap<string, EvidenceRetentionView>): PrivateMarketingPanel {
  return {
    agencyCompanyId: mandate.agencyCompanyId,
    agencyName,
    standing: privateMarketingStandingViewOf(mandate),
    values: consentValuesFor(agencyName, mandate.expiresAt),
    nextRequestAt: nextRequestAtOf(mandate, nowISOValue),
    evidence: evidencesOfMandate(mandate).map((evidence) => evidenceViewOf(evidence, retainUntilById)),
  };
}

export async function readPrivateMarketingPanels(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  actor: ListingActor,
  nowISOValue: string,
): Promise<PrivateMarketingPanelsRead> {
  const snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(ownerPropertyId).get();
  const property = ownerPropertyFromDocument(snapshot.data(), ownerPropertyId);
  if (property === null) return { kind: 'absent' };

  const who = consentActorOfProperty(property, actor);
  const mandates = mandatesVisibleTo(property, who, nowISOValue);
  if (mandates.length === 0) return { kind: 'absent' };

  const retainUntilById = await retainUntilByEvidenceOf(adminDb, ownerPropertyId);
  const panels = await Promise.all(
    mandates.map(async (mandate) =>
      privateMarketingPanelOf(mandate, (await readCompanyPublicName(adminDb, mandate.agencyCompanyId)) ?? '', nowISOValue, retainUntilById),
    ),
  );
  const disclosure = latestLegalDocumentVersion(PRIVATE_MARKETING_DOCUMENT);

  return {
    kind: 'found',
    viewer: who.kind === 'owner-account' ? 'owner' : 'agency',
    marketingAudience: property.marketingAudience,
    disclosure: disclosure.kind === 'published' ? disclosure.version : null,
    panels,
  };
}
