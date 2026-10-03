/**
 * =============================================================================
 * Ειδοποιήσεις λήξεων — ο ΠΥΡΗΝΑΣ (ADR-901 Φ4 · §6 Σ-5)
 * =============================================================================
 *
 * **«Ποια δικαιολογητικά θέλουν τώρα την προσοχή αυτού του ανθρώπου, και άλλαξε κάτι από την τελευταία φορά;»**
 *
 * - Η κατάσταση (`expiring` · `expired`) **δεν** υπολογίζεται εδώ: την παράγει ο ΕΝΑΣ πυρήνας του καταλόγου
 *   (`deriveChecklist`), όπου το `expiring` σημαίνει «λήγει σε 7 ημέρες **ή** δεν θα ισχύει την ημέρα της
 *   υπογραφής». Εδώ γίνεται **μόνο** η επιλογή και η σύνοψη.
 * - 🏆 **Ακμή, όχι στάθμη** (καλύτερο από τις υπενθυμίσεις «κάθε μέρα»): το `eventId` φέρει το **αποτύπωμα του
 *   συνόλου** (γραμμή · κατάσταση · λήξη). Το ίδιο σύνολο αύριο σημαίνει ίδιο `eventId`, και ο orchestrator δεν
 *   ξαναστέλνει (dedupe). Νέο πιστοποιητικό που λήγει, πέρασμα από `expiring` σε `expired` ή ανανέωση που άλλαξε
 *   τη λήξη αλλάζουν το σύνολο, και τότε φεύγει **μία** σύνοψη ανά υπόθεση. Ποτέ ένα email ανά γραμμή.
 * - Ο παραλήπτης βλέπει **μόνο** τις γραμμές του ρόλου του: ο κατάλογος έρχεται ήδη φιλτραρισμένος (`visibleTo`).
 *
 * Καθαρό (leaf): ασκείται χωρίς βάση.
 *
 * @module lib/conveyance/expiry-alerts
 */

import { fnv1a32 } from '@/lib/hash/fnv1a';
import type { ChecklistRow } from '@/types/conveyance-case';

/** Μία γραμμή που θέλει προσοχή λόγω ισχύος. */
export interface ExpiryAlert {
  readonly itemId: string;
  readonly status: 'expiring' | 'expired';
  readonly expiresOn: string | null;
}

/** Οι γραμμές σε `expiring`/`expired`, σε **σταθερή** σειρά (για σταθερό αποτύπωμα). */
export function expiryAlertsOf(rows: readonly ChecklistRow[]): ExpiryAlert[] {
  return rows
    .flatMap((row): ExpiryAlert[] => (row.status === 'expiring' || row.status === 'expired'
      ? [{ itemId: row.itemId, status: row.status, expiresOn: row.expiresOn }]
      : []))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

/** Το αποτύπωμα του συνόλου — αλλάζει **μόνο** όταν αλλάζει γραμμή, κατάσταση ή ημερομηνία λήξης. */
export function expiryDigest(alerts: readonly ExpiryAlert[]): string {
  const material = alerts.map((a) => `${a.itemId}:${a.status}:${a.expiresOn ?? '-'}`).join('|');
  return fnv1a32(material).toString(16).padStart(8, '0');
}

/** Ντετερμινιστικό: (υπόθεση, παραλήπτης, σύνολο). Ίδιο σύνολο σημαίνει καμία δεύτερη ειδοποίηση. */
export function expiryEventId(caseId: string, recipientUid: string, alerts: readonly ExpiryAlert[]): string {
  return `case-expiry:${caseId}:${recipientUid}:${expiryDigest(alerts)}`;
}

/** Η σύνοψη για τον τίτλο: πόσες γραμμές, πόσες έχουν ήδη λήξει, και η **νωρίτερη** λήξη. */
export function expirySummary(alerts: readonly ExpiryAlert[]): { readonly count: number; readonly expired: number; readonly earliest: string | null } {
  const dates = alerts.map((a) => a.expiresOn).filter((d): d is string => d !== null).sort();
  return { count: alerts.length, expired: alerts.filter((a) => a.status === 'expired').length, earliest: dates[0] ?? null };
}
