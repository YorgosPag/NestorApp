/**
 * @module reports/sections/spaces/types
 * @enterprise ADR-265 Phase 10 — Spaces (Parking/Storage) view-model types
 */

import type { SpacesReportData } from '@/services/report-engine/report-aggregator.types';

/**
 * Το σώμα της απάντησης του `/api/reports/spaces` — **ο ίδιος τύπος** με τον server.
 *
 * ⚠️ Ήταν δεύτερη, γραμμή-προς-γραμμή δήλωση του `SpacesReportData` (31 γραμμές, CHECK 3.28):
 * κάθε αλλαγή στο σχήμα έπρεπε να γραφτεί δύο φορές, ελεύθερη να αποκλίνει. Ενοποιήθηκε όταν
 * η αξία έγινε ανά ρόλο (ADR-777 §8.60.14.13). Εισαγωγή **μόνο τύπου** — τίποτα από τον server
 * δεν φτάνει στον browser.
 */
export type SpacesReportPayload = SpacesReportData;

export interface BuildingValueItem {
  building: string;
  parkingValue: number;
  storageValue: number;
}
