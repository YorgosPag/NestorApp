/**
 * Imported mesh — γεωμετρία + επικύρωση (ADR-683 Φ3).
 *
 * Καθαρές συναρτήσεις SSoT: `ImportedMeshParams` → `ImportedMeshGeometry`, και επικύρωση παραμέτρων.
 * Idempotent, χωρίς παρενέργειες.
 *
 * Το ίχνος είναι το **ορθογώνιο του μετρημένου bbox** — μοιράζεται τον πυρήνα με το `furniture`
 * (`computeCentredBoxFootprint`), γιατί ο μετασχηματισμός είναι ο ίδιος· μόνο η *προέλευση* των
 * διαστάσεων διαφέρει (measured από το πλέγμα εδώ, catalog-authored εκεί).
 *
 * ⚠️ Το **ακριβές** περίγραμμα (`computeTopSilhouette`) δεν υπολογίζεται εδώ: απαιτεί φορτωμένο glTF
 * και ζει στο `bimMeshCache`, από όπου το παίρνει ο 2Δ renderer μόλις είναι έτοιμο. Εδώ κρατάμε το
 * συντηρητικό ορθογώνιο ώστε hit-test και bounds να δουλεύουν **χωρίς δίκτυο**, αμέσως.
 *
 * @see ../../geometry/shared/centred-box-footprint — ο κοινός πυρήνας ίχνους
 * @see ./imported-mesh-types — γιατί οι διαστάσεις είναι measured και όχι authored
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../../types/bim-base';
import type { ImportedMeshGeometry, ImportedMeshParams } from './imported-mesh-types';
import { MIN_IMPORTED_MESH_DIMENSION_MM } from './imported-mesh-types';
import { computeCentredBoxFootprint } from '../../geometry/shared/centred-box-footprint';

/** Υπολογίζει `ImportedMeshGeometry` από τις παραμέτρους. Καθαρό SSoT· δεν πετά ποτέ. */
export function computeImportedMeshGeometry(params: ImportedMeshParams): ImportedMeshGeometry {
  return computeCentredBoxFootprint({
    widthMm: params.measuredWidthMm,
    depthMm: params.measuredDepthMm,
    heightMm: params.measuredHeightMm,
    position: params.position,
    rotationDeg: params.rotationDeg,
    sceneUnits: params.sceneUnits,
  });
}

// ─── Επικύρωση ────────────────────────────────────────────────────────────────

/** Αποτέλεσμα επικύρωσης — `hardErrors` μη-κενό ⇒ ο καλών ΠΡΕΠΕΙ να αρνηθεί τη δημιουργία. */
export interface ImportedMeshValidationResult {
  /** i18n keys. Μη-κενό → άρνηση δημιουργίας. */
  readonly hardErrors: readonly string[];
  /** i18n keys. Μη-μπλοκάρον — κόκκινο σήμα στο panel ιδιοτήτων. */
  readonly codeViolations: readonly string[];
  /** Έτοιμο `BimValidation` για ανάθεση στο `ImportedMeshEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Επικυρώνει `ImportedMeshParams`. Δουλεύει **μόνο** πάνω στις παραμέτρους (η γεωμετρία είναι
 * παράγωγη), ώστε να τρέχει και χωρίς φορτωμένο πλέγμα.
 *
 * Σκληρά σφάλματα: χαμένος δείκτης αρχείου (`uploadId`/`nodeName`/`storagePath` — χωρίς αυτά το
 * πλέγμα δεν βρίσκεται ποτέ) ή εκφυλισμένες διαστάσεις (κενός/επίπεδος κόμβος στο `.glb`).
 *
 * ⚠️ **Καμία επικύρωση «λογικού» μεγέθους** — δεν είναι δουλειά μας να κρίνουμε αν ένα εισαγόμενο
 * αντικείμενο «πρέπει» να είναι 3μ ή 30μ. Ο συνεργάτης το σχεδίασε· εμείς το σεβόμαστε (§3).
 */
export function validateImportedMeshParams(
  params: ImportedMeshParams,
): ImportedMeshValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  if (!params.uploadId || !params.nodeName || !params.storagePath) {
    hardErrors.push('importedMesh.validation.hardErrors.missingSource');
  }

  const dims = [params.measuredWidthMm, params.measuredDepthMm, params.measuredHeightMm] as const;
  if (dims.some((d) => !Number.isFinite(d) || d <= 0)) {
    hardErrors.push('importedMesh.validation.hardErrors.nonPositiveDimension');
  } else if (dims.some((d) => d < MIN_IMPORTED_MESH_DIMENSION_MM)) {
    hardErrors.push('importedMesh.validation.hardErrors.degenerateNode');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
