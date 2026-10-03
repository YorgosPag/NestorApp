/**
 * =============================================================================
 * Το ίχνος της υπόθεσης — λεξιλόγιο και προβολή για τον ΕΠΑΓΓΕΛΜΑΤΙΑ (ADR-901 Φ4 §5.9)
 * =============================================================================
 *
 * Το βιβλίο (`entity_audit_trail`) ανήκει στον **οικοδεσπότη**: εκείνος βλέπει τα πάντα με το υπάρχον
 * `ActivityTab`. Ο επαγγελματίας βλέπει μια **προβολή** του:
 * - τις **δικές του** ενέργειες (άνοιγμα/λήψη, αποδοχή)
 * - ποιος άνοιξε τα **δικά του** αρχεία (Φ4.4), μόνο με τον **ρόλο** του άλλου, χωρίς όνομα ή email —
 *   και ο **οικοδεσπότης** είναι ρόλος εδώ (`host`), αφού ανοίγει πια τεκμήρια από τον κατάλογο
 * - τις δικές του **αποστολές** και **αποσύρσεις** (transmittal, Φ4.4) — `document_added` / `document_removed`
 *   με πεδίο `transmittal`, ώστε να μη χρειαστεί δεύτερο λεξιλόγιο ενεργειών (CHECK 3.14)
 * - τα **αιτήματα εγγράφων** (Φ4.5, `document_requested`) που έκανε ο ίδιος **ή** που ζητήθηκαν από τον ρόλο του —
 *   ποτέ αιτήματα ανάμεσα σε τρίτους (Α31). Μία εγγραφή βιβλίου ανά πάτημα ⇒ ένα αντικείμενο ανά γραμμή καταλόγου.
 *
 * 🔑 Καθαρό (leaf), ώστε ο κανόνας «τι βλέπει ποιος» να ασκείται χωρίς βάση. Η κωδικοποίηση του πεδίου
 *    `access` γράφεται **και** διαβάζεται **εδώ**, για να μην αποκλίνουν γραφέας και αναγνώστης.
 *
 * @module lib/conveyance/case-activity
 */

import { LEGAL_ENGAGEMENT_ROLES } from '@/types/engagement';
import type { CaseActivityItem, CaseActorRole } from '@/types/conveyance-case';
import type { EntityAuditEntry } from '@/types/audit-trail';

/** `view` = άνοιγμα στη σελίδα (inline) · `download` = αποθήκευση με το ανθρώπινο όνομα. */
export const CASE_FILE_MODES = ['view', 'download'] as const;
export type CaseFileMode = (typeof CASE_FILE_MODES)[number];

/** Το πεδίο ίχνους που λέει **πώς** και **από ποιον ρόλο** ανοίχτηκε ένα τεκμήριο. */
export const CASE_ACCESS_FIELD = 'access';
/** Το πεδίο ίχνους που λέει **ποιο** τεκμήριο (`newValue` = fileId · `label` = όνομα). */
export const CASE_DOCUMENT_FIELD = 'document';
/** Το πεδίο ίχνους μιας αποστολής/απόσυρσης (`newValue` = contributionId). */
export const CASE_TRANSMITTAL_FIELD = 'transmittal';
/** Φ4.5 — το πεδίο ίχνους ενός αιτήματος εγγράφου (`newValue` = id γραμμής · `label` = `αιτών>παραλήπτης`). */
export const CASE_REQUEST_FIELD = 'request';

const CASE_ACTOR_ROLES: readonly CaseActorRole[] = [...LEGAL_ENGAGEMENT_ROLES, 'host'];

export function encodeCaseAccess(mode: CaseFileMode, role: CaseActorRole): string {
  return `${mode}:${role}`;
}

/** Φ4.5 — ποιος ζήτησε από ποιον (ρόλοι, ποτέ ονόματα) — γράφεται **και** διαβάζεται εδώ. */
export function encodeCaseRequest(requester: CaseActorRole, recipient: CaseActorRole): string {
  return `${requester}>${recipient}`;
}

function decodeCaseRequest(value: unknown): { readonly requester: CaseActorRole; readonly recipient: CaseActorRole } | null {
  if (typeof value !== 'string') return null;
  const [requester, recipient] = value.split('>');
  const knownRequester = CASE_ACTOR_ROLES.find((r) => r === requester);
  const knownRecipient = CASE_ACTOR_ROLES.find((r) => r === recipient);
  return knownRequester && knownRecipient ? { requester: knownRequester, recipient: knownRecipient } : null;
}

function decodeCaseAccess(value: unknown): { readonly mode: CaseFileMode; readonly role: CaseActorRole } | null {
  if (typeof value !== 'string') return null;
  const [mode, role] = value.split(':');
  const knownMode = CASE_FILE_MODES.find((m) => m === mode);
  const knownRole = CASE_ACTOR_ROLES.find((r) => r === role);
  return knownMode && knownRole ? { mode: knownMode, role: knownRole } : null;
}

/** Η αποστολή/απόσυρση ⇒ είδος της προβολής (μόνο αν η εγγραφή φέρει πεδίο transmittal). */
const TRANSMITTAL_KIND: Readonly<Partial<Record<EntityAuditEntry['action'], CaseActivityItem['kind']>>> = {
  document_added: 'transmitted',
  document_removed: 'withdrawn',
};

/**
 * Ποιον αφορά η προβολή: ο θεατής και τα αρχεία που **έστειλε** ο ίδιος (`fileId → όνομα`, από τα δικά του
 * transmittals). Το όνομα έρχεται **από εκεί** και όχι από το βιβλίο: όταν ο οικοδεσπότης δεν ανήκει στο
 * ακροατήριο μιας αποστολής, η εγγραφή του βιβλίου (που τη βλέπει εκείνος) **δεν** φέρει όνομα αρχείου (Α23).
 */
export interface CaseActivityViewer {
  readonly uid: string;
  /** Φ4.5 — ο ρόλος του: «σας ζήτησαν» αφορά τον **ρόλο** (αίτημα προς «τον συμβολαιογράφο», όχι προς πρόσωπο). */
  readonly role: CaseActorRole;
  readonly ownFiles: ReadonlyMap<string, string>;
}

function documentOf(entry: EntityAuditEntry): { readonly fileId: string; readonly name: string | null } | null {
  const change = entry.changes.find((c) => c.field === CASE_DOCUMENT_FIELD);
  return change && typeof change.newValue === 'string' ? { fileId: change.newValue, name: change.label ?? null } : null;
}

/** Το όνομα του εγγράφου: από το βιβλίο, αλλιώς από τα δικά του transmittals. */
function nameOf(document: { readonly fileId: string; readonly name: string | null }, viewer: CaseActivityViewer): string | null {
  return document.name ?? viewer.ownFiles.get(document.fileId) ?? null;
}

/** Μία εγγραφή ⇒ ένα αντικείμενο της προβολής, ή `null` αν **δεν** αφορά τον θεατή. */
function toItem(entry: EntityAuditEntry, viewer: CaseActivityViewer): CaseActivityItem | null {
  const byViewer = entry.performedBy === viewer.uid;
  const base = { id: entry.id ?? '', at: entry.timestamp, byViewer, itemId: null };
  if (entry.action === 'document_accessed') {
    const document = documentOf(entry);
    const access = decodeCaseAccess(entry.changes.find((c) => c.field === CASE_ACCESS_FIELD)?.newValue);
    if (!document || !access) return null;
    if (!byViewer && !viewer.ownFiles.has(document.fileId)) return null;
    return { ...base, kind: access.mode === 'view' ? 'viewed' : 'downloaded', documentName: nameOf(document, viewer), actorRole: access.role };
  }
  const transmittalKind = TRANSMITTAL_KIND[entry.action];
  if (transmittalKind && byViewer && entry.changes.some((c) => c.field === CASE_TRANSMITTAL_FIELD)) {
    const document = documentOf(entry);
    return { ...base, kind: transmittalKind, documentName: document ? nameOf(document, viewer) : null, actorRole: null };
  }
  if (entry.entityType === 'engagement' && byViewer && entry.action === 'status_changed') {
    return { ...base, kind: 'answered', documentName: null, actorRole: null };
  }
  return null;
}

/**
 * Φ4.5 (Α31) — τα αιτήματα εγγράφων μιας εγγραφής: **ένα** αντικείμενο ανά γραμμή. Ο θεατής τα βλέπει **μόνο** αν
 * τα έκανε ο ίδιος (`requested`, με τον παραλήπτη ως ρόλο) ή αν ζητήθηκαν από τον **ρόλο** του (`request-received`,
 * με τον αιτούντα ως ρόλο). Ποτέ αίτημα ανάμεσα σε τρίτους.
 */
function requestItems(entry: EntityAuditEntry, viewer: CaseActivityViewer): CaseActivityItem[] {
  if (entry.action !== 'document_requested') return [];
  const byViewer = entry.performedBy === viewer.uid;
  return entry.changes.flatMap((change) => {
    const pair = change.field === CASE_REQUEST_FIELD ? decodeCaseRequest(change.label) : null;
    if (!pair || typeof change.newValue !== 'string') return [];
    const received = !byViewer && pair.recipient === viewer.role;
    if (!byViewer && !received) return [];
    return [{
      id: `${entry.id ?? ''}:${change.newValue}`,
      at: entry.timestamp,
      kind: byViewer ? 'requested' : 'request-received',
      documentName: null,
      itemId: change.newValue,
      byViewer,
      actorRole: byViewer ? pair.recipient : pair.requester,
    }];
  });
}

/** Η προβολή του ίχνους για τον επαγγελματία — νεότερο πρώτο, χωρίς διπλά. */
export function projectCaseActivity(entries: readonly EntityAuditEntry[], viewer: CaseActivityViewer): CaseActivityItem[] {
  const items = new Map<string, CaseActivityItem>();
  for (const entry of entries) {
    const item = toItem(entry, viewer);
    for (const each of item ? [item] : requestItems(entry, viewer)) {
      if (each.id && !each.id.startsWith(':')) items.set(each.id, each);
    }
  }
  return [...items.values()].sort((a, b) => b.at.localeCompare(a.at));
}
