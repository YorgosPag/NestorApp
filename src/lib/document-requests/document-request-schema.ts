/**
 * Το σχήμα του αποθηκευμένου αιτήματος εγγράφου (ADR-942 Φ0 · ADR-901 Φ4.5) — **η μία μετάφραση** δίσκου → τύπου.
 *
 * Fail-closed, όπως το `contribution-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αγνοεί και το
 * αναφέρει. ⛔ Ποτέ `as StoredDocumentRequest`: ένας χαλασμένος `recipient` που «μαντεύεται» θα έδειχνε το αίτημα σε
 * λάθος θεατή (Α31).
 *
 * 🔑 **Ένας αναλυτής ανά είδος υπόθεσης — ολικός πίνακας.** Οι ρόλοι **παράγονται** από το `ROLES_OF_SUBJECT`
 *    (ADR-862 §5.3.10) + τον οικοδεσπότη· κανένας δεύτερος κατάλογος ρόλων. Έγγραφο άλλου είδους ⇒ `null`.
 *
 * @module lib/document-requests/document-request-schema
 */

import { z } from 'zod';

import { calendarDaySchema } from '@/lib/date/calendar-day-schema';
import { ROLES_OF_SUBJECT, type EngagementSubjectKind } from '@/types/engagement';
import type { StoredDocumentRequest } from '@/types/document-request';
import { HOST_REQUEST_ROLE } from './request-core';

/** Οι ρόλοι αιτούντος/παραλήπτη ενός είδους: οι ρόλοι συμμετοχής του + ο οικοδεσπότης. */
export type RequestRoleOf<K extends EngagementSubjectKind> = (typeof ROLES_OF_SUBJECT)[K][number] | typeof HOST_REQUEST_ROLE;

type RequestParser<R extends string> = (raw: unknown) => StoredDocumentRequest<R> | null;

const nonEmpty = z.string().min(1);

function parserFor<R extends string>(kind: EngagementSubjectKind, roles: Readonly<[R, ...R[]]>): RequestParser<R> {
  const role = z.enum(roles);
  const schema = z.object({
    id: nonEmpty,
    companyId: nonEmpty,
    subject: z.object({ kind: z.literal(kind), id: nonEmpty }),
    projectId: z.string().nullable(),
    itemId: nonEmpty,
    requesterRole: role,
    requesterUid: nonEmpty,
    recipient: role,
    dayKey: calendarDaySchema,
    requestedAt: nonEmpty,
    notifiedAt: z.string().nullable(),
  });
  return (raw) => {
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  };
}

/**
 * Ολικός: κάθε είδος υπόθεσης έχει τον αναλυτή του. ⚠️ **Συνάρτηση, όχι σταθερά module** — ίδια στάση με το
 * `engagementHosts()` (CHECK 3.80): διαβάζεται τη στιγμή της κλήσης.
 */
function requestParsers(): { readonly [K in EngagementSubjectKind]: RequestParser<RequestRoleOf<K>> } {
  return {
    conveyance_case: parserFor('conveyance_case', [...ROLES_OF_SUBJECT.conveyance_case, HOST_REQUEST_ROLE]),
    document_issuance: parserFor('document_issuance', [...ROLES_OF_SUBJECT.document_issuance, HOST_REQUEST_ROLE]),
  };
}

/** Ωμό έγγραφο → αίτημα **αυτού** του είδους, ή `null` αν δεν είναι αίτημα που καταλαβαίνουμε. */
export function parseDocumentRequest<K extends EngagementSubjectKind>(kind: K, raw: unknown): StoredDocumentRequest<RequestRoleOf<K>> | null {
  return requestParsers()[kind](raw);
}
