/**
 * =============================================================================
 * Το ίχνος της υπόθεσης — λεξιλόγιο και προβολή για τον ΕΠΑΓΓΕΛΜΑΤΙΑ (ADR-901 Φ4 §5.9)
 * =============================================================================
 *
 * Το βιβλίο (`entity_audit_trail`) ανήκει στον **οικοδεσπότη**: εκείνος βλέπει τα πάντα με το υπάρχον
 * `ActivityTab`. Ο επαγγελματίας βλέπει μια **προβολή** του:
 * - τις **δικές του** ενέργειες (άνοιγμα/λήψη, αποδοχή)
 * - ποιος άνοιξε τα **δικά του** αρχεία (Φ4.4), μόνο με τον **ρόλο** του άλλου, χωρίς όνομα ή email
 *
 * 🔑 Καθαρό (leaf), ώστε ο κανόνας «τι βλέπει ποιος» να ασκείται χωρίς βάση. Η κωδικοποίηση του πεδίου
 *    `access` γράφεται **και** διαβάζεται **εδώ**, για να μην αποκλίνουν γραφέας και αναγνώστης.
 *
 * @module lib/conveyance/case-activity
 */

import { LEGAL_ENGAGEMENT_ROLES } from '@/types/engagement';
import type { CaseActivityItem } from '@/types/conveyance-case';
import type { EntityAuditEntry } from '@/types/audit-trail';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/** `view` = άνοιγμα στη σελίδα (inline) · `download` = αποθήκευση με το ανθρώπινο όνομα. */
export const CASE_FILE_MODES = ['view', 'download'] as const;
export type CaseFileMode = (typeof CASE_FILE_MODES)[number];

/** Το πεδίο ίχνους που λέει **πώς** και **από ποιον ρόλο** ανοίχτηκε ένα τεκμήριο. */
export const CASE_ACCESS_FIELD = 'access';
/** Το πεδίο ίχνους που λέει **ποιο** τεκμήριο (`newValue` = fileId · `label` = όνομα). */
export const CASE_DOCUMENT_FIELD = 'document';

export function encodeCaseAccess(mode: CaseFileMode, role: LegalProfessionalRole): string {
  return `${mode}:${role}`;
}

function decodeCaseAccess(value: unknown): { readonly mode: CaseFileMode; readonly role: LegalProfessionalRole } | null {
  if (typeof value !== 'string') return null;
  const [mode, role] = value.split(':');
  const knownMode = CASE_FILE_MODES.find((m) => m === mode);
  const knownRole = LEGAL_ENGAGEMENT_ROLES.find((r) => r === role);
  return knownMode && knownRole ? { mode: knownMode, role: knownRole } : null;
}

/** Ποιον αφορά η προβολή: ο θεατής και τα αρχεία που **έγραψε** ο ίδιος. */
export interface CaseActivityViewer {
  readonly uid: string;
  readonly ownFileIds: ReadonlySet<string>;
}

function documentOf(entry: EntityAuditEntry): { readonly fileId: string; readonly name: string | null } | null {
  const change = entry.changes.find((c) => c.field === CASE_DOCUMENT_FIELD);
  return change && typeof change.newValue === 'string' ? { fileId: change.newValue, name: change.label ?? null } : null;
}

/** Μία εγγραφή ⇒ ένα αντικείμενο της προβολής, ή `null` αν **δεν** αφορά τον θεατή. */
function toItem(entry: EntityAuditEntry, viewer: CaseActivityViewer): CaseActivityItem | null {
  const byViewer = entry.performedBy === viewer.uid;
  if (entry.action === 'document_accessed') {
    const document = documentOf(entry);
    const access = decodeCaseAccess(entry.changes.find((c) => c.field === CASE_ACCESS_FIELD)?.newValue);
    if (!document || !access) return null;
    if (!byViewer && !viewer.ownFileIds.has(document.fileId)) return null;
    return { id: entry.id ?? '', at: entry.timestamp, kind: access.mode === 'view' ? 'viewed' : 'downloaded', documentName: document.name, byViewer, actorRole: access.role };
  }
  if (entry.entityType === 'engagement' && byViewer && entry.action === 'status_changed') {
    return { id: entry.id ?? '', at: entry.timestamp, kind: 'answered', documentName: null, byViewer, actorRole: null };
  }
  return null;
}

/** Η προβολή του ίχνους για τον επαγγελματία — νεότερο πρώτο, χωρίς διπλά. */
export function projectCaseActivity(entries: readonly EntityAuditEntry[], viewer: CaseActivityViewer): CaseActivityItem[] {
  const items = new Map<string, CaseActivityItem>();
  for (const entry of entries) {
    const item = toItem(entry, viewer);
    if (item && item.id) items.set(item.id, item);
  }
  return [...items.values()].sort((a, b) => b.at.localeCompare(a.at));
}
