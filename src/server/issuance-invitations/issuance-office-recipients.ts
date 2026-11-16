/**
 * @fileoverview **Οι λογαριασμοί του ΓΡΑΦΕΙΟΥ** μιας ανάθεσης έκδοσης — όποιος πρότεινε και όποιος έστειλε την ανάθεση
 *   (μπορεί να είναι ο ίδιος). Η ΜΙΑ απάντηση για κάθε ειδοποίηση προς το γραφείο (ADR-915 §45 · ADR-942 Φ1).
 * @module server/issuance-invitations/issuance-office-recipients
 *
 * Ήταν δύο χειρόγραφα αντίγραφα της ίδιας συνθήκης (`issuance-delivery-notifier` · `issuance-delivery-change-notifier`)·
 * το αίτημα εγγράφων θα ήταν το τρίτο.
 */

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';

export function issuanceOfficeRecipients(record: Pick<IssuanceAssignmentRecord, 'proposedByUid' | 'notice'>): readonly string[] {
  return [...new Set([record.proposedByUid, ...(record.notice === null ? [] : [record.notice.byUid])])];
}
