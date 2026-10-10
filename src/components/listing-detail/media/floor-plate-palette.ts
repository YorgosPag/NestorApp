/**
 * @fileoverview **ΠΩΣ ΜΟΙΑΖΕΙ ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ ΟΡΟΦΟΥ** — χρώμα, μοτίβο, περίγραμμα· ο ΕΝΑΣ τόπος (ADR-907 §11.9).
 * @related lib/listings/floor-plate/floor-plate-state (το λεξιλόγιο) · FloorPlateUnitLayer (ο ζωγράφος) ·
 *   components/spatial-tour/viewer/tour-plan-overlay-palette (το λεξιλόγιο της περιήγησης — ίδια αρχή)
 * @module components/listing-detail/media/floor-plate-palette
 *
 * ♿ **Ποτέ μόνο χρώμα** (WCAG 1.4.1 · CHECK 3.41): κάθε κατάσταση έχει **τρία** ανεξάρτητα κανάλια — απόχρωση, **μοτίβο**
 *   και **λέξη** (υπόμνημα + λίστα μονάδων). Τα μοτίβα διαφέρουν σε **είδος**, όχι σε πυκνότητα: κουκκίδες · μονή
 *   διαγράμμιση · σταυρωτή διαγράμμιση διαβάζονται και σε ασπρόμαυρη εκτύπωση.
 *
 * 🎨 **Χρώματα κατάστασης από τα `--status-*`** — τα ίδια που βλέπει το γραφείο στον χώρο του (πράσινο · πορτοκαλί ·
 *   κόκκινο), ώστε ο πωλητής και ο αγοραστής να μιλούν για το ίδιο σχέδιο.
 *
 * 🔴 **«ΑΥΤΟ ΤΟ ΑΚΙΝΗΤΟ» ΔΕΝ ΕΙΝΑΙ ΚΟΚΚΙΝΟ.** Το `--plan-here` (η τελεία «είσαι εδώ» της περιήγησης) έχει **την ίδια
 *   τιμή** με το `--status-error`: κόκκινη «δική μου» μονάδα θα διαβαζόταν «μη διαθέσιμη». Ξεχωρίζει με **μελάνι**
 *   (`--plan-ink`), **παχύ** περίγραμμα με λευκή άλω και το κίτρινο «εδώ» του χώρου (`--plan-space-here`) — το ίδιο
 *   κίτρινο με το δωμάτιο όπου στέκεσαι στην περιήγηση 360°.
 *
 * ⚠️ **Κλάσεις γραμμένες ολόκληρες**: ο Tailwind τις βρίσκει ως κείμενο — κλάση συναρμολογημένη με παρεμβολή του token
 *   δεν θα παρήγαγε ποτέ σωστό CSS. 🔴 Και ο σαρωτής διαβάζει **κάθε** αρχείο, και σχόλια και tests: συμβολοσειρά σε σχήμα
 *   κλάσης με παρεμβολή μέσα της γίνεται **άκυρο** CSS και ρίχνει όλο τον dev server (μετρημένο, ADR-907 §11.9).
 */

import type { FloorPlateState } from '@/lib/listings/floor-plate/floor-plate-state';

/** Το είδος του μοτίβου — `null` = καθαρή επιφάνεια. */
export type FloorPlatePatternKind = 'dots' | 'hatch' | 'cross';

/** Το δεύτερο κανάλι. `Record` πάνω στο λεξιλόγιο: πέμπτη κατάσταση δεν μεταγλωττίζεται χωρίς μοτίβο. */
export const FLOOR_PLATE_PATTERN: Readonly<Record<FloorPlateState, FloorPlatePatternKind | null>> = {
  self: null,
  available: 'dots',
  reserved: 'hatch',
  unavailable: 'cross',
};

/** Η απόχρωση της επιφάνειας — διάφανη, ώστε το σχέδιο από κάτω να διαβάζεται. */
export const FLOOR_PLATE_TINT_CLASS: Readonly<Record<FloorPlateState, string>> = {
  self: 'fill-[hsl(var(--plan-space-here)/0.45)]',
  available: 'fill-[hsl(var(--status-success)/0.22)]',
  reserved: 'fill-[hsl(var(--status-warning)/0.22)]',
  unavailable: 'fill-[hsl(var(--status-error)/0.18)]',
};

export const FLOOR_PLATE_EDGE_CLASS: Readonly<Record<FloorPlateState, string>> = {
  self: 'stroke-[hsl(var(--plan-ink))]',
  available: 'stroke-[hsl(var(--status-success))]',
  reserved: 'stroke-[hsl(var(--status-warning))]',
  unavailable: 'stroke-[hsl(var(--status-error))]',
};

/** Τα σημάδια του μοτίβου: γέμισμα για κουκκίδες, γραμμή για διαγραμμίσεις — μία κλάση τα καλύπτει και τα δύο. */
export const FLOOR_PLATE_MARK_CLASS: Readonly<Record<FloorPlateState, string>> = {
  self: '',
  available: 'fill-[hsl(var(--status-success))] stroke-none',
  reserved: 'fill-none stroke-[hsl(var(--status-warning))]',
  unavailable: 'fill-none stroke-[hsl(var(--status-error))]',
};

/** Η λευκή άλω κάτω από το περίγραμμα της «δικής μου» μονάδας: το μελάνι διαβάζεται πάνω σε κάθε γραμμή του σχεδίου. */
export const FLOOR_PLATE_HALO_CLASS = 'fill-none stroke-white';

/** Το χαρτί κάτω από κάθε δείγμα του υπομνήματος: η κάτοψη είναι λευκό χαρτί και στα **δύο** θέματα (σκοτεινό και φωτεινό). */
export const FLOOR_PLATE_PAPER_CLASS = 'fill-white';

/**
 * Πάχη περιγράμματος σε **pixels οθόνης** (`vector-effect: non-scaling-stroke`): μια εικόνα 2560 px δείχνεται σε 320 px
 * κινητού και σε 880 px οθόνης — πάχος σε μονάδες εικόνας θα γινόταν τρίχα στο ένα ή δοκάρι στο άλλο.
 */
export const FLOOR_PLATE_STROKE_PX = { neighbour: 1.5, self: 3.5, halo: 6.5, emphasis: 1.5 } as const;
