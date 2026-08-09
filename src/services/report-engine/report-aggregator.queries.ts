/**
 * Report Aggregator Queries — the shared Firestore reads of the report engine.
 *
 * The sibling `report-aggregator.helpers` declares itself "no Firestore calls,
 * no side effects" and keeps that promise; this module is its counterpart, and
 * the only reason it exists separately: a read that more than one report needs
 * belongs in ONE place, tenant filter included.
 *
 * Server-only — every function here talks to the Admin SDK.
 *
 * @module services/report-engine/report-aggregator.queries
 * @see ADR-265 (Enterprise Reports System)
 */

import 'server-only';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ReportFilter, UnitDoc } from './report-aggregator.types';

/**
 * Every unit of one company, as raw docs.
 *
 * The two reports that need the whole unit collection on its own (sales,
 * financial) asked for it with the same four lines; CHECK 3.28 measured them
 * as one clone. Keeping the read here means the tenant filter cannot be
 * forgotten by a report written later — the shape CHECK 3.35 exists to catch.
 */
export async function fetchCompanyUnits(filter: ReportFilter): Promise<UnitDoc[]> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.PROPERTIES)
    .where('companyId', '==', filter.companyId)
    .get();
  return snap.docs.map(d => d.data() as UnitDoc);
}
