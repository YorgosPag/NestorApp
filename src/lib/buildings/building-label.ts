/**
 * @fileoverview **Η ετικέτα ενός κτιρίου** όπως τη βλέπει ο άνθρωπος — όνομα, αλλιώς ο κλειδωμένος κωδικός («Κτήριο Α»),
 *   αλλιώς η ταυτότητα· ποτέ κενό (ADR-928 §5.24).
 * @module lib/buildings/building-label
 *
 * 🔑 Ένας κανόνας για την οθόνη (επιλογή κτιρίων) και τον γραφέα (στιγμιότυπο που τυπώνεται στο έγγραφο): ό,τι
 *    διάλεξε ο άνθρωπος με αυτή τη λέξη, αυτή τη λέξη τυπώνει το χαρτί.
 */

interface BuildingLabelFacts {
  readonly id: string;
  readonly name?: unknown;
  readonly code?: unknown;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function buildingLabelOf(building: BuildingLabelFacts): string {
  return text(building.name) || text(building.code) || building.id;
}
