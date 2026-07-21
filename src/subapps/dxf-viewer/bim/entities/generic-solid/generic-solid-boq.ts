/**
 * generic-solid-boq — «παραμετρικό στερεό → ποσότητα προμέτρησης» (ADR-684 Φ4-C, mirror
 * `imported-mesh-boq.ts` §10.2).
 *
 * Η **μοναδική** μετατροπή από τις αποθηκευμένες διαστάσεις (mm) στο σχήμα που περιμένει το BOQ
 * bridge (m/m²/m³). Σε αντίθεση με το imported-mesh (όγκος **μετρημένος** από τρίγωνα, `null` όταν
 * το κέλυφος δεν είναι κλειστό), εδώ ο όγκος είναι **αναλυτικά ακριβής** ανά σχήμα — δεν υπάρχει
 * αβεβαιότητα να «κρύψουμε»: ένα παραμετρικό στερεό ΞΕΡΕΙ τον όγκο του (Revit Material Takeoff parity).
 *
 * Ο όγκος είναι **GROSS** (πλήρες στερεό)· όπου το σχήμα έχει τρύπα (torus) υπολογίζεται ο πραγματικός
 * δακτυλιοειδής όγκος (2π²Rr²), όχι το bbox. Καμία μαντεψιά.
 *
 * ## Ταξινόμηση: εδώ ΜΟΝΟ η ποσότητα — το «ποιο άρθρο» ζει αλλού
 * Το αν το στερεό παράγει γραμμή (δομικό → OIK-2.03 m³) ή όχι (διακοσμητικό → καμία) το αποφασίζει ο
 * `resolveGenericSolidMapping` (bim-to-atoe-mapping) μέσω του `BimToBoqBridge`. Εδώ απλώς παρέχουμε το
 * `BimEntityForBoq` payload· ο bridge κάνει skip μόνος του (null mapping) για το διακοσμητικό.
 *
 * @see ../imported-mesh/imported-mesh-boq — ο αδελφός payload builder
 * @see ../../config/bim-to-atoe-mapping — `deriveAtoeQuantity` (SSoT μονάδα→ποσότητα), `resolveGenericSolidMapping`
 * @see docs/centralized-systems/reference/adrs/ADR-684-generic-solid-primitive-entity.md §4.3
 */

import type { BimEntityForBoq } from '../../services/BimToBoqBridge';
import { computeGenericSolidGeometry, shapeBoundingBoxMm } from './generic-solid-geometry';
import type {
  GenericSolidEntity,
  GenericSolidParams,
  GenericSolidShape,
} from './generic-solid-types';

const MM_TO_M = 1 / 1000;
const MM3_TO_M3 = 1e-9;

/**
 * Ο **αναλυτικά ακριβής** όγκος (mm³) του σχήματος. Κάθε σχήμα με τον δικό του τύπο — καμία bbox
 * προσέγγιση. Οι διαστάσεις είναι σε mm (SSoT), άρα το γινόμενο είναι mm³.
 */
function shapeVolumeMm3(shape: GenericSolidShape): number {
  switch (shape.kind) {
    case 'box':
      return shape.widthMm * shape.depthMm * shape.heightMm;
    case 'sphere':
      return (4 / 3) * Math.PI * shape.radiusMm ** 3;
    case 'cylinder':
      return Math.PI * shape.radiusMm ** 2 * shape.heightMm;
    case 'cone': {
      // Κόλουρος κώνος (frustum): V = πh/3 · (R² + R·r + r²)· r=0 → πλήρης κώνος.
      const R = shape.radiusBottomMm;
      const r = shape.radiusTopMm;
      return ((Math.PI * shape.heightMm) / 3) * (R * R + R * r + r * r);
    }
    case 'torus':
      return 2 * Math.PI ** 2 * shape.majorRadiusMm * shape.tubeRadiusMm ** 2;
    case 'pyramid':
      return (shape.baseWidthMm * shape.baseDepthMm * shape.heightMm) / 3;
    case 'disc':
      return Math.PI * shape.radiusMm ** 2 * shape.thicknessMm;
    case 'prism': {
      // Κανονικό n-γωνο (ακτίνα περιγεγραμμένου κύκλου): A = ½·n·r²·sin(2π/n).
      const baseArea = 0.5 * shape.sides * shape.radiusMm ** 2 * Math.sin((2 * Math.PI) / shape.sides);
      return baseArea * shape.heightMm;
    }
  }
}

/** Ο ακριβής όγκος του στερεού σε **m³** — η ποσότητα που διαβάζει το `deriveAtoeQuantity` για m³. */
export function genericSolidVolumeM3(shape: GenericSolidShape): number {
  return shapeVolumeMm3(shape) * MM3_TO_M3;
}

/**
 * Το οριζόντιο άνοιγμα (m) — διαγώνιος του bbox ίχνους, ακριβής για κάθε προσανατολισμό (mirror
 * `imported-mesh-boq.horizontalSpanM`). Χρησιμοποιείται μόνο αν κάποιο άρθρο μετριέται σε `m`.
 */
function horizontalSpanM(shape: GenericSolidShape): number {
  const bb = shapeBoundingBoxMm(shape);
  const widthM = bb.widthMm * MM_TO_M;
  const depthM = bb.depthMm * MM_TO_M;
  return Math.sqrt(widthM * widthM + depthM * depthM);
}

/**
 * Τα μεγέθη στο σχήμα που καταναλώνει το `deriveAtoeQuantity`. Το `volume` είναι αναλυτικά ακριβές·
 * το `area` = εμβαδόν ίχνους (m², από τη γεωμετρία SSoT)· το `lengthM` = διαγώνιος bbox.
 */
export function genericSolidBoqGeometry(
  params: GenericSolidParams,
): NonNullable<BimEntityForBoq['geometry']> {
  return {
    area: computeGenericSolidGeometry(params).area,
    volume: genericSolidVolumeM3(params.shape),
    lengthM: horizontalSpanM(params.shape),
  };
}

/**
 * Το φορτίο που στέλνεται στο BOQ bridge. Το `params` περνά ακέραιο ώστε ο resolver να δει το
 * `structuralRole` — είναι ο διαχωριστής αυτού του τύπου (δομικό → γραμμή· διακοσμητικό → καμία).
 */
export function genericSolidBoqPayload(entity: GenericSolidEntity): BimEntityForBoq {
  return {
    id: entity.id,
    kind: entity.kind,
    params: entity.params,
    geometry: genericSolidBoqGeometry(entity.params),
  };
}
