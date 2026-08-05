/**
 * @fileoverview Ο.Τ. → `Project.buildingBlock` · Δήμος/Περιοχή → η **κύρια** διεύθυνση.
 *
 * Δύο στόχοι σε ένα module γιατί είναι **η ίδια ερώτηση σε δύο βάθη**: «γράψε μια τιμή που
 * διάβασε η πινακίδα πάνω σε πεδίο του έργου». Χωριστά αρχεία θα ήταν δίδυμα (N.18).
 *
 * 🔴 **Το `project-address` έχει ΤΟ ΙΔΙΟ πρόβλημα με τους οικοπεδούχους**: το `Project.addresses`
 * είναι **πίνακας** και τα Firestore arrays αντικαθίστανται ολόκληρα. Άρα ισχύει η **ίδια**
 * πειθαρχία — ξαναδιάβασμα τη στιγμή του κλικ, συγχώνευση κατά `id`, καμία άλλη διεύθυνση δεν
 * ακουμπιέται.
 *
 * ⚠️ **Εμπλουτίζουμε υπάρχουσα διεύθυνση, ΔΕΝ φτιάχνουμε νέα.** Το `ProjectAddress` απαιτεί
 * `street`, `postalCode`, `country` (`types/project/addresses.ts:100-118`) — η πινακίδα δίνει
 * **μόνο** διοικητικά τμήματα. Μια «νέα διεύθυνση» θα γεννιόταν με τρία εφευρημένα πεδία, που
 * είναι ψέμα με σωστή μορφή. Χωρίς κύρια διεύθυνση, η πρόταση **μπλοκάρεται ορατά**.
 *
 * @module services/title-block-apply/apply-project-value
 */

import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import type { ProjectAddress } from '@/types/project/addresses';
import type { BindingTarget } from '@/types/title-block-binding';
import { readProjectSnapshot } from './project-snapshot';
import { applyFailed, type ApplyTargetContext, type ApplyTargetResult } from './apply-types';

/** Ο.Τ. — βαθμωτό πεδίο, κανένας πίνακας, καμία συγχώνευση. */
export async function applyProjectFieldTarget(
  target: Extract<BindingTarget, { kind: 'project-field' }>,
  _ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  const result = await updateProjectWithPolicy({
    projectId: target.projectId,
    updates: { [target.field]: target.value },
  });
  if (!result.success) {
    return applyFailed(result.error ?? 'project update failed', 'PROJECT_UPDATE_FAILED');
  }
  return { success: true };
}

/**
 * Ποια διεύθυνση δέχεται τον δήμο/την περιοχή.
 *
 * Το `isPrimary` είναι η **δηλωμένη** απάντηση του μοντέλου στο «ποια είναι η διεύθυνση του
 * έργου» (`types/project/addresses.ts:124`). Χωρίς αυτό, η επιλογή θα ήταν «η πρώτη του πίνακα»
 * — δηλαδή σιωπηλά η σειρά εισαγωγής, που σε έργο με 4 πρόσωπα οικοπέδου είναι τυχαία.
 */
function findPrimary(addresses: readonly ProjectAddress[]): ProjectAddress | undefined {
  return addresses.find((a) => a.isPrimary);
}

export async function applyProjectAddressTarget(
  target: Extract<BindingTarget, { kind: 'project-address' }>,
  _ctx: ApplyTargetContext,
): Promise<ApplyTargetResult> {
  let snapshot;
  try {
    snapshot = await readProjectSnapshot(target.projectId);
  } catch (error) {
    return applyFailed(String(error), 'PROJECT_READ_FAILED');
  }

  const primary = findPrimary(snapshot.addresses);
  if (!primary) {
    return applyFailed('project has no primary address', 'NO_PRIMARY_ADDRESS');
  }

  // Συγχώνευση κατά `id`: **μόνο** η κύρια αλλάζει, και **μόνο** στο ένα πεδίο. Ένα
  // `addresses: [updated]` θα έσβηνε τις υπόλοιπες — το ίδιο σχήμα με το Γ5.
  const addresses = snapshot.addresses.map((a) =>
    a.id === primary.id ? { ...a, [target.field]: target.value } : a,
  );

  const result = await updateProjectWithPolicy({
    projectId: target.projectId,
    updates: { addresses },
  });
  if (!result.success) {
    return applyFailed(result.error ?? 'project update failed', 'PROJECT_UPDATE_FAILED');
  }
  return { success: true };
}
