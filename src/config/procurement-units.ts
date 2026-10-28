/**
 * Procurement Unit of Measure — **προβολή** του ΕΝΟΣ μητρώου μονάδων (`lib/uom/uom-registry`).
 *
 * Ποιες μονάδες προσφέρει η λίστα της γραμμής παραγγελίας, με ποια σειρά. Τίποτα άλλο: ο κωδικός UN/ECE, οι παλιές
 * γραφές (`'τεμ'` ≡ `'pcs'`) και οι ετικέτες (namespace i18n `uom`) ζουν στο μητρώο.
 *
 * 🔴 ADR-923 §5.11 «3γ» Α10: εδώ ζούσε **δεύτερο** λεξιλόγιο (`'τεμ'`, `'m²'`…) με ετικέτες el/en γραμμένες στον κώδικα·
 * το υλικό έγραφε `'pcs'` και η επιλογή υλικού άφηνε τη γραμμή με μονάδα **εκτός** λίστας.
 *
 * @module config/procurement-units
 * @see ADR-267 §8 (Unit of Measure)
 */

import type { UomCode } from '@/lib/uom/uom-registry';

/** Οι μονάδες της γραμμής παραγγελίας (Procore/SAP: λίστα, όχι ελεύθερο κείμενο). */
export const PROCUREMENT_UNIT_OPTIONS: readonly UomCode[] = [
  'pcs', 'm', 'm2', 'm3', 'kg', 'ton', 'lt', 'bag', 'box', 'pallet', 'roll', 'pair', 'container', 'set',
];
