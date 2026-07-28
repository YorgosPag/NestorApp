/**
 * ADR-650 §M10g / ADR-722 — Η ΜΙΑ ΑΝΑΓΝΩΣΗ ΤΗΣ ΣΚΗΝΗΣ: «ποιες οντότητες ανήκουν σε ποια ομάδα».
 *
 * ── Γιατί ξεχωριστό module ─────────────────────────────────────────────────────────────────
 * Την ίδια ερώτηση τη ρωτούν **δύο** διαφορετικοί δρόμοι, για δύο διαφορετικούς λόγους:
 *
 *   • ο **reconciler** (`topo-frame-reconcile`) — «ποιες πρέπει να μετακινήσω στο νέο πλαίσιο;»
 *   • η **ραφή του ψησίματος** (`topo-bake-commit`) — «τι υπάρχει ήδη εδώ, ώστε το νέο ψήσιμο να
 *     **αντικαταστήσει** αντί να στοιβάξει;» (ADR-722)
 *
 * Δύο αντίγραφα της απάντησης θα απέκλιναν σιωπηλά την πρώτη φορά που θα προστεθεί ομάδα ή θα
 * αλλάξει το κριτήριο — και η απόκλιση θα εμφανιζόταν ως «ο reconciler βλέπει 66 οντότητες, το
 * ψήσιμο βλέπει 0», δηλαδή ακριβώς το είδος σιωπής που το §M10g υπάρχει για να απαγορεύσει.
 *
 * ── Γιατί ΕΝΑ πέρασμα ──────────────────────────────────────────────────────────────────────
 * Η προηγούμενη μορφή (ιδιωτική στον reconciler) σάρωνε τον πίνακα οντοτήτων **μία φορά ανά
 * ομάδα**. Με τρεις ομάδες αυτό είναι 3×N σε μια διαδρομή που τρέχει σε κάθε φόρτωση, κάθε
 * αλλαγή ορόφου και κάθε αλλαγή γεωαναφοράς, πάνω σε σκηνές δεκάδων χιλιάδων οντοτήτων. Το
 * ευρετήριο χτίζεται σε **ένα** πέρασμα και απαντά σε όλες.
 *
 * Καθαρό: μηδέν store, μηδέν React, μηδέν εγγραφή.
 *
 * @see ./topo-baked-groups.ts — ο δηλωτικός πίνακας (layers → ομάδα)
 * @see ./topo-bake-upsert.ts — ο καταναλωτής της «τι υπάρχει ήδη» πλευράς
 */

import type { SceneModel } from '../../types/scene';
import type { TopoBakedGroup } from './topo-baked-groups';
import { bakedGroupOfLayerName, TOPO_BAKED_GROUP_IDS } from './topo-baked-groups';
import type { TopoLevelBakedFrames } from './topo-baked-frame-store';

/**
 * Οι **θέσεις** των οντοτήτων κάθε ομάδας μέσα στο `scene.entities`.
 *
 * Θέση και όχι id: η θέση **είναι** το z-order (ADR-661), και ο reconciler αντικαθιστά επί
 * τόπου — ένα ευρετήριο ids θα τον ανάγκαζε σε δεύτερη αναζήτηση ανά οντότητα.
 * Ομάδα χωρίς οντότητες **απουσιάζει** από το map (ποτέ άδειος πίνακας-φάντασμα).
 */
export type BakedGroupIndex = ReadonlyMap<TopoBakedGroup, readonly number[]>;

/** Ένα πέρασμα: layerId → ομάδα, μέσω του ΟΝΟΜΑΤΟΣ του layer (τα ids γεννιούνται ανά σκηνή). */
function groupByLayerId(scene: SceneModel): ReadonlyMap<string, TopoBakedGroup> {
  const out = new Map<string, TopoBakedGroup>();
  for (const layer of Object.values(scene.layersById)) {
    const group = bakedGroupOfLayerName(layer.name);
    if (group) out.set(layer.id, group);
  }
  return out;
}

/** Το ευρετήριο ομάδα → θέσεις, σε ΕΝΑ πέρασμα του πίνακα οντοτήτων. */
export function indexBakedGroups(scene: SceneModel): BakedGroupIndex {
  const byLayer = groupByLayerId(scene);
  const out = new Map<TopoBakedGroup, number[]>();
  if (byLayer.size === 0) return out; // καμία ψημένη ομάδα στη σκηνή — μηδέν κόστος
  scene.entities.forEach((entity, index) => {
    if (entity.layerId === undefined) return;
    const group = byLayer.get(entity.layerId);
    if (group === undefined) return;
    const bucket = out.get(group);
    if (bucket) bucket.push(index);
    else out.set(group, [index]);
  });
  return out;
}

/** Οι θέσεις μιας ομάδας (κενός πίνακας όταν η ομάδα δεν έχει ψημένη γεωμετρία). */
export function bakedGroupIndices(index: BakedGroupIndex, group: TopoBakedGroup): readonly number[] {
  return index.get(group) ?? EMPTY_INDICES;
}

const EMPTY_INDICES: readonly number[] = [];

/**
 * Οι ομάδες με ψημένη γεωμετρία αλλά **χωρίς σφραγίδα** — δηλαδή αυτές για τις οποίες κανείς
 * δεν ξέρει σε ποιο πλαίσιο κάθονται (§M10g fail-closed).
 *
 * Ίδιο κριτήριο με τον reconciler, **από την ίδια συνάρτηση**: το κόκκινο μήνυμα του
 * `TopoFrameNotice` και η απόφαση «μετακινώ / δεν αγγίζω» δεν επιτρέπεται να διαφωνήσουν.
 * Η σειρά ακολουθεί τον δηλωτικό πίνακα (σταθερή — οι αναφορές δεν χοροπηδούν).
 */
export function unstampedBakedGroups(
  scene: SceneModel,
  bakedFrames: TopoLevelBakedFrames,
  index: BakedGroupIndex = indexBakedGroups(scene),
): readonly TopoBakedGroup[] {
  const out: TopoBakedGroup[] = [];
  for (const [group, indices] of orderedEntries(index)) {
    if (indices.length === 0) continue;
    if (!bakedFrames[group]) out.push(group);
  }
  return out;
}

/**
 * Οι εγγραφές του ευρετηρίου στη **δηλωμένη** σειρά των ομάδων, όχι στη σειρά εισαγωγής του Map.
 *
 * Η σειρά διαβάζεται από τον ΙΔΙΟ δηλωτικό πίνακα με όλα τα υπόλοιπα (`TOPO_BAKED_GROUP_IDS`) —
 * καμία δεύτερη απαρίθμηση ομάδων που θα ξεχνιόταν όταν προστεθεί η τέταρτη.
 */
function orderedEntries(index: BakedGroupIndex): [TopoBakedGroup, readonly number[]][] {
  return TOPO_BAKED_GROUP_IDS
    .filter((group) => index.has(group))
    .map((group) => [group, index.get(group) as readonly number[]]);
}
