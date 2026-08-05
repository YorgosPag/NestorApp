/**
 * @fileoverview ΕΡΓΟΔΟΤΗΣ → `Project.landowners[]` (ADR-745 Φ3β, §9 Q1).
 *
 * 🔴 **Το «ΕΡΓΟΔΟΤΗΣ» της πινακίδας ΔΕΝ είναι ο εργοδότης** — είναι ο **ιδιοκτήτης του
 * οικοπέδου** (απόφαση Giorgio 2026-08-04, κλειστή). Ποτέ `Project.client`: εκείνο τυπώνεται σε
 * PDF προβολής ως «Πελάτης» και θα διαφήμιζε την αντισυμβαλλόμενη πωλήτρια ως πελάτισσά μας.
 *
 * Τρεις παγίδες συναντιούνται σε αυτό το αρχείο, και οι τρεις είναι **μετρημένες**:
 *
 * - **Γ4** — τα `landowners`, `bartexPercentage` και `landownerContactIds` γράφονταν **μαζί**
 *   και **μόνο** από την καρτέλα. Το τρίτο τροφοδοτεί τον φύλακα διαγραφής επαφών· δεύτερος
 *   γραφέας που το ξεχνά κάνει τον οικοπεδούχο **αόρατο** στον φύλακα ⇒ η επαφή διαγράφεται
 *   χωρίς προειδοποίηση. Θεραπεία: `buildLandownersUpdate` — **ένα σπίτι**.
 * - **Γ5** — ξαναδιάβασμα τη στιγμή του κλικ + συγχώνευση κατά `contactId` (`mergeLandowner`).
 * - **Γ6** — η πινακίδα **δεν δίνει ποσοστό**· απαιτείται από τον άνθρωπο, εδώ επιβάλλεται.
 *
 * @module services/title-block-apply/apply-landowner
 */

import {
  buildLandownersUpdate,
  mergeLandowner,
  toLandownerEntries,
  toPropertyOwners,
} from '@/components/projects/tabs/landowners/landowner-form-model';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import type { AcquisitionStatus, LandownerEntry } from '@/types/ownership-table';
import type { BindingTarget } from '@/types/title-block-binding';
import { readProjectSnapshot } from './project-snapshot';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

/**
 * Ξαναϋπολογίζει τα χιλιοστά πάνω σε **ΟΛΗ** τη λίστα, μέσω του υπάρχοντος μοντέλου φόρμας.
 *
 * 🔑 Δεν γράφεται εδώ δεύτερη κατανομή: το `toLandownerEntries` κατέχει την **ενιαία** διανομή
 * (`allocateMillesimalsFromPercentages` σε ένα πέρασμα). Κατανομή ανά γραμμή είναι το σφάλμα
 * **τιμής** που έδινε 999‰ σε τρία αδέλφια (ADR-745 changelog 2026-08-05) — και ένα δεύτερο
 * αντίγραφο εδώ θα ξαναγεννούσε ακριβώς αυτό, σε άλλη διαδρομή.
 */
function reapportion(entries: readonly LandownerEntry[]): LandownerEntry[] {
  const statuses: Record<string, AcquisitionStatus> = {};
  for (const e of entries) {
    if (e.contactId && e.acquisitionStatus) statuses[e.contactId] = e.acquisitionStatus;
  }
  return toLandownerEntries(toPropertyOwners(entries), statuses);
}

export async function applyLandownerTarget(
  target: Extract<BindingTarget, { kind: 'landowner' }>,
  ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  // Γ6 — η πινακίδα αποδεικνύει ΟΝΟΜΑ, ποτέ μερίδιο. Το `0` δεν είναι «άγνωστο»: είναι δήλωση
  // ότι δεν κατέχει τίποτα, και θα δηλητηρίαζε την κατανομή χιλιοστών όλης της λίστας.
  const pct = ctx.landOwnershipPct;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return applyFailed('ownership percentage is required', 'MISSING_OWNERSHIP_PCT');
  }

  let snapshot;
  try {
    snapshot = await readProjectSnapshot(target.projectId);
  } catch (error) {
    return applyFailed(String(error), 'PROJECT_READ_FAILED');
  }

  const incoming: LandownerEntry = {
    contactId: target.contactId,
    name: ctx.snapshotValue,
    landOwnershipPct: pct,
    allocatedShares: 0, // ξαναϋπολογίζεται παρακάτω πάνω σε ΟΛΗ τη λίστα
    acquisitionStatus: target.acquisitionStatus,
  };

  const merged = mergeLandowner(snapshot.landowners, incoming);
  if (merged.alreadyPresent) {
    // Ιδεοδύναμο: ο άνθρωπος τον έχει ήδη δηλώσει. **Δεν** ξαναγράφουμε ποσοστό ή κατάσταση —
    // η πινακίδα δεν ξέρει περισσότερα από την καρτέλα, και μια «ενημέρωση» εδώ θα υποβίβαζε
    // υπογραφή που καταγράφηκε στο μεταξύ.
    return { success: true, detail: 'already-present' };
  }

  const result = await updateProjectWithPolicy({
    projectId: target.projectId,
    // 🔴 `'preserve'`: ο καμβάς **δεν έχει γνώμη** για την αντιπαροχή. Ένα `null` εδώ θα έσβηνε
    // το `bartexPercentage` που δήλωσε ο χρήστης στην καρτέλα — τρίτη απώλεια δεδομένων αυτού
    // του ADR, βρέθηκε από τον αντίπαλο κριτικό πριν γραφτεί γραμμή.
    updates: buildLandownersUpdate(reapportion(merged.entries), 'preserve'),
  });

  if (!result.success) {
    return applyFailed(result.error ?? 'project update failed', 'PROJECT_UPDATE_FAILED');
  }
  return { success: true };
}
