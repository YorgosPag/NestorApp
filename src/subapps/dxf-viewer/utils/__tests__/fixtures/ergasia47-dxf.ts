/**
 * ADR-716 — ΕΝΑ σπίτι για το ground truth του `47_ergasia.dxf`.
 *
 * Οι τιμές διαβάστηκαν από το **ίδιο το αρχείο** (όχι από ADR, όχι από αφήγηση):
 *
 *   $INSUNITS    = 0                       ← unitless ⇒ η ευρετική αναλαμβάνει
 *   $MEASUREMENT = 0                       ← «English»/imperial (ΔΕΝ χρησιμοποιείται, ADR-716 §4)
 *   $EXTMIN      = 407565.2907102597 , 4502055.67106188
 *   $EXTMAX      = 408152.0910632098 , 4502543.611061878
 *                  dx = 586.80 m   dy = 487.94 m   διαγώνιος = 763.17
 *
 * Ζει σε χωριστό module (και όχι μέσα σε ένα `.test.ts`) επειδή το χρειάζονται **δύο**
 * σουίτες: η ταυτοποίηση του Μέρους Α και η idempotency του ρητού override (Μέρος Β).
 * Αντιγραφή του θα ήταν ακριβώς το sibling clone που απαγορεύει ο N.18 — και χειρότερα:
 * δύο «αλήθειες» για το ίδιο αρχείο, που μπορούν να αποκλίνουν σιωπηλά.
 *
 * ⚠️ Το όνομα ΔΕΝ περιέχει `.test.` ⇒ δεν ταιριάζει στο `testMatch` του Jest, άρα δεν
 * εκτελείται ως σουίτα (θα έσκαγε με «must contain at least one test»).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-716-geodetic-unit-identification-dxf-import.md
 */

import type { DxfHeaderData } from '../../dxf-parser-types';

/** Το ΠΡΑΓΜΑΤΙΚΟ header του `47_ergasia.dxf` ($CANNOSCALEVALUE απουσιάζει ⇒ default 1). */
export const ERGASIA_47_HEADER: DxfHeaderData = {
  insunits: 0,
  measurement: 0,
  dimscale: 1.0,
  dimtxt: 0.5,
  annoScale: 1,
  pdmode: 0,
  pdsize: 0.1,
  ltscale: 1.0,
  extmin: { x: 407565.2907102597, y: 4502055.67106188 },
  extmax: { x: 408152.0910632098, y: 4502543.611061878 },
};

export const ERGASIA_47_EXTENTS = {
  min: ERGASIA_47_HEADER.extmin as { x: number; y: number },
  max: ERGASIA_47_HEADER.extmax as { x: number; y: number },
};

/** Πλάτος/ύψος σε μέτρα, από το αρχείο: 586.80 m × 487.94 m. */
export const ERGASIA_47_WIDTH_M = 586.8003529501;
export const ERGASIA_47_HEIGHT_M = 487.939999998;

/**
 * End-to-end fixture: το πραγματικό header + μία γραμμή στη διαγώνιο του extent.
 * Μετά το canonical-mm (ADR-462) το σχέδιο πρέπει να βγαίνει 586 800 mm πλάτος — δηλαδή
 * 587 m, όσο λέει το αρχείο. Με ερμηνεία `cm` βγαίνει 58 680 mm = 58,7 m: ×100 μικρότερο.
 */
export function makeErgasia47Dxf(): string {
  const { min, max } = ERGASIA_47_EXTENTS;
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '0',
    '9', '$MEASUREMENT', '70', '0',
    '9', '$EXTMIN', '10', String(min.x), '20', String(min.y),
    '9', '$EXTMAX', '10', String(max.x), '20', String(max.y),
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', '0',
    '10', String(min.x), '20', String(min.y),
    '11', String(max.x), '21', String(max.y),
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}
