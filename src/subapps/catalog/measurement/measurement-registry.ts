/**
 * =============================================================================
 * ΤΟ ΜΗΤΡΩΟ ΟΙΚΟΓΕΝΕΙΩΝ ΜΕΤΡΗΣΗΣ — πλατφόρμα + χώρος, ΜΙΑ ματιά (ADR-923 §5.2)
 * =============================================================================
 *
 * Κάθε καταναλωτής (επικύρωση ιδιότητας, κανόνες συνέπειας, οθόνη, εισαγωγή) ρωτά **εδώ**
 * «ποια είναι η οικογένεια `power`;» και δεν ξέρει αν ήρθε από κώδικα ή από Firestore.
 *
 * 🔑 **Οι κωδικοί της πλατφόρμας είναι δεσμευμένοι**: ο γραφέας απορρίπτει οικογένεια χώρου
 * με κωδικό πλατφόρμας. Αν παρ' όλα αυτά φτάσει σύγκρουση (π.χ. παλιό έγγραφο πριν
 * προστεθεί νέα οικογένεια πλατφόρμας), **νικά η πλατφόρμα** — ντετερμινιστικά — ώστε μια
 * τιμή αποθηκευμένη σε W να μη διαβαστεί ποτέ με τους συντελεστές κάποιου άλλου.
 *
 * @module subapps/catalog/measurement/measurement-registry
 */

import type { CatalogRecordMeta } from '../types/catalog-record';
import type {
  MeasurementFamilyDefinition,
  WorkspaceMeasurementFamilyDefinition,
} from '../types/measurement-family';
import { PLATFORM_MEASUREMENT_FAMILIES } from './platform-families';

export interface MeasurementRegistry {
  readonly families: readonly MeasurementFamilyDefinition[];
  get(code: string): MeasurementFamilyDefinition | undefined;
  has(code: string): boolean;
}

/** Χτίζει το μητρώο από τις οικογένειες του χώρου (οι της πλατφόρμας μπαίνουν πάντα). */
export function createMeasurementRegistry(
  workspaceFamilies: readonly MeasurementFamilyDefinition[] = [],
): MeasurementRegistry {
  const byCode = new Map<string, MeasurementFamilyDefinition>();
  for (const family of PLATFORM_MEASUREMENT_FAMILIES) byCode.set(family.code, family);
  for (const family of workspaceFamilies) {
    if (!byCode.has(family.code)) byCode.set(family.code, family);
  }
  const families = [...byCode.values()];
  return {
    families,
    get: (code) => byCode.get(code),
    has: (code) => byCode.has(code),
  };
}

/**
 * Αποθηκευμένη οικογένεια χώρου → ενιαίος ορισμός. Η πηγή και το «μη συγκρίσιμη» **παράγονται**
 * εδώ (§17: μόνο η πλατφόρμα κάνει μια οικογένεια συγκρίσιμη).
 */
export function fromWorkspaceDefinition(stored: WorkspaceMeasurementFamilyDefinition): MeasurementFamilyDefinition {
  return {
    code: stored.code,
    source: 'workspace',
    label: { kind: 'text', text: stored.labels },
    standardUnitCode: stored.standardUnitCode,
    units: stored.units,
    comparable: false,
    singleUnit: stored.singleUnit,
  };
}

/** Το μητρώο ενός χώρου από τις **αποθηκευμένες** εγγραφές του — οι διαγραμμένες δεν μετρούν. */
export function createMeasurementRegistryFromRecords(
  records: ReadonlyArray<WorkspaceMeasurementFamilyDefinition & Pick<CatalogRecordMeta<unknown>, 'isDeleted'>>,
): MeasurementRegistry {
  return createMeasurementRegistry(records.filter((record) => !record.isDeleted).map(fromWorkspaceDefinition));
}

/** Το μητρώο μόνο με την πλατφόρμα — για πλαίσια χωρίς χώρο (tests, δημόσια προβολή). */
export const PLATFORM_MEASUREMENT_REGISTRY: MeasurementRegistry = createMeasurementRegistry();
