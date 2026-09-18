/**
 * @fileoverview **ΕΥΡΟΣ ΤΙΜΗΣ ΜΕ ΜΟΝΑΔΑ** — το φίλτρο «Τιμή από/έως» των εσωτερικών οθονών.
 * @related ADR-777 §8.60.14.14 (Φάση 4) · §8.60.14.11 (Φάση 2, η δημόσια αναζήτηση) · lib/properties/price-by-role.ts
 * @module lib/properties/price-range
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ (2026-09-18)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τέσσερις μηχανές φίλτρων (διαχείριση ακινήτων, σελίδες πωλήσεων θέσεων/αποθηκών, αποθήκες,
 * ακίνητα πωλήσεων) έκριναν «έως 1.000 €» πάνω στο `priceSortKey` / `getEffectivePrice` —
 * **ποσό χωρίς ρόλο**. Το «έως 1.000» δεχόταν ενοίκιο 900 €/μήνα, διανυκτέρευση 50 €/νύχτα και
 * θα δεχόταν αποθήκη προς πώληση 800 €: τρία μεγέθη κριμένα με έναν αριθμό. Μία (αποθήκες)
 * διάβαζε ακόμη το @deprecated flat `price`.
 *
 * 🔑 **Η ΑΠΟΦΑΣΗ (§8.60.14.2): κάθε ερώτηση για ποσό φέρει ΜΟΝΑΔΑ.** Εδώ η μονάδα ζει **μέσα**
 * στο ίδιο το εύρος ({@link RolePriceRange}): αριθμοί χωρίς ρόλο **δεν μπορούν** να εκφραστούν.
 * Πρότυπο **Rightmove** (επιλογέας μονάδας **μέσα** στο φίλτρο τιμής) + **Revit** (*«the filter
 * field and comparison value are of the same parameter type»*).
 *
 * ⚖️ **Η σημασιολογία της ΑΠΟΥΣΙΑΣ — και γιατί διαφέρει από τη δημόσια αναζήτηση, ρητά.** Στην
 * αναζήτηση (Φάση 2) ακίνητο χωρίς ποσό στη μονάδα του άξονα είναι `not-applicable`: εκεί η
 * «Διάθεση» είναι **χωριστός** άξονας και η λογιστική γράφει ό,τι δεν κρίθηκε. Οι εσωτερικές
 * οθόνες είναι πίνακες με **ένα** κριτήριο τιμής, και το έργο έχει ήδη δηλώσει τη σύμβασή τους
 * (`useSalesSpaceViewerState` → `matchesRange`): **ενεργό εύρος απέναντι σε απουσία = όπως το
 * `WHERE rent <= 900` της SQL** — η γραμμή βγαίνει. «Ενοίκιο έως 900 €/μήνα» σημαίνει «όσα
 * **νοικιάζονται** έως 900», όχι «όσα νοικιάζονται έως 900 **και** όλα τα προς πώληση». Ποτέ
 * όμως δεν συγκρίνεται ποσό **άλλης** μονάδας — αυτό είναι το αμετακίνητο.
 *
 * ⛔ **ΚΑΝΕΝΑ δεύτερο κλειδί τιμής**: το ποσό του ρόλου το δίνει ο ΕΝΑΣ
 * {@link resolvePriceForRole} (ADR-777 §8.60.15) — άρα «πώληση **και** ενοικίαση» απαντά **και**
 * σε εύρος ενοικίου, με το ενοίκιο της.
 */

import { resolvePriceForRole } from '@/lib/properties/price-by-role';
import {
  PRICE_ROLES,
  type PricedPropertyLike,
  type PriceRole,
} from '@/lib/properties/price-resolver';

/**
 * **Ένα εύρος τιμής ΣΕ ΜΙΑ ΜΟΝΑΔΑ.** Ο ρόλος είναι **υποχρεωτικός**: αριθμοί χωρίς μονάδα δεν
 * μεταγλωττίζονται. `min`/`max` απόντα (ή `null`) ⇒ ανοιχτό άκρο.
 */
export interface RolePriceRange {
  readonly role: PriceRole;
  readonly min?: number | null;
  readonly max?: number | null;
}

/**
 * **Το κενό εύρος** — καμία ερώτηση ακόμη. Ο ρόλος του είναι ο **πρώτος της δηλωμένης σειράς**
 * (`PRICE_ROLES`, προβολή του `OFFER_KINDS`) και **φαίνεται** στον επιλογέα: δεν είναι κρυφή
 * εικασία, είναι η αρχική τιμή ενός ορατού χειριστηρίου.
 */
export const EMPTY_PRICE_RANGE: RolePriceRange = Object.freeze({ role: PRICE_ROLES[0] });

const isBound = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Κάνει το εύρος **κάποια** ερώτηση; */
export function isPriceRangeActive(range: RolePriceRange | null | undefined): boolean {
  return !!range && (isBound(range.min) || isBound(range.max));
}

/**
 * **Περνά αυτό το ακίνητο το εύρος;** Ο ΕΝΑΣ κριτής του «Τιμή από/έως» των εσωτερικών οθονών.
 *
 * - ανενεργό εύρος ⇒ `true` (καμία ερώτηση)
 * - ποσό **στη μονάδα του εύρους** ⇒ κρίνεται με τα όρια
 * - κανένα ποσό σε αυτή τη μονάδα (άλλος ρόλος ή χωρίς τιμή) ⇒ `false` — η σύμβαση `WHERE`
 *   (δες κεφαλίδα)· **ποτέ** σύγκριση με ποσό άλλης μονάδας.
 */
export function matchesPriceRange(
  item: PricedPropertyLike,
  range: RolePriceRange | null | undefined,
): boolean {
  if (!range || !isPriceRangeActive(range)) return true;

  const amount = resolvePriceForRole(item, range.role)?.amount;
  if (amount === undefined) return false;

  if (isBound(range.min) && amount < range.min) return false;
  if (isBound(range.max) && amount > range.max) return false;
  return true;
}
