/**
 * mesh-silhouette-slots — ADR-683 Φ5: **per-slot** 2Δ κάτοψη εισαγόμενου πλέγματος (material poché).
 *
 * ## Το πρόβλημα
 *
 * Η Φ4 έβαφε **όλη** τη σιλουέτα με το **dominant** (πρώτο) υλικό — η καρέκλα Aeron = δέρμα → όλο το
 * σχήμα σκούρο. Οι μεγάλοι (Revit/ArchiCAD) στην κάτοψη κάνουν **material poché**: κάθε περιοχή στο
 * χρώμα του δικού της υλικού (βάση=μέταλλο, κάθισμα=πλέγμα, μπράτσα=δέρμα). Καμία σκίαση κατ' ύψος —
 * αυτό ανήκει στο 3Δ. Το per-slot χρώμα είναι το πιο ρεαλιστικό που κάνει κάτοψη.
 *
 * ## Πώς
 *
 * Reuse **ακέραιο** τον πυρήνα του `mesh-silhouette` (SSoT): το `collectProjectedTrisTagged` δίνει τα
 * τρίγωνα ήδη ταξινομημένα ανά material slot + ύψος· ομαδοποιούμε ανά slot και τρέχουμε το κοινό
 * `contoursFromTriangles` (multi-component — τα δύο μπράτσα = δύο δαχτυλίδια). Κανένα δεύτερο
 * rasterise/trace μονοπάτι.
 *
 * ## Σειρά ζωγραφικής (painters, όχι σκίαση)
 *
 * Τα slots επιστρέφονται ταξινομημένα **από το χαμηλότερο προς το ψηλότερο** (mean worldY). Ο
 * ζωγράφος τα βάφει με αυτή τη σειρά, ώστε το ψηλότερο κομμάτι να καλύπτει το χαμηλότερο σε επικάλυψη
 * — ακριβώς τι βλέπεις από πάνω (η κορυφαία επιφάνεια κάθε σημείου). Occlusion order, **όχι**
 * gradient/σκίαση ύψους.
 *
 * @see ./mesh-silhouette — collectProjectedTrisTagged + contoursFromTriangles (κοινός πυρήνας)
 * @see ../renderers/mesh-silhouette-draw — ο per-slot ζωγράφος (drawMeshSlotSilhouettes)
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.6
 */

import type * as THREE from 'three';
import {
  collectProjectedTrisTagged,
  contoursFromTriangles,
  type SilPoint,
} from './mesh-silhouette';

/** Η κάτοψη ενός material slot: τα (πιθανώς πολλαπλά) δαχτυλίδια του + ύψος για σειρά ζωγραφικής. */
export interface SlotSilhouette {
  /** Όνομα υλικού του slot (→ preset χρώμα)· `null` για ανώνυμο/single-material. */
  readonly materialName: string | null;
  /** Ένα ή περισσότερα κλειστά περιγράμματα (plan meters) — multi-component ανά slot. */
  readonly contours: readonly (readonly SilPoint[])[];
  /** Mean ύψος (worldY, m) του slot — painters ordering (χαμηλότερο πρώτο). */
  readonly order: number;
}

interface SlotAccum {
  readonly tris: Float32Array[];
  ySum: number;
}

/**
 * Οι per-slot σιλουέτες ενός φορτωμένου πλέγματος (un-placed template), ταξινομημένες από κάτω προς
 * πάνω. Κενό array όταν δεν τραβιέται τίποτα (renderer πέφτει στη single silhouette / ορθογώνιο).
 */
export function computeTopSilhouettePerSlot(obj: THREE.Object3D): SlotSilhouette[] {
  obj.updateMatrixWorld(true);

  const bySlot = new Map<string | null, SlotAccum>();
  for (const t of collectProjectedTrisTagged(obj)) {
    let acc = bySlot.get(t.slot);
    if (!acc) { acc = { tris: [], ySum: 0 }; bySlot.set(t.slot, acc); }
    acc.tris.push(t.xz);
    acc.ySum += t.y;
  }

  const slots: SlotSilhouette[] = [];
  for (const [materialName, acc] of bySlot) {
    const contours = contoursFromTriangles(acc.tris);
    if (contours.length > 0) {
      slots.push({ materialName, contours, order: acc.ySum / acc.tris.length });
    }
  }

  slots.sort((a, b) => a.order - b.order);
  return slots;
}
