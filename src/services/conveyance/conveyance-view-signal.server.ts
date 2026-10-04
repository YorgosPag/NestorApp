/**
 * =============================================================================
 * Ο ΕΝΑΣ γραφέας των σημάτων όψεων της υπόθεσης (ADR-901 §14.8)
 * =============================================================================
 *
 * Μοτίβο **transactional outbox** (AWS · microservices.io): το σήμα γράφεται **μέσα στη συναλλαγή** της πράξης —
 * πράξη χωρίς σήμα ή σήμα χωρίς πράξη είναι **δομικά αδύνατα**. Ο client ακούει το **δικό του** έγγραφο
 * (`use-server-view-signal`) και ξαναρωτά την όψη από τον server — ποτέ τις συλλογές της υπόθεσης, που μένουν
 * deny-all (το ακροατήριο δεν εκφράζεται σε κανόνα).
 *
 * 🔑 **Ιδεμπότητα ως προς το αποτέλεσμα**: διπλή αύξηση (επανάληψη συναλλαγής · at-least-once trigger) = μία
 *    περιττή ανάγνωση, ποτέ λάθος εικόνα — ο client συγκρίνει `revision` και ξαναρωτά τον server.
 * 🔑 **Ποιες όψεις** δεν αποφασίζονται εδώ: τις δίνει η ΜΙΑ καθαρή κρίση (`viewsAffectedBy`). Αυτό το αρχείο
 *    ξέρει μόνο **πώς** γράφεται ένα σήμα και **πώς** διαβάζεται η αναθεώρηση πριν παραχθεί μια όψη.
 *
 * @module services/conveyance/conveyance-view-signal.server
 */

import 'server-only';

import { FieldValue, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { EngagementRosterSignal } from '@/lib/auth/engagement-write';
import { viewsAffectedBy, type CaseChange, type CaseViewers } from '@/lib/conveyance/view-signal-audience';
import { viewSignalOwner, viewSignalSeed, type CaseViewKey, type HostCaseView } from '@/lib/conveyance/view-signal-key';
import { generateDeterministicConveyanceViewSignalId } from '@/services/enterprise-id.service';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';
import { activeCaseEngagements } from './conveyance-engagement-support';

/** Το έγγραφο-σήμα μιας όψης — υπολογίζεται, δεν αναζητείται. */
export function viewSignalRef(db: Firestore, view: CaseViewKey): DocumentReference {
  return db.collection(COLLECTIONS.CONVEYANCE_VIEW_SIGNALS).doc(generateDeterministicConveyanceViewSignalId(viewSignalSeed(view)));
}

/** Η όψη του οικοδεσπότη μιας υπόθεσης — η όψη του **ακινήτου** της. */
export function hostViewOf(record: Pick<ConveyanceCase, 'companyId' | 'subject'>): HostCaseView {
  return { kind: 'host', propertyId: record.subject.propertyId, companyId: record.companyId };
}

/** Η όψη μιας συμμετοχής. */
export function engagementViewOf(engagement: Pick<Engagement, 'id' | 'uid'>): CaseViewKey {
  return { kind: 'engagement', engagementId: engagement.id, uid: engagement.uid };
}

/**
 * Οι όψεις μιας υπόθεσης από τις συμμετοχές της. ⚠️ Ο καλών δίνει **μόνο** όσες έχουν πρόσβαση (ενεργές): σήμα σε
 * πρόταση που δεν απαντήθηκε θα έλεγε σε κάποιον χωρίς πρόσβαση *πότε* δουλεύει η υπόθεση.
 */
export function caseViewersOf(record: Pick<ConveyanceCase, 'companyId' | 'subject'>, active: readonly Engagement[]): CaseViewers {
  return {
    host: hostViewOf(record),
    engaged: active.map((e) => ({ kind: 'engagement', engagementId: e.id, uid: e.uid, role: e.role })),
  };
}

/** Οι όψεις της υπόθεσης **τώρα** — διαβάζονται ΠΡΙΝ από τη συναλλαγή (μια νέα συμμετοχή στο μεταξύ ξεκινά με φρέσκια όψη). */
export async function readCaseViewers(db: Firestore, record: ConveyanceCase, nowMs: number): Promise<CaseViewers> {
  return caseViewersOf(record, await activeCaseEngagements(db, record, nowMs));
}

/** Αύξηση των σημάτων **μέσα** στη συναλλαγή της πράξης (merge: η πρώτη αύξηση γεννά το έγγραφο). */
export function signalViewsInTx(tx: Transaction, db: Firestore, views: readonly CaseViewKey[]): void {
  for (const view of views) {
    tx.set(viewSignalRef(db, view), { ...viewSignalOwner(view), revision: FieldValue.increment(1), changedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
}

/** Η αλλαγή → οι όψεις της (η ΜΙΑ κρίση) → σήμα, στην ίδια συναλλαγή. */
export function signalCaseChangeInTx(
  tx: Transaction,
  db: Firestore,
  change: CaseChange,
  viewers: CaseViewers,
  extra: readonly CaseViewKey[] = [],
): void {
  signalViewsInTx(tx, db, viewsAffectedBy(change, viewers, extra));
}

/**
 * Το σήμα που δίνει η υπόθεση στον ΕΝΑ γραφέα συμμετοχών (`engagement-write.ts`): ο κατάλογος συμμετεχόντων είναι
 * κοινός ⇒ ο οικοδεσπότης + όλοι οι **ενεργοί** + η όψη **κάθε** συμμετοχής που άλλαξε (η δική της πρόσβαση άλλαξε).
 */
export function caseRosterSignal(db: Firestore, record: Pick<ConveyanceCase, 'companyId' | 'subject'>): EngagementRosterSignal {
  return (tx, roster) => {
    const active = roster.live.filter((e) => e.state === 'active');
    signalCaseChangeInTx(tx, db, { kind: 'roster' }, caseViewersOf(record, active), roster.changed.map(engagementViewOf));
  };
}

/**
 * Το σήμα μιας πρόσκλησης υπόθεσης (έκδοση · ανάκληση · «ανοίχτηκε» · υπενθύμιση · λήξη · άρνηση): η πρόσκληση τη
 * βλέπει **μόνο** ο οικοδεσπότης (θέσεις επαγγελματιών) — ο καλεσμένος δεν έχει ακόμη όψη.
 */
export function invitationHostSignal(db: Firestore, invitation: { readonly hostCompanyId: string; readonly propertyId: string }): (tx: Transaction) => void {
  const view: HostCaseView = { kind: 'host', propertyId: invitation.propertyId, companyId: invitation.hostCompanyId };
  return (tx) => signalViewsInTx(tx, db, [view]);
}

/**
 * Η αναθεώρηση της όψης — διαβάζεται **ΠΡΙΝ** παραχθεί η όψη, ώστε η όψη να είναι **τουλάχιστον** τόσο φρέσκια
 * όσο ο αριθμός που κουβαλά. Ο client ξαναρωτά μόνο όταν το σήμα ξεπεράσει αυτόν τον αριθμό (καμία διπλή ανάγνωση).
 */
export async function readViewRevision(db: Firestore, view: CaseViewKey): Promise<number> {
  return revisionOf((await viewSignalRef(db, view).get()).get('revision'));
}

/**
 * Η αναθεώρηση **μέσα** στη συναλλαγή της πράξης (αναγνώσεις πριν από γραφές): η όψη που επιστρέφει η πράξη κουβαλά
 * **ακριβώς** την αναθεώρηση της δικής της εγγραφής — ούτε μπαγιάτικη (ταυτόχρονη πράξη άλλου), ούτε διπλή ανάγνωση.
 */
export async function readViewRevisionInTx(tx: Transaction, db: Firestore, view: CaseViewKey): Promise<number> {
  return revisionOf((await tx.get(viewSignalRef(db, view))).get('revision'));
}

function revisionOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
