/**
 * @fileoverview **ΔΕΙΧΝΕΙ ΑΥΤΟ ΤΟ ΕΠΙΠΕΔΟ ΤΟ ΑΚΙΝΗΤΟ ΟΠΟΥ ΔΗΜΟΣΙΕΥΕΤΑΙ;** — ο δομικός δεσμός (ADR-909 Β1).
 * @related app/api/properties/[id]/floorplan (ο καλών) · types/property (`buildingId` · `floorId` · `levels`)
 * @module lib/listings/floorplan-level-binding
 *
 * 🌐 **Η πρακτική**: στη Zillow η διαδραστική κάτοψη βγαίνει **μόνο** από την περιήγηση της ίδιας
 * αγγελίας· στη Matterport παραγγέλνεται **ανά χώρο**· στο Revit/ACC δημοσιεύεις όψεις **του ίδιου
 * μοντέλου**. Σε κανέναν δεν *δηλώνει* ο άνθρωπος σε ποιο ακίνητο ανήκει το σχέδιο — ο δεσμός είναι
 * στα δεδομένα. Εδώ υπάρχει ήδη: το επίπεδο του viewer κρατά `buildingId` · `floorId`, το ακίνητο τα δικά του.
 *
 * 🔴 **Χωρίς αυτόν τον κριτή**, η πόρτα θα δεχόταν κάτοψη του **3ου** ορόφου στην αγγελία διαμερίσματος
 * του **1ου** — και θα τη δημοσίευε ως «Μετρημένη — υπολογισμένη από το σχέδιο».
 *
 * ⛔ **Καθαρό module** — δέχεται ωμά έγγραφα, δεν διαβάζει τίποτα.
 */

import { isPlainRecord } from '@/lib/type-guards';

/** Γιατί το επίπεδο **δεν** εξυπηρετεί το ακίνητο — το όνομα φτάνει ως τον άνθρωπο. */
type LevelBindingRefusal =
  /** Το επίπεδο δεν έχει τοποθετηθεί σε κτίριο: δεν μπορεί να αποδειχθεί ποιανού είναι. */
  | 'level-unplaced'
  /** Άλλο κτίριο. */
  | 'other-building'
  /** Ίδιο κτίριο, όροφος που το ακίνητο **δεν** καταλαμβάνει. */
  | 'other-floor';

type LevelBinding = { readonly ok: true } | { readonly ok: false; readonly why: LevelBindingRefusal };

function idOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * **Οι όροφοι που καταλαμβάνει το ακίνητο** — ο ένας του `floorId`, και όλοι των `levels` (μεζονέτα).
 * Κενό σύνολο ⇒ το ακίνητο δεν δηλώνει όροφο, και ο έλεγχος ορόφου **δεν έχει τι να συγκρίνει**.
 */
function propertyFloorIds(property: Readonly<Record<string, unknown>>): ReadonlySet<string> {
  const floors = new Set<string>();
  const primary = idOf(property.floorId);
  if (primary !== null) floors.add(primary);

  if (Array.isArray(property.levels)) {
    for (const level of property.levels as readonly unknown[]) {
      const floorId = isPlainRecord(level) ? idOf(level.floorId) : null;
      if (floorId !== null) floors.add(floorId);
    }
  }
  return floors;
}

/**
 * **Ίδιο κτίριο υποχρεωτικά· ίδιος όροφος όταν τον δηλώνουν και οι δύο.**
 *
 * ⚠️ Ο όροφος είναι **πρόσθετος** φρουρός, όχι προϋπόθεση: σχέδιο κτιρίου χωρίς όροφο (π.χ. τοπογραφικό)
 * ή ακίνητο χωρίς δηλωμένο όροφο δεν αποδεικνύουν ασυμφωνία — και *«δεν ξέρω»* δεν σημαίνει *«άλλος»*.
 * Το κτίριο όμως **πρέπει** να συμφωνεί: εκεί η άγνοια δεν είναι ανεκτή.
 *
 * @example
 * levelServesProperty({ buildingId: 'b1', floorId: 'f1' }, { buildingId: 'b1', floorId: 'f1' }); // { ok: true }
 * levelServesProperty({ buildingId: 'b1', floorId: 'f3' }, { buildingId: 'b1', floorId: 'f1' }); // other-floor
 */
export function levelServesProperty(
  level: Readonly<Record<string, unknown>>,
  property: Readonly<Record<string, unknown>>,
): LevelBinding {
  const levelBuilding = idOf(level.buildingId);
  if (levelBuilding === null) return { ok: false, why: 'level-unplaced' };
  if (levelBuilding !== idOf(property.buildingId)) return { ok: false, why: 'other-building' };

  const levelFloor = idOf(level.floorId);
  const floors = propertyFloorIds(property);
  if (levelFloor !== null && floors.size > 0 && !floors.has(levelFloor)) return { ok: false, why: 'other-floor' };

  return { ok: true };
}
