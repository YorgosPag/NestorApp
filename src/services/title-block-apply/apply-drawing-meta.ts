/**
 * @fileoverview Κλίμακα / χρόνος / αριθμός / είδος → το **επίπεδο** του σχεδίου (ADR-759 Φ3).
 *
 * Τα μεταδεδομένα ανήκουν στο **φύλλο**, ποτέ στο ακίνητο (ADR-745 §7): ένα έργο έχει δεκάδες
 * σχέδια σε άλλες κλίμακες και ημερομηνίες, και γραμμένα στο έργο το τελευταίο που ανοίγεις θα
 * έσβηνε σιωπηλά το προηγούμενο.
 *
 * 🔴 **Ένα πεδίο ανά αίτημα, και αυτό ΔΕΝ είναι απροσεξία.** Η έγκριση είναι **ανά πρόταση**:
 * ο μηχανικός δέχεται την κλίμακα και απορρίπτει την ημερομηνία. Ένα συγκεντρωτικό PATCH θα
 * έγραφε πράγματα που κανείς δεν ενέκρινε — ο §8 κανόνας 1 του ADR-745 ανάποδα.
 *
 * ⚠️ **Καμία δεύτερη πύλη εγγραφής**: περνά από το `updateDxfLevelWithPolicy` (ADR-286), όπως
 * κάθε άλλη μεταβολή επιπέδου. Ένα direct fetch εδώ θα ήταν διαδρομή με δικό της μοντέλο
 * ασφαλείας, ακριβώς ό,τι απαγορεύει το `project-snapshot.ts` για τα έργα.
 *
 * @module services/title-block-apply/apply-drawing-meta
 */

import { updateDxfLevelWithPolicy } from '@/services/dxf-level-mutation-gateway';
import { getErrorMessage } from '@/lib/error-utils';
import type { BindingTarget } from '@/types/title-block-binding';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

export async function applyDrawingMetaTarget(
  target: Extract<BindingTarget, { kind: 'drawing-meta' }>,
  _ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  try {
    const result = await updateDxfLevelWithPolicy({
      payload: { levelId: target.levelId, [target.field]: target.value },
    });
    if (!result.success) {
      return applyFailed(result.error ?? 'level update failed', 'LEVEL_UPDATE_FAILED');
    }
    return { success: true };
  } catch (error) {
    // 🔴 **Το `catch` ΔΕΝ είναι διακοσμητικό εδώ.** Ο handler απαντά **400 «No fields to
    // update»** όταν το πεδίο δεν φτάσει στη δική του allowlist — και ο `apiClient` το πετάει.
    // Χωρίς αυτό, ένα πεδίο δηλωμένο μόνο στο Zod schema θα έσκαγε ως ανεξήγητη εξαίρεση αντί
    // για αποτυχία με κωδικό, και ο Γ9 θα έχανε τη μία πληροφορία που τον κάνει να δουλεύει:
    // **γράφτηκε ο στόχος, ναι ή όχι;**
    return applyFailed(getErrorMessage(error), 'LEVEL_UPDATE_FAILED');
  }
}
