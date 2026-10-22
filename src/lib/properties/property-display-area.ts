/**
 * @fileoverview **Το εμβαδόν που δείχνουμε για ένα ακίνητο** — μικτό, αλλιώς καθαρό, αλλιώς το παλιό επίπεδο `area`.
 * @module lib/properties/property-display-area
 *
 * 🧹 Η ίδια αλυσίδα `areas?.gross || areas?.net || area` ήταν γραμμένη αυτούσια σε **έξι** αρχεία (καρτέλα Μονάδων κτιρίου ×4,
 * κάρτα ακινήτου, πλέγμα, γρήγορη προβολή, κοινοποίηση). Εδώ ζει **μία** φορά (ADR-898 Φ4β — η εξαγωγή XLSX χρειαζόταν
 * πέμπτη)· οι καταναλωτές εκτός καρτέλας κτιρίου περνούν όταν αγγιχτούν (`.claude-rules/pending-ratchet-work.md`).
 *
 * 🔑 **ΜΙΑ σημασιολογία για οθόνη ΚΑΙ δημόσια αγγελία** (ADR-777 §8.96.5, απόφαση Giorgio 2026-10-14): η δεύτερη αλήθεια
 * `propertyAreaSqmOf` (`gross ?? area`, το `0` υπαρκτό) της προβολής αγγελίας και της εισαγωγής ΠΕΑ **καταργήθηκε** —
 * το γραφείο έβλεπε ένα εμβαδόν και το κοινό άλλο.
 *
 * ⚠️ `0` σημαίνει **«δεν μετρήθηκε»**, όχι «μηδέν τετραγωνικά» — η αλυσίδα προχωρά στο επόμενο. Η απουσία επιστρέφεται ως
 * `null`: κενό κελί, ποτέ «0 m²» (και ποτέ μέρος αθροίσματος).
 * ⚠️ **Ανεκτικός αναγνώστης**: καλείται και πάνω σε ωμό έγγραφο Firestore (προβολή · server routes) ⇒ μετρά **μόνο**
 * θετικός πεπερασμένος αριθμός. Για κάθε έγκυρη τιμή το αποτέλεσμα είναι ταυτόσημο με το `||`· ό,τι άλλο (συμβολοσειρά,
 * αρνητικό, `Infinity`) θα περνούσε από το `||` αυτούσιο στην οθόνη ή στην αγγελία.
 */

import { measuredAreaOrNull } from '@/lib/properties/property-areas';
import { isPlainRecord } from '@/lib/type-guards';

export interface DisplayAreaSource {
  readonly areas?: unknown;
  readonly area?: unknown;
}

export function propertyDisplayArea(source: DisplayAreaSource): number | null {
  const areas = isPlainRecord(source.areas) ? source.areas : {};
  return measuredAreaOrNull(areas.gross) ?? measuredAreaOrNull(areas.net) ?? measuredAreaOrNull(source.area);
}
