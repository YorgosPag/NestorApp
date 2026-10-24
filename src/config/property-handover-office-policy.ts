/**
 * @fileoverview **Η πολιτική των πράξεων γραφείου στην παράδοση** — η ΜΙΑ αιτιολογία (ADR-916 §5.18 Φ-Δ.4 · §5.19 Φ-Δ.5).
 * @related types/property-handover-file-decision.ts (απόφαση για αρχείο) · app/api/properties/[id]/handover/withdrawal (ανάκληση)
 * @module config/property-handover-office-policy
 *
 * 🔑 **Μία αιτιολογία, πολλές πράξεις** (Purview «business justification»): ό,τι ζητά από τον άνθρωπο να **εξηγήσει** μια
 *    πράξη με νομικό βάρος ζητά το ΙΔΙΟ μήκος — δύο αριθμοί σε δύο αρχεία θα απέκλιναν στην πρώτη αλλαγή.
 */

/** Κάτω από αυτό, η «αιτιολογία» είναι λέξη, όχι εξήγηση που θα διαβάσει κάποιος σε έναν χρόνο. */
export const HANDOVER_OFFICE_REASON_MIN = 10;

/** Πάνω από αυτό, ανήκει σε έγγραφο, όχι σε γραμμή ιστορικού. */
export const HANDOVER_OFFICE_REASON_MAX = 500;
