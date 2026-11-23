/**
 * @fileoverview **Αναφορά πηγής ΓΕΜΗ Open Data** — η μία δήλωση (ADR-948 §8 Βήμα 7).
 * @module config/company-registry/gemi-open-data-attribution
 *
 * Τα δεδομένα του ΓΕΜΗ Open Data διατίθενται με άδεια **ODC-BY-1.0**, που **απαιτεί** αναφορά πηγής
 * (επαληθευμένο ζωντανά 2026-09-14 — βλ. κεφαλίδα του `services/company-registry/gemi-opendata.client.ts`).
 * Κάθε οθόνη που δείχνει απάντηση του ΓΕΜΗ διαβάζει από εδώ — ποτέ δεύτερο χειρόγραφο URL.
 */

export const GEMI_OPEN_DATA_ATTRIBUTION = {
  /** Η πύλη ανοικτών δεδομένων του ΓΕΜΗ. */
  sourceUrl: 'https://opendata.businessportal.gr/',
  /** Το κείμενο της άδειας. */
  licenceUrl: 'https://opendatacommons.org/licenses/by/1-0/',
} as const;
