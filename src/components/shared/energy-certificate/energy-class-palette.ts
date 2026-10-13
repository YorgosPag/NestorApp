/**
 * @fileoverview **ΠΩΣ ΜΟΙΑΖΕΙ ΚΑΘΕ ΒΑΘΜΙΔΑ ΤΗΣ ΕΝΕΡΓΕΙΑΚΗΣ ΚΛΙΜΑΚΑΣ** — χρώμα και μήκος μπάρας (ADR-777 §8.94).
 * @related constants/energy-classes (η κλίμακα και η σειρά της) · app/globals.css (οι εννέα τιμές, και στα δύο θέματα) ·
 *   ./EnergyClassScale.tsx (ο ζωγράφος) · components/listing-detail/media/floor-plate-palette (ίδια αρχή)
 * @module components/shared/energy-certificate/energy-class-palette
 *
 * ♿ **Ποτέ μόνο χρώμα** (WCAG 1.4.1 · CHECK 3.41): κάθε βαθμίδα έχει **τρία** ανεξάρτητα κανάλια — το **γράμμα** της,
 *   τη **θέση** της στη στήλη, και **μήκος μπάρας** που μεγαλώνει με τη βαθμίδα (η σύμβαση της ευρωπαϊκής ετικέτας).
 *   Το χρώμα είναι το τέταρτο, και οι γειτονικές βαθμίδες είναι **εκ κατασκευής** κοντινές (ΔE 3,5–7,5).
 *
 * 🎨 **Τάξινη κλίμακα, όχι κατηγορική**: δεν δανείζεται από τα χρώματα των γραφημάτων (εκείνα δίνουν **ταυτότητα**
 *   σε σειρές που δεν έχουν σειρά). Κάθε τιμή είναι **μετρημένη** στο 3:1 και πάνω απέναντι στην επιφάνεια της κάρτας
 *   και στα δύο θέματα — η άγκυρα τις ξαναμετρά από το ίδιο το stylesheet.
 *
 * ⚠️ **Κλάσεις γραμμένες ολόκληρες**: ο Tailwind τις βρίσκει ως κείμενο — κλάση συναρμολογημένη από κομμάτια δεν θα
 *   παρήγαγε ποτέ CSS. Γι' αυτό δύο πίνακες με εννέα κυριολεκτικά ο καθένας, και όχι ένας τύπος.
 */

import type { EnergyClass } from '@/constants/energy-classes';

/** Το γέμισμα της μπάρας. `Record` πάνω στην κλίμακα: δέκατη βαθμίδα δεν μεταγλωττίζεται χωρίς χρώμα. */
export const ENERGY_CLASS_BAR_CLASS: Readonly<Record<EnergyClass, string>> = {
  'A+': 'bg-[hsl(var(--energy-class-1))]',
  A: 'bg-[hsl(var(--energy-class-2))]',
  'B+': 'bg-[hsl(var(--energy-class-3))]',
  B: 'bg-[hsl(var(--energy-class-4))]',
  C: 'bg-[hsl(var(--energy-class-5))]',
  D: 'bg-[hsl(var(--energy-class-6))]',
  E: 'bg-[hsl(var(--energy-class-7))]',
  F: 'bg-[hsl(var(--energy-class-8))]',
  G: 'bg-[hsl(var(--energy-class-9))]',
};

/** Το μήκος της μπάρας — η καλύτερη κλάση η κοντύτερη, η χειρότερη ολόκληρη (περισσότερη ενέργεια = μακρύτερη). */
export const ENERGY_CLASS_BAR_WIDTH_CLASS: Readonly<Record<EnergyClass, string>> = {
  'A+': 'w-[36%]',
  A: 'w-[44%]',
  'B+': 'w-[52%]',
  B: 'w-[60%]',
  C: 'w-[68%]',
  D: 'w-[76%]',
  E: 'w-[84%]',
  F: 'w-[92%]',
  G: 'w-full',
};
