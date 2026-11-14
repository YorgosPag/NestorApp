/**
 * @fileoverview ADR-915 §27 — **οι αναθέσεις έκδοσης των γραμμών του μητρώου**: μία ανάγνωση του καταλόγου, μόνο όταν
 *   κάποια γραμμή δείχνει «Ανάθεση»· η συναρμολόγηση είναι καθαρή (`issuanceOfRows`).
 * @related issuance-assignments.server.ts (ο κατάλογος) · lib/document-validity/issuance-rows.ts (η συναρμολόγηση)
 * @module services/document-registry/registry-issuance.server
 *
 * 🔑 **Αποτυχία ⇒ `known: false`, ποτέ πτώση του μητρώου**: η οθόνη τότε **δεν** ισχυρίζεται «καμία ανάθεση» — κρύβει
 *    την ανάθεση και αφήνει το «Βρες». Ένα κενό που μοιάζει με «δεν ανατέθηκε» θα οδηγούσε σε δεύτερο ΠΕΑ.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import type { RegistryRow } from '@/lib/document-validity/document-registry';
import { issuanceKeyOf } from '@/lib/document-validity/issuance-assignment';
import { assignableTargets, issuanceOfRows, type RowIssuance } from '@/lib/document-validity/issuance-rows';
import { issuanceSpaceStatusOf, type IssuanceSpaceStatus } from '@/lib/document-validity/issuance-space';
import { latestIssuanceSpaceInvitations } from '@/server/engagement-invitations/engagement-invitation-issue';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { readIssuanceRoster } from './issuance-assignments.server';

const logger = createModuleLogger('registry-issuance');

export interface RegistryIssuanceReading {
  readonly issuance: Readonly<Record<string, RowIssuance>>;
  /** `false` = ο κατάλογος αναθέσεων δεν διαβάστηκε — η οθόνη δεν ισχυρίζεται τίποτα. */
  readonly known: boolean;
  readonly truncated: boolean;
  /** Οι επαφές που θα ονομάσει η οθόνη (επαγγελματίες · υποψήφιοι) — διαβάζονται μαζί με τους ιδιοκτήτες. */
  readonly contactIds: readonly string[];
  /** §39 — ο χώρος κάθε ανάθεσης (κλειδί `issuanceKeyOf`). `null` = δεν διαβάστηκε ⇒ η οθόνη δεν ισχυρίζεται τίποτα. */
  readonly spaces: Readonly<Record<string, IssuanceSpaceStatus>> | null;
}

const NOTHING: RegistryIssuanceReading = { issuance: {}, known: true, truncated: false, contactIds: [], spaces: {} };

/** **Οι αναθέσεις του μητρώου** — μία ανάγνωση του καταλόγου, μόνο όταν κάποια γραμμή δείχνει «Ανάθεση». */
export async function readRegistryIssuance(db: Firestore, companyId: string, rows: readonly RegistryRow[], now: Date): Promise<RegistryIssuanceReading> {
  if (assignableTargets(rows).size === 0) return NOTHING;
  try {
    const [roster, spaces] = await Promise.all([readIssuanceRoster(db, companyId), readIssuanceSpaces(db, companyId, now)]);
    return { ...issuanceOfRows(rows, roster.entries), known: true, truncated: roster.truncated, spaces };
  } catch (error) {
    logger.warn('Οι αναθέσεις έκδοσης δεν διαβάστηκαν — η οθόνη κρύβει την «Ανάθεση»', {
      data: { companyId, error: getErrorMessage(error, 'unknown') },
    });
    return { issuance: {}, known: false, truncated: false, contactIds: [], spaces: null };
  }
}

/**
 * §39 — ο χώρος κάθε ανάθεσης, **παραγόμενος** από την πιο πρόσφατη πρόσκληση σε λογαριασμό (`issuanceSpaceStatusOf`).
 * Αποτυχία ή όριο ⇒ `null`: «δεν ξέρω», ποτέ ψεύτικο «δεν στάλθηκε» (θα έσπρωχνε σε άσκοπη επαναποστολή).
 */
async function readIssuanceSpaces(db: Firestore, companyId: string, now: Date): Promise<Readonly<Record<string, IssuanceSpaceStatus>> | null> {
  try {
    const { byAssignment, truncated } = await latestIssuanceSpaceInvitations(db, companyId, now.toISOString());
    if (truncated) {
      logger.warn('Οι προσκλήσεις χώρου χτύπησαν το όριο — η κάρτα δεν ισχυρίζεται κατάσταση χώρου', { data: { companyId } });
      return null;
    }
    return Object.fromEntries([...byAssignment.values()].map((summary) => [
      issuanceKeyOf(summary.propertyId, summary.documentKind),
      issuanceSpaceStatusOf(summary),
    ]));
  } catch (error) {
    logger.warn('Οι προσκλήσεις χώρου δεν διαβάστηκαν', { data: { companyId, error: getErrorMessage(error, 'unknown') } });
    return null;
  }
}
