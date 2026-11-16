import 'server-only';

/**
 * @fileoverview **ΤΟ ΜΗΤΡΩΟ «άνοιγμα αρχείου μέσω συμμετοχής»** — ένας προσαρμογέας ανά είδος υπόθεσης, ολικός πίνακας (ADR-942 Φ2).
 * @related engaged-file-opening.server.ts (ο κοινός πυρήνας) · request-adapters.ts (το ίδιο σχήμα για τα αιτήματα)
 * @module server/engagement-files/engaged-file-openers
 *
 * 🔑 Τρίτο είδος υπόθεσης **δεν μεταγλωττίζεται** μέχρι να δηλώσει εδώ τι ανοίγει ο επαγγελματίας του. Η πόρτα
 *    `api/engagements/[id]/files/[fileId]` ρωτά **μόνο** αυτό το αρχείο.
 * 🔑 Η μεταβίβαση περνά **αυτούσια** (`openCaseFile`): ο κατάλογος του θεατή της δεν αλλάζει.
 * 🔑 Η δρομολόγηση γίνεται από το είδος της **δικής του** συμμετοχής, ποτέ από το αίτημα· ξένη ≡ ανύπαρκτη (404).
 * ⚠️ **Συνάρτηση, όχι σταθερά module** (CHECK 3.80).
 */

import type { Firestore } from 'firebase-admin/firestore';

import { listEngagementsOfUser } from '@/lib/auth/engagement-read';
import { openCaseFile } from '@/services/conveyance/conveyance-case-file-access.service';
import { openIssuanceFile } from '@/services/document-registry/issuance-file-access.service';
import {
  isConveyanceEngagement,
  isIssuanceEngagement,
  type EngagementOfKind,
  type EngagementSubjectKind,
} from '@/types/engagement';
import type { EngagedFileOpening, EngagedFileRequest } from './engaged-file-opening.server';

type EngagedFileOpener<K extends EngagementSubjectKind> = (db: Firestore, engagement: EngagementOfKind<K>, request: EngagedFileRequest) => Promise<EngagedFileOpening>;

/** Μεταβίβαση: ακριβώς η διαδρομή πριν τη Φ2 (η υπόθεση ξαναλύνεται από τη δική της πόρτα πρόσβασης). */
function openAsConveyance(db: Firestore, _engagement: EngagementOfKind<'conveyance_case'>, request: EngagedFileRequest): Promise<EngagedFileOpening> {
  return openCaseFile(db, request);
}

/** Ολικός: κάθε είδος υπόθεσης δηλώνει τι ανοίγει ο επαγγελματίας του. */
function fileOpeners(): { readonly [K in EngagementSubjectKind]: EngagedFileOpener<K> } {
  return { conveyance_case: openAsConveyance, document_issuance: openIssuanceFile };
}

/** Ο επαγγελματίας ανοίγει/κατεβάζει ένα αρχείο **μέσω της δικής του** συμμετοχής. */
export async function openFileAsEngaged(db: Firestore, request: EngagedFileRequest): Promise<EngagedFileOpening> {
  const list = await listEngagementsOfUser(db, request.uid);
  if (list.outcome === 'unknown') return { ok: false, rejection: 'unknown' };
  const engagement = list.engagements.find((e) => e.id === request.engagementId);
  if (engagement === undefined) return { ok: false, rejection: 'not-found' };
  const openers = fileOpeners();
  if (isIssuanceEngagement(engagement)) return openers.document_issuance(db, engagement, request);
  if (isConveyanceEngagement(engagement)) return openers.conveyance_case(db, engagement, request);
  return { ok: false, rejection: 'not-found' };
}
