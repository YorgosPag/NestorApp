/**
 * @fileoverview **Τα γεγονότα του κτιρίου για την αντικειμενική αξία** — ό,τι ισχύει για **όλες** τις μονάδες του και
 * το δηλώνει **μία φορά** ο εργολάβος (ADR-898 Φ4): ημερομηνία άδειας, ΣΑΟ, ανελκυστήρας, θέρμανση, και στάδιο όταν δεν
 * υπάρχει χρονοδιάγραμμα με ετικέτες.
 * @related `objective-value-stages.ts` (το λεξιλόγιο σταδίων) · `building-objective-value.ts` (ποιος τα χρησιμοποιεί
 *   και με ποια ιεραρχία) · `app/api/buildings/building-objective-value-patch.ts` (ο γραφέας)
 * @module lib/objective-value/building-objective-value-facts
 *
 * ⛔ **Δηλώσεις, ΠΟΤΕ ποσά** (ADR-889 §10.2): οι τιμές ζωνών αναθεωρούνται — το ποσό υπολογίζεται κατά την ανάγνωση.
 *
 * 🔑 **`null` = «δεν δηλώθηκε»**, όπως σε όλη τη μηχανή. Ίδιο ιδίωμα με το `objective-value-declarations.ts`:
 * αυστηρή ανάγνωση ανά πεδίο (άκυρο ⇒ `null`, ποτέ ρίψη) · μερική διόρθωση με σχήμα `.strict()`.
 *
 * 🔑 **Το δηλωμένο στάδιο είναι ΕΦΕΔΡΕΙΑ**: όταν το χρονοδιάγραμμα (ADR-034) έχει φάσεις με ετικέτα νόμου, αυτό
 * αποφασίζει — η δήλωση δεν γίνεται δεύτερη αλήθεια δίπλα του (`building-objective-value.ts`).
 */

import { z } from 'zod';

import { isDateKey } from '@/lib/calendar/date-key';
import { isFiniteNumber, isPlainRecord } from '@/lib/type-guards';

import { objectiveValuePatchViolations, type ObjectiveValuePatchViolation } from './objective-value-declarations';
import { isBuildingStageReached, LEGAL_STAGES, type BuildingStageReached } from './objective-value-stages';

export interface BuildingObjectiveValueFacts {
  /** `YYYY-MM-DD` — έκδοση ή τελευταία αναθεώρηση της οικοδομικής άδειας του κτιρίου (άρθ. 2 §20). */
  readonly permitDate: string | null;
  /** ΣΑΟ του οικοπέδου — ζητείται μόνο σε ημιτελές (άρθ. 3 §9). */
  readonly plotUtilisation: number | null;
  /** Το στάδιο, όταν **δεν** το λέει το χρονοδιάγραμμα. */
  readonly declaredStage: BuildingStageReached | null;
  /**
   * Ανελκυστήρας στο κτίριο (άρθ. 2 · συντελεστής ορόφου) — **τύπος** για όλες τις μονάδες, όπως η παράμετρος τύπου
   * του Revit· η δήλωση/το χαρακτηριστικό της μονάδας υπερισχύει (ADR-898 §17). ⚠️ **Όχι** το `Building.hasElevator`
   * (δυαδικό φίλτρο που κανείς δεν γράφει — το `false` του θα έλεγε «όχι» εκεί που ισχύει «δεν ρωτήθηκε»).
   */
  readonly hasElevator: boolean | null;
  /**
   * **Εγκατάσταση** κεντρικής θέρμανσης στο κτίριο (άρθ. 3 §11 — καλοριφέρ/θερμοσυσσωρευτές/δαπέδου) — ίδιο σχήμα με τον
   * ανελκυστήρα: τύπος για όλες τις μονάδες, το `heatingType`/η δήλωση της μονάδας υπερισχύει (ADR-898 §18.3). ⚠️ Η
   * **αυτόνομη** μετρά κι αυτή ως εγκατάσταση (`CENTRAL_HEATING_OF`): «όχι» εδώ δεν μειώνει μονάδα με δική της θέρμανση.
   * ⚠️ **Όχι** το `BUILDING_FEATURES.autonomousHeating` (δυαδική λίστα: απουσία = «δεν ρωτήθηκε», όχι «όχι»).
   */
  readonly hasCentralHeating: boolean | null;
}

/**
 * Το κλειδί σώματος του `PATCH /api/buildings` για τα γεγονότα — η ΜΙΑ δήλωση του ονόματος: ο κλάδος του server
 * ρωτά «υπάρχει;», η πύλη μεταλλάξεων του πελάτη το στέλνει (ADR-898 Φ4β).
 */
export const BUILDING_OBJECTIVE_VALUE_BODY_KEY = 'objectiveValueFacts';

/** Τα δηλώσιμα πεδία — η λίστα είναι η πηγή (ίχνος ελέγχου · σχήμα). */
export const BUILDING_OBJECTIVE_VALUE_FIELDS = [
  'permitDate',
  'plotUtilisation',
  'declaredStage',
  'hasElevator',
  'hasCentralHeating',
] as const satisfies readonly (keyof BuildingObjectiveValueFacts)[];

function isPlotUtilisation(raw: unknown): raw is number {
  return isFiniteNumber(raw) && raw > 0;
}

/** Ό,τι είναι αποθηκευμένο (ή λείπει) → κανονικοποιημένο μπλοκ. */
export function readBuildingObjectiveValueFacts(raw: unknown): BuildingObjectiveValueFacts {
  const record = isPlainRecord(raw) ? raw : {};
  return {
    permitDate: isDateKey(record.permitDate) ? record.permitDate : null,
    plotUtilisation: isPlotUtilisation(record.plotUtilisation) ? record.plotUtilisation : null,
    declaredStage: isBuildingStageReached(record.declaredStage) ? record.declaredStage : null,
    hasElevator: typeof record.hasElevator === 'boolean' ? record.hasElevator : null,
    hasCentralHeating: typeof record.hasCentralHeating === 'boolean' ? record.hasCentralHeating : null,
  };
}

/** Μερική διόρθωση: αλλάζουν ΜΟΝΟ τα κλειδιά που στάλθηκαν· ρητό `null` = «σβήσε». `.strict()`: άγνωστο ⇒ απόρριψη. */
export const buildingObjectiveValuePatchSchema = z
  .object({
    permitDate: z.string().refine(isDateKey).nullable(),
    plotUtilisation: z.number().refine(isPlotUtilisation).nullable(),
    declaredStage: z.enum(['none', ...LEGAL_STAGES]).nullable(),
    hasElevator: z.boolean().nullable(),
    hasCentralHeating: z.boolean().nullable(),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0);

export type BuildingObjectiveValuePatch = z.infer<typeof buildingObjectiveValuePatchSchema>;

/** Κανόνες με ρολόι — **ο ίδιος** κανόνας με τις δηλώσεις της αγγελίας (άδεια στο μέλλον). */
export function buildingObjectiveValuePatchViolations(
  patch: BuildingObjectiveValuePatch,
  today: string,
): readonly ObjectiveValuePatchViolation[] {
  return patch.permitDate === undefined ? [] : objectiveValuePatchViolations({ permitDate: patch.permitDate }, today);
}

export function applyBuildingObjectiveValuePatch(
  current: BuildingObjectiveValueFacts,
  patch: BuildingObjectiveValuePatch,
): BuildingObjectiveValueFacts {
  return readBuildingObjectiveValueFacts({ ...current, ...patch });
}
