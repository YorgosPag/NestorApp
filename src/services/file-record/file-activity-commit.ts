/**
 * =============================================================================
 * 📒 Η ΑΛΛΑΓΗ ΑΡΧΕΙΟΥ ΚΑΙ Η ΓΡΑΜΜΗ ΔΡΑΣΤΗΡΙΟΤΗΤΑΣ ΤΗΣ — ADR-866 §2.6.11 (Ε-Φ0-4)
 * =============================================================================
 *
 * **Το ερώτημα**: *«πώς γράφεται μια πράξη αρχείου που ο άνθρωπος πρέπει να δει στη Δραστηριότητα;»*
 * **Ο απαντητής**: αυτό το αρχείο — κάδος · επαναφορά · μετονομασία περνούν **όλα** από εδώ.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΡΟΣΩΠΙΚΟ ΑΡΧΕΙΟ — ΜΙΑ ΑΤΟΜΙΚΗ ΔΕΣΜΗ, ΖΕΥΓΑΡΩΜΕΝΗ ΑΠΟ ΤΟΥΣ ΚΑΝΟΝΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Στους μεγάλους (Google Drive · Dropbox · Box) τη γραμμή δραστηριότητας **τη γράφει η υπηρεσία**
 * ως συνέπεια της πράξης: ο χρήστης ούτε την πλαστογραφεί ούτε την παραλείπει. Εδώ η πράξη γράφεται
 * από τον πελάτη — άρα την ίδια εγγύηση τη δίνουν οι **κανόνες**, και μάλιστα **ατομικά**:
 *
 *   · το `files_personal` αρνείται κάδο/επαναφορά/μετονομασία αν το `lastActivityId` δεν δείχνει σε
 *     **νέα** γραμμή του `file_audit_log_personal`, γραμμένη στην **ίδια** δέσμη (`existsAfter`)·
 *   · το `file_audit_log_personal` αρνείται γραμμή που **δεν** περιγράφει την αλλαγή που συμβαίνει
 *     (`get` πριν / `getAfter` μετά): «μετονόμασα» χωρίς νέο όνομα δεν γράφεται.
 *
 * 🏆 Ισχυρότερο από τους μεγάλους: εκεί η δραστηριότητα φτάνει **ασύγχρονα**· εδώ η αλλαγή και η
 * γραμμή της **ή γράφονται μαζί ή καθόλου**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΕΤΑΙΡΙΚΟ ΑΡΧΕΙΟ — ΟΠΩΣ ΠΡΙΝ, ΔΗΛΩΜΕΝΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κανόνας `files` επιτρέπει στον **δημιουργό** κάδο «χωρίς claims», ενώ ο κανόνας του
 * `file_audit_log` ζητά `companyId == getUserCompanyId()` (μετρημένο 2026-09-18). Στην ίδια δέσμη,
 * μια πράξη που **σήμερα περνά** θα απορριπτόταν ολόκληρη. ⇒ Η εταιρική γραμμή μένει **προβολή**,
 * μετά την πράξη, μη-μπλοκάρουσα (δόγμα ADR-862 §5.7) — ως το ζευγάρωμα και του εταιρικού κανόνα.
 *
 * @module services/file-record/file-activity-commit
 * @see types/file-audit — `FILE_ACTIVITY_PAIRED_ACTIONS` · `FILE_LAST_ACTIVITY_FIELD`
 */

import { updateDoc, writeBatch, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import { FileAuditService } from '@/services/file-audit.service';
import {
  FILE_LAST_ACTIVITY_FIELD,
  type FileActivityPairedAction,
  type FileAuditMetadata,
} from '@/types/file-audit';

/** Η πράξη που καταγράφεται — **μόνο** από το κλειστό σύνολο που ζευγαρώνουν οι κανόνες. */
export interface FileActivityAct {
  readonly fileId: string;
  readonly action: FileActivityPairedAction;
  readonly performedBy: string;
  readonly metadata?: FileAuditMetadata;
}

/** Μια αλλαγή αρχείου που **είναι** δραστηριότητα. */
export interface FileActivityChange {
  /** Το έγγραφο του αρχείου, **στο διαμέρισμα όπου βρέθηκε**. */
  readonly docRef: DocumentReference;
  /** Ο κάτοχος του αρχείου — από τα **δικά του** πεδία (`custodyScopeFromData`). */
  readonly owner: CustodyScope;
  /** Τα πεδία που αλλάζουν. */
  readonly updates: Readonly<Record<string, unknown>>;
  /** Τι καταγράφεται. */
  readonly act: FileActivityAct;
  /** Όνομα του καλούντα για το log, αν αποτύχει η εταιρική προβολή. */
  readonly context: string;
}

/**
 * **Γράψε την αλλαγή ΚΑΙ τη γραμμή της.** Προσωπικό ⇒ μία ατομική δέσμη· εταιρικό ⇒ ό,τι ίσχυε.
 *
 * 🔴 Πετά όταν αποτύχει η αλλαγή (όπως το `updateDoc` που αντικαθιστά). Για προσωπικό αρχείο αυτό
 * σημαίνει και ότι **καμία** γραμμή δεν γράφτηκε — ποτέ μισή πράξη.
 */
export async function commitFileActivity(change: FileActivityChange): Promise<void> {
  const { docRef, owner, updates, act } = change;

  if (owner.userId !== undefined) {
    const batch = writeBatch(db);
    const activityId = await FileAuditService.stageActivity(batch, owner, act);
    batch.update(docRef, { ...updates, [FILE_LAST_ACTIVITY_FIELD]: activityId });
    await batch.commit();
    return;
  }

  await updateDoc(docRef, { ...updates });
  safeFireAndForget(
    FileAuditService.log(act.fileId, act.action, act.performedBy, owner.companyId, act.metadata),
    change.context,
    { fileId: act.fileId },
  );
}
