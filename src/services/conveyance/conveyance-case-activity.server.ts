/**
 * =============================================================================
 * Το ίχνος της υπόθεσης για τον ΕΠΑΓΓΕΛΜΑΤΙΑ — ο αναγνώστης (ADR-901 Φ4 §5.9)
 * =============================================================================
 *
 * Ο επαγγελματίας **δεν** είναι μέλος του χώρου του οικοδεσπότη, άρα οι κανόνες και το
 * `/api/audit-trail` τον αρνούνται, και σωστά. Εδώ το βιβλίο διαβάζεται με Admin SDK **μόνο** μέσα από την
 * κρινόμενη συμμετοχή του (`resolveEngagedCase`), και φεύγει **μόνο** η προβολή `projectCaseActivity`, δηλαδή
 * ποτέ ωμή εγγραφή, όνομα ή email άλλου.
 *
 * Η ανάγνωση γίνεται **μόνο** μέσω του SSoT του ίχνους (`EntityAuditService.readCompanyEntityEntries`), πάνω
 * στον **υπάρχοντα** δείκτη `(entityType, entityId, companyId, timestamp)`.
 *
 * @module services/conveyance/conveyance-case-activity.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { projectCaseActivity } from '@/lib/conveyance/case-activity';
import type { CaseActivityItem } from '@/types/conveyance-case';
import { EntityAuditService } from '@/services/entity-audit.service';
import { resolveEngagedCase, type EngagedCaseResolution } from './conveyance-engagement-access.service';

/** Πόσες πρόσφατες εγγραφές ανά οντότητα διαβάζονται — η σελίδα δείχνει τις νεότερες. */
const ACTIVITY_PAGE = 100;

export type CaseActivityOutcome =
  | { readonly ok: true; readonly items: readonly CaseActivityItem[] }
  | Extract<EngagedCaseResolution, { ok: false }>;

/** Η προβολή του ίχνους για τον επαγγελματία: οι δικές του ενέργειες + όσοι άνοιξαν τα δικά του αρχεία. */
export async function getCaseActivity(db: Firestore, uid: string, engagementId: string, nowMs: number): Promise<CaseActivityOutcome> {
  const resolution = await resolveEngagedCase(db, uid, engagementId, nowMs);
  if (!resolution.ok) return resolution;
  const { engagement, record } = resolution.access;
  const [caseEntries, engagementEntries] = await Promise.all([
    EntityAuditService.readCompanyEntityEntries({ companyId: record.companyId, entityType: 'conveyance_case', entityId: record.id, limit: ACTIVITY_PAGE }),
    EntityAuditService.readCompanyEntityEntries({ companyId: record.companyId, entityType: 'engagement', entityId: engagement.id, limit: ACTIVITY_PAGE }),
  ]);
  if (caseEntries === null || engagementEntries === null) return { ok: false, rejection: 'unknown' };
  // Φ4.4: τα αρχεία που **έγραψε** ο ίδιος (συνεισφορές) — ως τότε κανένα.
  const ownFileIds = new Set<string>();
  return { ok: true, items: projectCaseActivity([...caseEntries, ...engagementEntries], { uid, ownFileIds }) };
}
