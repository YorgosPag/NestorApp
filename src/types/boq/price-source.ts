/**
 * Ο ΔΕΣΜΟΣ ΜΙΑΣ ΓΡΑΜΜΗΣ BOQ ΜΕ ΤΟΝ ΤΙΜΟΚΑΤΑΛΟΓΟ ΚΟΣΤΟΥΣ (ADR-923 §5.4 · §5.11 «3ε» · απόφαση #3).
 *
 * Στιγμιότυπο **και** δεσμός: η γραμμή κρατά τι πήρε και από ποια **έκδοση** ⇒ η νέα έκδοση δείχνει απόκλιση, δεν αλλάζει
 * ποτέ σιωπηλά την τιμή (Sage «Reprice» · Buildxact «Get latest prices»). `null` = καμία πηγή.
 * Αποθηκεύεται, σε αντίθεση με τους υπολογιζόμενους τύπους του `cost.ts`.
 *
 * @module types/boq/price-source
 */

import type { MinorAmount } from '@/lib/money/money';
import type { BOQMeasurementUnit, SourceAuthority } from './units';

/** Ανάλυση τιμής όπως διαβάστηκε: λεπτά ανά `priceQuantity` μονάδες — ακριβώς ό,τι γράφει η γραμμή. */
export interface BoqPriceBreakdown {
  readonly material: MinorAmount;
  readonly labor: MinorAmount;
  readonly equipment: MinorAmount;
}

export interface BoqPriceSource {
  /** Ποιο επίπεδο έδωσε την τιμή. Πάντα `master` ή `project`: χωρίς πηγή το πεδίο είναι `null`. */
  readonly authority: Exclude<SourceAuthority, 'item'>;
  readonly priceListId: string;
  readonly priceListVersionId: string;
  /** Ο αριθμός της έκδοσης, για να φαίνεται χωρίς ανάγνωση. */
  readonly versionNumber: number;
  readonly lineId: string;
  /** Η ταυτότητα του υποκειμένου: με αυτήν ξαναβρίσκεται η γραμμή σε νεότερη έκδοση. */
  readonly subjectKey: string;
  readonly unit: BOQMeasurementUnit;
  readonly priceQuantity: number;
  readonly breakdown: BoqPriceBreakdown;
  /** Η φύρα της γραμμής του τιμοκαταλόγου, σε μονάδες βάσης: εφαρμόζεται στην **ποσότητα**, μόνο όσο η φύρα κληρονομείται. */
  readonly defaultWasteBp: number;
  readonly appliedAt: string;
  readonly appliedBy: string;
}
