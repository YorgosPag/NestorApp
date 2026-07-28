/**
 * ADR-722 — ΤΟ ΞΑΝΑ-ΨΗΣΙΜΟ ΑΝΤΙΚΑΘΙΣΤΑ, ΔΕΝ ΣΤΟΙΒΑΖΕΙ.
 *
 * ── Το σφάλμα που κλείνει (μετρημένο 2026-07-28) ──────────────────────────────────────────
 * Οι τρεις παραγωγοί ψημένων προϊόντων ήταν **add-only** και γεννούσαν φρέσκο τυχαίο id σε κάθε
 * κλήση, ενώ η σφραγίδα του πλαισίου (§M10g) μπαίνει **ανά ΟΜΑΔΑ**. Ένα δεύτερο ψήσιμο πάνω σε
 * υπάρχουσα (π.χ. legacy, ασφράγιστη) γεωμετρία έκανε ταυτόχρονα τρία κακά:
 *
 *   1. **στοίβαζε διπλότυπα** — 33 σημεία × 2 οντότητες = 66 νέες ΠΑΝΩ στις 66 παλιές·
 *   2. **έκανε τη σφραγίδα ψέμα** — ισχυριζόταν ότι *όλη* η ομάδα κάθεται στο ενεργό πλαίσιο,
 *      ενώ οι παλιές κάθονταν στο προηγούμενο (≈4·10⁸ mm μακριά ⇒ αόρατες, ADR-635 culling)·
 *   3. **έκλεινε οριστικά τον δρόμο της αυτο-ίασης** — ο reconciler βλέπει πλέον σφραγίδα, άρα
 *      δεν θα ξανακοιτάξει ποτέ αυτή την ομάδα. Σιωπηλή, μόνιμη απώλεια.
 *
 * Το §M10g έλεγε στον χρήστη «η θεραπεία είναι ένα ξανα-ψήσιμο» — αλλά το ξανα-ψήσιμο **δεν
 * θεράπευε τίποτα**. Εδώ γίνεται αληθινό.
 *
 * ── Πώς το κάνουν οι μεγάλοι ──────────────────────────────────────────────────────────────
 * Ο κοινός αναλλοίωτος και των τριών είναι **ταυτότητα, όχι προσάρτηση**:
 *   • **Revit** «Tag All Not Tagged» — λειτουργεί μόνο σε στοιχεία **χωρίς** tag· τα ήδη
 *     tagged δεν αγγίζονται ⇒ μηδέν διπλότυπα ΚΑΙ το σύρσιμο του χρήστη επιβιώνει.
 *   • **Civil 3D** — η ετικέτα είναι αντικείμενο **της πηγής** (COGO point / surface), μία ανά
 *     σημείο ανά στυλ· διπλές ετικέτες υπάρχουν μόνο ως τεκμηριωμένο σφάλμα (`AeccViewportOpt`).
 *   • **ArchiCAD** — το Label είναι **associative** στο στοιχείο· το «independent» είναι ρητή,
 *     ξεχωριστή επιλογή.
 *
 * ── Πού πάμε πιο πέρα ─────────────────────────────────────────────────────────────────────
 * Ο Revit αφήνει **ορφανά** tags όταν σβήσεις το στοιχείο· ο Civil 3D έχει το γνωστό desync της
 * label cache. Εδώ το ξανα-ψήσιμο είναι **ολικό για την ομάδα**: ό,τι δεν παράγεται πια,
 * αφαιρείται στην ίδια πράξη — άρα δεν υπάρχει κατάσταση «ορφανό» για να διαχειριστεί κανείς.
 *
 * ── Η ταυτότητα ΥΠΑΡΧΕΙ ΗΔΗ — δεν εφευρίσκεται πεδίο ─────────────────────────────────────
 * Το ερώτημα «ποια οντότητα αντικαθιστά ποια» **δεν** χρειάζεται νέο `bakedKey` στο `BaseEntity`.
 * Το §M10g έχει ήδη δηλώσει την ταυτότητα σε επίπεδο **ομάδας** (`topo-baked-groups`: layers →
 * ομάδα), και η αντικατάσταση είναι εξ ορισμού ολική: ο παραγωγός παράγει **ολόκληρη** την
 * ομάδα κάθε φορά. Ένα πεδίο ανά οντότητα θα ήταν δεύτερη έννοια ταυτότητας δίπλα σε μία που
 * ήδη δουλεύει (N.18) — και, κρίσιμα, **οι legacy οντότητες δεν θα το είχαν ποτέ**, δηλαδή
 * ακριβώς αυτές που πρέπει να καθαριστούν θα ήταν οι μόνες αόρατες στον μηχανισμό.
 *
 * Καθαρό module: σκηνή μέσα → σχέδιο έξω. Μηδέν store, μηδέν εγγραφή, μηδέν React.
 *
 * @see ./topo-bake-commit.ts — ο μοναδικός εκτελεστής του σχεδίου
 * @see ./topo-baked-groups.ts — `placement`: ποιος κατέχει τη θέση
 */

import type { SceneModel, AnySceneEntity } from '../../types/scene';
import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { resolveEntityBounds } from '../../rendering/hitTesting/entity-bounds-ssot';
import { translateEntityByAnchor } from '../stretch/stretch-entity-transform';
import type { TopoBakedGroup } from './topo-baked-groups';
import { bakedGroupSpec } from './topo-baked-groups';
import { bakedGroupIndices, indexBakedGroups } from './topo-baked-scan';

/** Τι πρέπει να συμβεί στη σκηνή ώστε η ομάδα να περιέχει **ακριβώς** τα φρέσκα προϊόντα. */
export interface BakedUpsertPlan {
  /** Οι ids των υπαρχουσών οντοτήτων της ομάδας που αντικαθίστανται (undoable διαγραφή). */
  readonly replacedIds: readonly string[];
  /**
   * Οι οντότητες που γράφονται — **οι ίδιες** που έδωσε ο παραγωγός για ομάδα `derived`, ή
   * μετατοπισμένες στη θέση που είχε δώσει ο χρήστης για ομάδα `user`.
   */
  readonly entities: readonly Entity[];
  /** Πόσο μετατοπίστηκαν τα φρέσκα ώστε να σεβαστούν τη θέση του χρήστη (`null` ⇒ καθόλου). */
  readonly userPlacementMm: Point2D | null;
}

/**
 * Σχεδίασε το ξανα-ψήσιμο μιας ομάδας πάνω στην τρέχουσα σκηνή.
 *
 * Πρώτο ψήσιμο (καμία υπάρχουσα οντότητα) ⇒ ταυτοτικό σχέδιο: τίποτα να αντικατασταθεί, τίποτα
 * να μετατοπιστεί, **η ίδια αναφορά** πίνακα επιστρέφεται. Δηλαδή ο συνήθης δρόμος δεν πληρώνει
 * τίποτα για μια δυνατότητα που αφορά το *δεύτερο* πάτημα του κουμπιού.
 */
export function planBakedUpsert(
  scene: SceneModel | null,
  group: TopoBakedGroup,
  fresh: readonly Entity[],
): BakedUpsertPlan {
  if (!scene) return { replacedIds: [], entities: fresh, userPlacementMm: null };

  const previous = bakedGroupIndices(indexBakedGroups(scene), group)
    .map((index) => scene.entities[index]);
  if (previous.length === 0) return { replacedIds: [], entities: fresh, userPlacementMm: null };

  const replacedIds = previous.map((entity) => entity.id);
  if (bakedGroupSpec(group).placement === 'derived') {
    return { replacedIds, entities: fresh, userPlacementMm: null };
  }

  const shift = userPlacementShift(previous, fresh);
  return {
    replacedIds,
    entities: shift ? fresh.map((e) => translated(e, shift)) : fresh,
    userPlacementMm: shift,
  };
}

/**
 * Πόσο έχει «μετακομίσει» η ομάδα σε σχέση με το πού θα την έβαζε ένα φρέσκο ψήσιμο — δηλαδή
 * **η τοποθέτηση που έδωσε ο χρήστης**, εκφρασμένη ως μετατόπιση.
 *
 * ## Γιατί το ΚΕΝΤΡΟ των ορίων και όχι η γωνία τους
 * Ο βορράς δεν αλλάζει μόνο θέση ανάμεσα σε δύο ψησίματα — μπορεί να έχει αλλάξει και **γωνία**
 * (νέα γεωαναφορά ⇒ άλλος πραγματικός Βορράς). Το ελάχιστο άκρο ενός στραμμένου σχήματος
 * μετακινείται με τη στροφή, οπότε μια σύγκριση γωνία-προς-γωνία θα κατέγραφε τη στροφή ως
 * «σύρσιμο του χρήστη» και θα μετακινούσε το σύμβολο σε κάθε επανάληψη. Το **κέντρο** μένει
 * σταθερό υπό στροφή γύρω από αυτό — που είναι ακριβώς πώς περιστρέφεται ένα σύμβολο χαρτιού.
 *
 * `null` όταν κάποιο από τα δύο σύνολα δεν έχει μετρήσιμα όρια (τύπος χωρίς provider): δεν
 * εφευρίσκουμε γεωμετρία, και η μη-μετατόπιση είναι η ασφαλής απάντηση.
 */
function userPlacementShift(
  previous: readonly AnySceneEntity[],
  fresh: readonly Entity[],
): Point2D | null {
  const before = centerOfEntities(previous as unknown as readonly Entity[]);
  const after = centerOfEntities(fresh);
  if (!before || !after) return null;
  const shift = { x: before.x - after.x, y: before.y - after.y };
  return shift.x === 0 && shift.y === 0 ? null : shift;
}

/** Το κέντρο του συνολικού πλαισίου μιας ομάδας οντοτήτων (`null` ⇒ κανένα μετρήσιμο όριο). */
function centerOfEntities(entities: readonly Entity[]): Point2D | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const entity of entities) {
    const bounds = resolveEntityBounds(entity);
    if (!bounds) continue; // τύπος χωρίς provider — δεν εφευρίσκουμε γεωμετρία
    if (bounds.minX < minX) minX = bounds.minX;
    if (bounds.minY < minY) minY = bounds.minY;
    if (bounds.maxX > maxX) maxX = bounds.maxX;
    if (bounds.maxY > maxY) maxY = bounds.maxY;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/**
 * Μία οντότητα μετατοπισμένη — μέσω του ΥΠΑΡΧΟΝΤΟΣ SSoT (ADR-349/397), του ίδιου που
 * χρησιμοποιεί ο reconciler για το delta πλαισίου. Ούτε ένα `+ dx` δεν γράφεται εδώ (N.18).
 */
function translated(entity: Entity, shift: Point2D): Entity {
  return { ...entity, ...translateEntityByAnchor(entity, shift) } as Entity;
}
