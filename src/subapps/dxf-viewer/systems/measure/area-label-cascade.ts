/**
 * area-label-cascade — ADR-649 §associative · ο **scene-derived reconciler** της ζωντανής
 * ετικέτας εμβαδού.
 *
 * **ΔΕΝ ΕΙΝΑΙ ΝΕΟΣ ΜΗΧΑΝΙΣΜΟΣ.** Είναι ένας ακόμη reconciler της **υπάρχουσας** universal
 * SSoT του ADR-540 (`bim/cascade/associative-geometry-reconcile`) — μπαίνει στη λίστα δίπλα
 * στα «ανοίγματα → τοίχος» και «δοκάρια → όψεις κολόνας», και κληρονομεί **δωρεάν** και τα
 * δύο call sites της (`MergeableUpdateCommand` για params-edits, `SnapshotTransformCommand`
 * για μετασχηματισμούς). Γι' αυτό η γραμμοσκίαση δουλεύει χωρίς **καμία** νέα καλωδίωση:
 * το `UpdateHatchBoundaryCommand` **είναι** `MergeableUpdateCommand`.
 *
 * Ανήκει στην κατηγορία **scene-derived** (ADR-540): ιδεμποτεντικό, διαβάζει την **τρέχουσα**
 * σκηνή, δεν χρειάζεται delta. Το εμβαδόν δεν «ακολουθεί» μια μετατόπιση — **ξαναμετριέται**.
 *
 * 🔴 **ΓΙΑΤΙ command-time ΚΑΙ ΟΧΙ reactive effect (ADR-492 §4 — μην το αγνοήσεις):** ένας
 * effect που άκουγε `bim:entities-moved` και ξανα-εξέπεμπε geometry event έκανε **βρόχο** με
 * τον proactive analysis cycle → **storm/freeze**. Εδώ ο επανυπολογισμός τρέχει **σύγχρονα
 * μέσα στην εντολή** και η ιδεμποτεντικότητα (αμετάβλητο κείμενο ⇒ κανένα patch, κανένα
 * emit) εγγυάται ότι ο κύκλος συγκλίνει στο δεύτερο πέρασμα.
 *
 * **ΕΝΑΣ μηχανισμός, ΟΛΟΙ οι τύποι.** Ο cascade δεν ξέρει τι είναι η πηγή — ρωτά το
 * `entityMeasurementFacts` μέσω του `areaLabelRefreshPatch`. Γραμμοσκίαση, τοπογραφική επιφάνεια
 * και ό,τι αποκτήσει εμβαδόν αύριο περνούν από **εδώ**· δεν υπάρχει topo-only δίδυμο.
 *
 * @see ../../bim/cascade/associative-geometry-reconcile — η universal SSoT (ADR-540)
 * @see ./area-label — `areaLabelRefreshPatch` (τι κείμενο· ιδεμποτεντικό σήμα `null`)
 * @see ./entity-measurement-facts — «τι εμβαδόν δίνει αυτή η οντότητα;»
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

import type { Entity, TextEntity } from '../../types/entities';
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import { areaLabelRefreshPatch } from './area-label';

/** Το ελάχιστο scene surface που χρειάζεται ο cascade (mirror `CascadeSceneManager`). */
type AreaLabelSceneManager = Pick<ISceneManager, 'getEntity' | 'updateEntity'> & {
  getEntities?(): readonly SceneEntity[];
};

/** Οι ετικέτες που κρατούν associative σύνδεσμο — σκέτο πεδίο, κανένα cast (N.2). */
function associativeAreaLabels(entities: readonly SceneEntity[]): TextEntity[] {
  const labels: TextEntity[] = [];
  for (const e of entities) {
    const candidate = e as unknown as Partial<TextEntity>;
    if (candidate.type === 'text' && typeof candidate.areaSourceId === 'string') {
      labels.push(candidate as TextEntity);
    }
  }
  return labels;
}

/**
 * Ξανα-υπολογίζει τις ετικέτες εμβαδού που δείχνουν σε μία από τις `changedIds`, και
 * επιστρέφει **μόνο** όσες πραγματικά άλλαξαν (ο καλών τις στέλνει σε ΕΝΑ event).
 *
 * **Δύο κατευθύνσεις, ένας κώδικας** — γιατί διαβάζει την τρέχουσα σκηνή αντί για delta:
 *   - η πηγή υπάρχει  → νέο εμβαδόν (ή τίποτα, αν το κείμενο βγήκε ίδιο)
 *   - η πηγή λείπει   → ορφανή ένδειξη «####»
 *   - η πηγή **επέστρεψε** (undo διαγραφής) → ξανα-συνδέεται μόνη της, χωρίς ειδική διαδρομή
 *
 * Ο έλεγχος `changedIds` είναι **πύλη κόστους**: χωρίς αυτόν κάθε μετακίνηση οποιασδήποτε
 * οντότητας θα ξανα-υπολόγιζε **κάθε** ετικέτα της σκηνής — και ο υπολογισμός της
 * τοπογραφικής διαβάζει το TIN.
 *
 * ⚠️ Γράφει με **raw `updateEntity`**, ΟΧΙ με νέα command: ο cascade τρέχει **ήδη μέσα** σε
 * εντολή, και μια εμφωλευμένη command θα έσπαγε το undo σε δύο βήματα (ο χρήστης θα έκανε
 * undo και θα έμενε η μισή αλλαγή). Ίδια σύμβαση με τους υπόλοιπους reconcilers του ADR-540.
 */
export function cascadeAreaLabels(
  changedIds: readonly string[],
  sceneManager: AreaLabelSceneManager,
): SceneEntity[] {
  if (changedIds.length === 0) return [];
  const entities = sceneManager.getEntities?.();
  if (!entities || entities.length === 0) return [];

  const changed = new Set(changedIds);
  const updated: SceneEntity[] = [];

  for (const label of associativeAreaLabels(entities)) {
    if (!label.areaSourceId || !changed.has(label.areaSourceId)) continue;
    const source = (sceneManager.getEntity(label.areaSourceId) ?? null) as Entity | null;
    const patch = areaLabelRefreshPatch(label, source);
    if (!patch) continue; // αμετάβλητο → καμία εγγραφή, κανένα emit (idempotency)
    sceneManager.updateEntity(label.id, patch as Partial<SceneEntity>);
    updated.push({ ...(label as unknown as SceneEntity), ...(patch as Partial<SceneEntity>) });
  }
  return updated;
}
