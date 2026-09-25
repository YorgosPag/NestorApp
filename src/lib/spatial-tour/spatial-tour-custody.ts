/**
 * @fileoverview **ΠΟΥ ΖΕΙ ΚΑΘΕ ΠΕΡΙΗΓΗΣΗ** — ένα σύστημα, δύο διαμερίσματα (εταιρεία · άνθρωπος).
 * @related ADR-884 Φ0.1 · ADR-866 §2.6.7 · `lib/files/file-custody` (`FILE_COLLECTION`, ίδιο ιδίωμα)
 * @module lib/spatial-tour/spatial-tour-custody
 *
 * Ο ιδιώτης **δεν έχει και δεν αποκτά** `companyId` (ADR-787 Ε-3) — άρα η περιήγηση της αγγελίας του ζει
 * σε **άλλη** συλλογή, όχι σε κλάδο των κανόνων. Κανείς δεν διαλέγει συλλογή περιήγησης με το χέρι.
 *
 * ⚠️ Γράφεται `COLLECTIONS[SPATIAL_TOUR_COLLECTION[kind]]` **στο σημείο κλήσης**, ποτέ μέσα από
 * συνάρτηση-περιτύλιγμα — οι πύλες 3.15/3.35 διαβάζουν αυτή τη μορφή (ένας κλάδος ανά κάτοχο).
 */

import type { CustodyPartition } from '@/lib/workspace/custody-scope';

export const SPATIAL_TOUR_COLLECTION = {
  company: 'SPATIAL_TOURS',
  personal: 'SPATIAL_TOURS_PERSONAL',
} as const satisfies CustodyPartition;
