/**
 * =============================================================================
 * «Ζήτησε έγγραφο» — η ΜΙΑ ροή εγγραφής, κοινή για κάθε είδος υπόθεσης (ADR-942 Φ0 · ADR-901 Α29 · Α30)
 * =============================================================================
 *
 * Ο **προσαρμογέας** του είδους έχει ήδη κάνει τα βήματα 1–2 (κατάλογος του αιτούντος + κριτής ⇒ παραλήπτης ή άρνηση).
 * Εδώ ζουν τα βήματα που **δεν** εξαρτώνται από το είδος:
 *
 * 3. **Συναλλαγή**: ένα έγγραφο ανά (υπόθεση, γραμμή, αιτών, ημέρα) με **ντετερμινιστική** ταυτότητα —
 *    υπάρχει ήδη ⇒ `already-requested` (anti-spam χωρίς race· δεύτερο πάτημα δεν ξαναειδοποιεί)
 * 4. **Ίχνος** — μία εγγραφή ανά πάτημα, **μόνο** όταν γεννήθηκαν νέα αιτήματα (το γράφει ο προσαρμογέας)
 * 5. **Ειδοποίηση** — **μία** ανά ρόλο-παραλήπτη για όσα δεν ειδοποιήθηκαν ακόμη (`notifiedAt === null`)· μετά
 *    σημαδεύονται. Αίτημα που έσκασε ανάμεσα σε 3 και 5 **συγκλίνει** στην επανάληψη (ίδιο σύνολο ⇒ ίδιο `eventId`).
 *
 * ⛔ Ο παραλήπτης **δεν** έρχεται ποτέ από το αίτημα (Α29) — μόνο από τον κριτή του προσαρμογέα.
 *
 * @module server/document-requests/request-pipeline.server
 */

import 'server-only';

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { documentRequestSeed, type RequestParty } from '@/lib/document-requests/request-core';
import { generateDeterministicDocumentRequestId } from '@/services/enterprise-id.service';
import type { DocumentRequestItemOutcome, DocumentRequestSubject, StoredDocumentRequest } from '@/types/document-request';
import { documentRequestsCollection } from './document-request-store.server';

/** Γραμμή που ο κριτής δέχτηκε: σε ποιον πάει. */
export interface AcceptedRequest<Role extends string> {
  readonly itemId: string;
  readonly recipient: Role;
}

/** Η κρίση ανά γραμμή — δεκτή, ή ήδη τελικό αποτέλεσμα άρνησης. */
export type JudgedRequest<Role extends string> = AcceptedRequest<Role> | DocumentRequestItemOutcome<Role>;

/** Ό,τι ξέρει **μόνο** το είδος της υπόθεσης — η ροή δεν ρωτά τίποτα άλλο. */
export interface RequestPipelineAdapter<Role extends string> {
  readonly companyId: string;
  readonly subject: DocumentRequestSubject;
  readonly projectId: string | null;
  readonly party: RequestParty<Role>;
  /** Η ημέρα της ταυτότητας, με το ρολόι του είδους. */
  readonly dayKey: string;
  /** Η στιγμή του πατήματος (ISO) — `requestedAt` και `notifiedAt`. */
  readonly nowIso: string;
  /** Ο αναλυτής του είδους (`parseDocumentRequest`) — fail-closed: μη αναγνώσιμο ⇒ `null`. */
  parse(raw: unknown): StoredDocumentRequest<Role> | null;
  /** Γεννήθηκε κάτι που αλλάζει όψεις: αιτών + παραλήπτες των νέων αιτημάτων. */
  signalInTx(tx: Transaction, parties: readonly Role[]): void;
  /** (4) Η εγγραφή βιβλίου για τα νέα αιτήματα. */
  audit(fresh: readonly StoredDocumentRequest<Role>[]): Promise<void>;
  /** (5) Μία ειδοποίηση σε **όλους** τους λογαριασμούς του ρόλου· `failed` ⇒ καμία σήμανση, η επανάληψη ξαναστέλνει. */
  notifyRole(role: Role, group: readonly StoredDocumentRequest<Role>[]): Promise<'delivered' | 'failed'>;
}

export interface WrittenRequest<Role extends string> {
  readonly request: StoredDocumentRequest<Role>;
  readonly fresh: boolean;
}

interface Planned<Role extends string> extends AcceptedRequest<Role> {
  readonly id: string;
}

function isAccepted<Role extends string>(judged: JudgedRequest<Role>): judged is AcceptedRequest<Role> {
  return !('kind' in judged);
}

function newRequest<Role extends string>(adapter: RequestPipelineAdapter<Role>, planned: Planned<Role>): StoredDocumentRequest<Role> {
  return {
    id: planned.id,
    companyId: adapter.companyId,
    subject: { kind: adapter.subject.kind, id: adapter.subject.id },
    projectId: adapter.projectId,
    itemId: planned.itemId,
    requesterRole: adapter.party.role,
    requesterUid: adapter.party.uid,
    recipient: planned.recipient,
    dayKey: adapter.dayKey,
    requestedAt: adapter.nowIso,
    notifiedAt: null,
  };
}

/** (3) Η συναλλαγή: νέα έγγραφα για όσα δεν ζητήθηκαν σήμερα· τα υπάρχοντα επιστρέφονται ως έχουν. */
async function writeRequests<Role extends string>(
  db: Firestore,
  adapter: RequestPipelineAdapter<Role>,
  accepted: readonly AcceptedRequest<Role>[],
): Promise<readonly WrittenRequest<Role>[]> {
  const planned = accepted.map((a): Planned<Role> & { readonly ref: DocumentReference } => {
    const id = generateDeterministicDocumentRequestId(documentRequestSeed(adapter.subject.id, a.itemId, adapter.party, adapter.dayKey));
    return { ...a, id, ref: documentRequestsCollection(db).doc(id) };
  });
  return db.runTransaction(async (tx) => {
    const snapshots = await tx.getAll(...planned.map((p) => p.ref));
    const written = planned.map((p, index): WrittenRequest<Role> => {
      const existing = adapter.parse(snapshots[index]?.data());
      if (existing) return { request: existing, fresh: false };
      const request = newRequest(adapter, p);
      tx.create(p.ref, request);
      return { request, fresh: true };
    });
    // §14.8 — το αίτημα το βλέπουν ΜΟΝΟ αιτών και παραλήπτης (Α31)· ό,τι ήδη ζητήθηκε σήμερα δεν αλλάζει καμία όψη.
    const parties = [adapter.party.role, ...written.filter((w) => w.fresh).map((w) => w.request.recipient)];
    if (parties.length > 1) adapter.signalInTx(tx, parties);
    return written;
  });
}

/** (5) Μία ειδοποίηση ανά ρόλο-παραλήπτη για τα μη ειδοποιημένα· σήμανση **μόνο** αν καμία αποστολή δεν απέτυχε. */
async function notifyPending<Role extends string>(
  db: Firestore,
  adapter: RequestPipelineAdapter<Role>,
  requests: readonly StoredDocumentRequest<Role>[],
): Promise<void> {
  const pending = requests.filter((r) => r.notifiedAt === null);
  for (const role of new Set(pending.map((r) => r.recipient))) {
    const group = pending.filter((r) => r.recipient === role);
    if ((await adapter.notifyRole(role, group)) === 'failed') continue;
    await Promise.all(group.map((r) => documentRequestsCollection(db).doc(r.id).update({ notifiedAt: adapter.nowIso })));
  }
}

function outcomesOf<Role extends string>(
  judged: readonly JudgedRequest<Role>[],
  written: readonly WrittenRequest<Role>[],
): readonly DocumentRequestItemOutcome<Role>[] {
  const byItem = new Map(written.map((w) => [w.request.itemId, w]));
  return judged.map((j): DocumentRequestItemOutcome<Role> => {
    if (!isAccepted(j)) return j;
    return { itemId: j.itemId, kind: byItem.get(j.itemId)?.fresh ? 'requested' : 'already-requested', recipient: j.recipient };
  });
}

/** Τα βήματα 3–5 πάνω στην κρίση του προσαρμογέα → αποτέλεσμα ανά γραμμή, με τη σειρά που ζητήθηκαν. */
export async function runDocumentRequests<Role extends string>(
  db: Firestore,
  adapter: RequestPipelineAdapter<Role>,
  judged: readonly JudgedRequest<Role>[],
): Promise<readonly DocumentRequestItemOutcome<Role>[]> {
  const accepted = judged.filter(isAccepted);
  const written = accepted.length > 0 ? await writeRequests(db, adapter, accepted) : [];
  const fresh = written.filter((w) => w.fresh).map((w) => w.request);
  if (fresh.length > 0) await adapter.audit(fresh);
  await notifyPending(db, adapter, written.map((w) => w.request));
  return outcomesOf(judged, written);
}
