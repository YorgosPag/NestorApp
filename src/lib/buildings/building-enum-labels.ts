/**
 * @fileoverview **Η ετικέτα κατάστασης και κατηγορίας ενός κτιρίου** (ADR-898 §18.2) — ο ΕΝΑΣ τόπος όπου τα λεξιλόγια
 * (`BUILDING_STATUSES` · `BUILDING_CATEGORIES`) δένονται με τον κατάλογο `building:status` / `building:categories`.
 * @module lib/buildings/building-enum-labels
 *
 * 🔑 **Ποτέ η ωμή τιμή στην οθόνη.** Πριν: `t(\`category.${x}\`, { defaultValue: x })` σε πέντε σημεία — το κλειδί ήταν
 *   λάθος (`category.` ενώ ο κατάλογος έχει `categories.`) και το `defaultValue` το έκρυβε τυπώνοντας `mixed`. Άγνωστη
 *   τιμή ⇒ ρητό «Μη ορισμένη» (`unknown`), όπως το `UNSPECIFIED` του Protobuf — ούτε ωμό κλειδί, ούτε μαντεψιά.
 * 🔑 **Καμία προεπιλογή-ψέμα**: κτίριο χωρίς κατηγορία ΔΕΝ είναι «Μικτή Χρήση», χωρίς κατάσταση ΔΕΝ είναι «Σχεδιασμός».
 * ⚠️ Χωριστό αρχείο, μικρό: ο γεννήτορας του route slice (ADR-744) διαβάζει τις κλήσεις `t(…)` ανά αρχείο.
 */

import type { TFunction } from 'i18next';

import { isBuildingCategory } from '@/constants/building-categories';
import { parseBuildingStatus } from '@/constants/building-statuses';

export function buildingStatusLabel(t: TFunction, raw: unknown): string {
  return t(`building:status.${parseBuildingStatus(raw) ?? 'unknown'}`);
}

export function buildingCategoryLabel(t: TFunction, raw: unknown): string {
  return t(`building:categories.${isBuildingCategory(raw) ? raw : 'unknown'}`);
}
