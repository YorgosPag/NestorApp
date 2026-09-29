/**
 * @fileoverview **Έκταση του τομέα → ορθογώνιο της MapLibre** — η ΜΙΑ μετάφραση σειράς.
 * @related ADR-847 §9.6 · components/geo/use-camera-frame · search-results/results-map-contract · lib/maps/capture-map-snapshot
 * @module lib/maps/extent-bounds
 *
 * 🔴 **Η μετατροπή είναι ΣΙΩΠΗΛΑ αντιστρέψιμη**: μια εναλλαγή μήκους/πλάτους δεν σπάει τίποτα, απλώς στέλνει τον
 * χάρτη **αλλού**. Ήταν γραμμένη **δύο** φορές (καδράρισμα έκτασης του `PlaceMap` · `fitMapToArea` του χάρτη
 * αποτελεσμάτων) και η μικρογραφία της κάρτας θα ήταν η τρίτη — εξήχθη πριν γραφτεί (ADR-847 §9.6).
 */

import type { GeoBoundingBox } from '@/types/geo/coordinates';

/** `[[δυτικά, νότια], [ανατολικά, βόρεια]]` — η μορφή που δέχεται το `fitBounds`. */
export type ExtentBounds = [[number, number], [number, number]];

/** Διαβάζει **ονομαστικά** πεδία, ώστε καμία σιωπηρή σύμβαση σειράς να μη μεταφέρεται. */
export function extentBounds({ south, west, north, east }: GeoBoundingBox): ExtentBounds {
  return [
    [west, south],
    [east, north],
  ];
}
