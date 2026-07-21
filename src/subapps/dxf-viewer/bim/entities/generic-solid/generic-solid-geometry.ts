/**
 * Generic solid — γεωμετρία + επικύρωση (ADR-684 Φ2).
 *
 * Καθαρές συναρτήσεις SSoT: `GenericSolidParams` → `GenericSolidGeometry`, και επικύρωση παραμέτρων.
 * Idempotent, χωρίς παρενέργειες, δεν πετούν ποτέ.
 *
 * Το ίχνος είναι το **ορθογώνιο του bbox** του σχήματος — μοιράζεται τον πυρήνα με έπιπλο/
 * imported-mesh (`computeCentredBoxFootprint`), γιατί ο μετασχηματισμός είναι ο ίδιος· μόνο η
 * *προέλευση* των διαστάσεων διαφέρει (εδώ παράγονται από το σχήμα μέσω `shapeBoundingBoxMm`).
 *
 * @see ../../geometry/shared/centred-box-footprint — ο κοινός πυρήνας ίχνους (N.18: κανένα clone)
 * @see ./generic-solid-types — GenericSolidShape (nested discriminated union)
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation } from '../../types/bim-base';
import { computeCentredBoxFootprint } from '../../geometry/shared/centred-box-footprint';
import type {
  GenericSolidGeometry,
  GenericSolidParams,
  GenericSolidShape,
} from './generic-solid-types';
import {
  MIN_GENERIC_SOLID_DIMENSION_MM,
  MIN_PRISM_SIDES,
} from './generic-solid-types';

// ─── Bounding box ανά σχήμα ────────────────────────────────────────────────────

/** Αξονο-ευθυγραμμισμένες διαστάσεις (mm) του σχήματος πριν την περιστροφή. */
export interface ShapeBoundingBoxMm {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly heightMm: number;
}

/**
 * Το bbox (πλάτος×βάθος×ύψος, mm) κάθε σχήματος — η μόνη πληροφορία που χρειάζεται το 2Δ ίχνος και
 * το placeholder placement. Καθαρή αντιστοίχιση σχήμα → διαστάσεις.
 */
export function shapeBoundingBoxMm(shape: GenericSolidShape): ShapeBoundingBoxMm {
  switch (shape.kind) {
    case 'box':
      return { widthMm: shape.widthMm, depthMm: shape.depthMm, heightMm: shape.heightMm };
    case 'sphere': {
      const d = shape.radiusMm * 2;
      return { widthMm: d, depthMm: d, heightMm: d };
    }
    case 'cylinder': {
      const d = shape.radiusMm * 2;
      return { widthMm: d, depthMm: d, heightMm: shape.heightMm };
    }
    case 'cone': {
      const d = Math.max(shape.radiusBottomMm, shape.radiusTopMm) * 2;
      return { widthMm: d, depthMm: d, heightMm: shape.heightMm };
    }
    case 'torus': {
      const d = (shape.majorRadiusMm + shape.tubeRadiusMm) * 2;
      return { widthMm: d, depthMm: d, heightMm: shape.tubeRadiusMm * 2 };
    }
    case 'pyramid':
      return { widthMm: shape.baseWidthMm, depthMm: shape.baseDepthMm, heightMm: shape.heightMm };
    case 'disc': {
      const d = shape.radiusMm * 2;
      return { widthMm: d, depthMm: d, heightMm: shape.thicknessMm };
    }
    case 'prism': {
      const d = shape.radiusMm * 2;
      return { widthMm: d, depthMm: d, heightMm: shape.heightMm };
    }
  }
}

// ─── Γεωμετρία ──────────────────────────────────────────────────────────────────

/** Υπολογίζει `GenericSolidGeometry` από τις παραμέτρους. Καθαρό SSoT· δεν πετά ποτέ. */
export function computeGenericSolidGeometry(params: GenericSolidParams): GenericSolidGeometry {
  const box = shapeBoundingBoxMm(params.shape);
  return computeCentredBoxFootprint({
    widthMm: box.widthMm,
    depthMm: box.depthMm,
    heightMm: box.heightMm,
    position: params.position,
    rotationDeg: params.rotationDeg,
    sceneUnits: params.sceneUnits,
  });
}

// ─── Επικύρωση ────────────────────────────────────────────────────────────────

/** Αποτέλεσμα επικύρωσης — `hardErrors` μη-κενό ⇒ ο καλών ΠΡΕΠΕΙ να αρνηθεί τη δημιουργία. */
export interface GenericSolidValidationResult {
  /** i18n keys. Μη-κενό → άρνηση δημιουργίας. */
  readonly hardErrors: readonly string[];
  /** i18n keys. Μη-μπλοκάρον — κόκκινο σήμα στο panel ιδιοτήτων. */
  readonly codeViolations: readonly string[];
  /** Έτοιμο `BimValidation` για ανάθεση στο `GenericSolidEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/** Οι θετικές διαστάσεις (mm) που ορίζουν κάθε σχήμα — για ενιαία επικύρωση. */
function shapePositiveDimsMm(shape: GenericSolidShape): readonly number[] {
  switch (shape.kind) {
    case 'box':
      return [shape.widthMm, shape.depthMm, shape.heightMm];
    case 'sphere':
      return [shape.radiusMm];
    case 'cylinder':
      return [shape.radiusMm, shape.heightMm];
    case 'cone':
      // radiusTopMm επιτρέπεται 0 (πλήρης κώνος) — ελέγχεται χωριστά ως μη-αρνητικό.
      return [shape.radiusBottomMm, shape.heightMm];
    case 'torus':
      return [shape.majorRadiusMm, shape.tubeRadiusMm];
    case 'pyramid':
      return [shape.baseWidthMm, shape.baseDepthMm, shape.heightMm];
    case 'disc':
      return [shape.radiusMm, shape.thicknessMm];
    case 'prism':
      return [shape.radiusMm, shape.heightMm];
  }
}

/**
 * Επικυρώνει `GenericSolidParams`. Δουλεύει μόνο πάνω στις παραμέτρους (η γεωμετρία είναι παράγωγη).
 * Σκληρά σφάλματα: μη-θετική/μη-πεπερασμένη διάσταση, ή πρίσμα με < 3 πλευρές.
 */
export function validateGenericSolidParams(
  params: GenericSolidParams,
): GenericSolidValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];

  const dims = shapePositiveDimsMm(params.shape);
  if (dims.some((d) => !Number.isFinite(d) || d <= 0)) {
    hardErrors.push('genericSolid.validation.hardErrors.nonPositiveDimension');
  } else if (dims.some((d) => d < MIN_GENERIC_SOLID_DIMENSION_MM)) {
    hardErrors.push('genericSolid.validation.hardErrors.degenerateDimension');
  }

  if (params.shape.kind === 'cone' && (!Number.isFinite(params.shape.radiusTopMm) || params.shape.radiusTopMm < 0)) {
    hardErrors.push('genericSolid.validation.hardErrors.nonPositiveDimension');
  }

  if (params.shape.kind === 'prism' && (!Number.isInteger(params.shape.sides) || params.shape.sides < MIN_PRISM_SIDES)) {
    hardErrors.push('genericSolid.validation.hardErrors.tooFewSides');
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}
