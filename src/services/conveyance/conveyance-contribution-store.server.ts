/**
 * =============================================================================
 * Τα transmittals μιας υπόθεσης — ο ΕΝΑΣ αναγνώστης (ADR-901 Φ4.4)
 * =============================================================================
 *
 * Μία ανάγνωση για τρεις καταναλωτές: τα **τεκμήρια** (κατάλογος κάθε θεατή), το **ίχνος** του επαγγελματία
 * (ποια αρχεία είναι δικά του) και τον **γραφέα** (προηγούμενη αποστολή · ποιες εκδόσεις καρφώνονται ακόμη).
 *
 * Ερωτήματα **μόνο ισότητες** με `companyId` πρώτο (CHECK 3.35) ⇒ κανένας σύνθετος δείκτης (CHECK 3.91). Κάθε
 * έγγραφο περνά από το σχήμα (`parseContribution`): μη αναγνώσιμο ⇒ παραλείπεται **και** αναφέρεται, ποτέ
 * «μαντεύεται» (ένας χαλασμένος ρόλος θα ήταν ακροατήριο που κανείς δεν όρισε).
 *
 * @module services/conveyance/conveyance-contribution-store.server
 */

import 'server-only';

import type { Firestore, Query, QuerySnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { parseContribution } from '@/lib/conveyance/contribution-schema';
import { createModuleLogger } from '@/lib/telemetry';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { ConveyanceContribution } from '@/types/conveyance-contribution';

const logger = createModuleLogger('conveyance-contribution-store');

export function contributionsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.CONVEYANCE_CONTRIBUTIONS);
}

/** Όλες οι αποστολές της υπόθεσης — στον μισθωτή-οικοδεσπότη. */
function caseContributionsQuery(db: Firestore, record: Pick<ConveyanceCase, 'id' | 'companyId'>): Query {
  return contributionsCollection(db)
    .where('companyId', '==', record.companyId)
    .where('caseId', '==', record.id);
}

/** Οι αποστολές **ενός** συντάκτη για **μία** γραμμή — ό,τι κρίνει ο γραφέας μέσα στη συναλλαγή. */
export function authorItemContributionsQuery(
  db: Firestore,
  record: Pick<ConveyanceCase, 'id' | 'companyId'>,
  authorUid: string,
  checklistItemId: string,
): Query {
  return caseContributionsQuery(db, record)
    .where('authorUid', '==', authorUid)
    .where('checklistItemId', '==', checklistItemId);
}

/** Σχήμα → τύπος· τα μη αναγνώσιμα παραλείπονται και αναφέρονται. */
export function contributionsOf(snapshot: QuerySnapshot): ConveyanceContribution[] {
  return snapshot.docs.flatMap((doc) => {
    const parsed = parseContribution(doc.data());
    if (!parsed) logger.warn('Μη αναγνώσιμο transmittal — παραλείφθηκε', { contributionId: doc.id });
    return parsed ? [parsed] : [];
  });
}

/** Όλες οι αποστολές της υπόθεσης, ή `null` αν η ανάγνωση απέτυχε («δεν ξέρω» ≠ «καμία»). */
export async function readCaseContributions(db: Firestore, record: Pick<ConveyanceCase, 'id' | 'companyId'>): Promise<ConveyanceContribution[] | null> {
  try {
    return contributionsOf(await caseContributionsQuery(db, record).get());
  } catch (error) {
    logger.error('Τα transmittals της υπόθεσης δεν διαβάστηκαν', { caseId: record.id, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** Η νεότερη **μη αποσυρμένη** αποστολή μιας λίστας — ή `null`. */
export function latestLive(contributions: readonly ConveyanceContribution[]): ConveyanceContribution | null {
  return contributions
    .filter((c) => c.withdrawnAt === null)
    .reduce<ConveyanceContribution | null>((latest, c) => (!latest || latest.issuedAt < c.issuedAt ? c : latest), null);
}
