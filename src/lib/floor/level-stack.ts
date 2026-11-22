/**
 * @fileoverview **Η ΣΤΟΙΒΑ ΕΠΙΠΕΔΩΝ** μιας πολυεπίπεδης μονάδας (μεζονέτα, κατάστημα πολλών επιπέδων) — ο **ένας**
 * κανόνας γειτνίασης, καθαρός, κοινός στις Μονάδες (ADR-236) και στον υπολογιστή αντικειμενικής αξίας (ADR-898).
 * @module lib/floor/level-stack
 *
 * 🔑 Πρότυπο των μεγάλων: Revit (Base Constraint + Top Constraint) · ArchiCAD (Home Story + Top Link «Home+N»).
 * Στοιχείο πολλών ορόφων = **ΕΥΡΟΣ** συνεχόμενων ορόφων, όχι σύνολο: η εσωτερική σκάλα δεν πηδά όροφο. Άρα:
 *   - επόμενο επίπεδο = **μόνο** ο όροφος κάτω από τον χαμηλότερο ή πάνω από τον ψηλότερο ({@link levelStackNeighbours})·
 *   - αλλαγή ορόφου = **μετακίνηση όλου του εύρους** με το ίδιο βήμα ({@link shiftLevelStack}) — όπως η αλλαγή
 *     του Base Constraint μετακινεί το στοιχείο, όχι ένα κομμάτι του·
 *   - αφαίρεση = **μόνο από τα άκρα** ({@link isLevelStackEnd}) — το εύρος κονταίνει, δεν τρυπά.
 * Κενό στη μέση είναι έτσι **δομικά αδύνατο**, όχι προειδοποίηση.
 *
 * 🔑 Αριθμοί ορόφων ως έχουν (προσημασμένοι, ισόγειο = 0, ADR-903) — υπόγεια −1, −2… είναι κανονικοί όροφοι.
 * Οι **κάδοι** ενός πίνακα (π.χ. «ΣΤ' ή ψηλότερα» του νόμου) είναι θέμα **προβολής** του καταναλωτή, ποτέ της
 * στοίβας: μεζονέτα ΣΤ'+Ζ' είναι 6 και 7, όχι 6 και 6.
 *
 * `null` = επίπεδο χωρίς γνωστό όροφο (π.χ. αγγελία που δηλώνει πλήθος επιπέδων, όχι ορόφους) — εκτός στοίβας.
 */

/** Οι όροφοι όπου μπορεί να μπει το **επόμενο** επίπεδο. `null` ανά πλευρά = εκτός ορίων. */
export interface LevelStackNeighbours {
  readonly below: number | null;
  readonly above: number | null;
}

/** Προαιρετικά όρια ορόφου του καταναλωτή (κλειστά). Οι Μονάδες δεν δίνουν: αποφασίζουν οι όροφοι του κτιρίου. */
export interface LevelStackBounds {
  readonly min: number;
  readonly max: number;
}

function knownFloors(floors: readonly (number | null)[]): number[] {
  return floors.filter((floor): floor is number => floor !== null);
}

/** Χαμηλότερος −1 / ψηλότερος +1. `null` όταν κανένα επίπεδο δεν έχει όροφο (δεν υπάρχει ακόμη στοίβα). */
export function levelStackNeighbours(
  floors: readonly (number | null)[],
  bounds?: LevelStackBounds,
): LevelStackNeighbours | null {
  const known = knownFloors(floors);
  if (known.length === 0) return null;
  const below = Math.min(...known) - 1;
  const above = Math.max(...known) + 1;
  return {
    below: bounds === undefined || below >= bounds.min ? below : null,
    above: bounds === undefined || above <= bounds.max ? above : null,
  };
}

/**
 * Ο όροφος του επιπέδου `index` γίνεται `floor` — και **όλη** η στοίβα μετακινείται με το ίδιο βήμα. Επίπεδο χωρίς
 * όροφο ⇒ παίρνει μόνο αυτό τον όροφο (τοποθέτηση, όχι μετακίνηση). Τα άγνωστα επίπεδα μένουν άγνωστα.
 */
export function shiftLevelStack(floors: readonly (number | null)[], index: number, floor: number): (number | null)[] {
  const current = floors[index];
  if (current === null || current === undefined) return floors.map((value, i) => (i === index ? floor : value));
  const delta = floor - current;
  return floors.map((value) => (value === null ? null : value + delta));
}

/** Αφαιρείται το επίπεδο χωρίς να τρυπήσει η στοίβα; — ναι αν είναι άκρο της, ή αν δεν έχει όροφο. */
export function isLevelStackEnd(floors: readonly (number | null)[], index: number): boolean {
  const floor = floors[index];
  if (floor === null || floor === undefined) return true;
  const known = knownFloors(floors);
  return floor === Math.min(...known) || floor === Math.max(...known);
}
