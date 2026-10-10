/**
 * @fileoverview **ΤΙ ΛΕΕΙ Η ΔΗΜΟΣΙΑ ΚΑΤΟΨΗ ΟΡΟΦΟΥ ΓΙΑ ΚΑΘΕ ΜΟΝΑΔΑ** — κλειστό λεξιλόγιο (ADR-907 §11).
 * @related constants/commercial-statuses (η αλήθεια) · types/public-listing (`FloorPlateUnit`)
 * @module lib/listings/floor-plate/floor-plate-state
 *
 * 🔑 **Τρεις καταστάσεις για τον γείτονα, και καμία άλλη πληροφορία.** Το κοινό μαθαίνει *«ελεύθερη · κρατημένη ·
 * μη διαθέσιμη»* — ποτέ τιμή, ποτέ όνομα, ποτέ αν μια μονάδα πουλήθηκε, νοικιάστηκε ή απλώς δεν βγήκε στην αγορά.
 * Οι τρεις τελευταίες **συγχωνεύονται επίτηδες**: η διάκρισή τους είναι εμπορική πληροφορία του γραφείου.
 *
 * 🔑 **`Record<CommercialStatus, …>` επίτηδες**: όγδοη εμπορική κατάσταση **δεν μεταγλωττίζεται** ώσπου κάποιος να
 * αποφασίσει τι βλέπει το κοινό γι' αυτήν. Καμία προεπιλογή δεν μαντεύει.
 *
 * ⛔ **Ζει εδώ και όχι στο `subapps/dxf-viewer/config/color-mapping`** (`commercialToPropertyStatus`): εκείνο είναι
 * λεξιλόγιο **χρώματος του επεξεργαστή**, και η δημόσια σελίδα δεν εισάγει από το subapp (CHECK 3.62).
 *
 * ⚠️ **Καθαρό module** — κανένα React, καμία I/O.
 */

import { normalizeCommercialStatus, type CommercialStatus } from '@/constants/commercial-statuses';

/** Ό,τι μπορεί να ειπωθεί για **γείτονα**, με τη σειρά του υπομνήματος. */
export const FLOOR_PLATE_NEIGHBOUR_STATES = ['available', 'reserved', 'unavailable'] as const;

export type FloorPlateNeighbourState = (typeof FLOOR_PLATE_NEIGHBOUR_STATES)[number];

/**
 * **«Αυτό το ακίνητο»** — η μονάδα της ίδιας της αγγελίας. Δεν είναι κατάσταση διάθεσης: την κατάστασή της τη λέει
 * η αγγελία που ο επισκέπτης ήδη διαβάζει.
 */
export const FLOOR_PLATE_SELF_STATE = 'self';

/** Το πλήρες λεξιλόγιο του πεδίου `FloorPlateUnit.state`. */
export const FLOOR_PLATE_STATES = [FLOOR_PLATE_SELF_STATE, ...FLOOR_PLATE_NEIGHBOUR_STATES] as const;

export type FloorPlateState = (typeof FLOOR_PLATE_STATES)[number];

const NEIGHBOUR_STATE_OF: Readonly<Record<CommercialStatus, FloorPlateNeighbourState>> = {
  'for-sale': 'available',
  'for-rent': 'available',
  'for-sale-and-rent': 'available',
  reserved: 'reserved',
  sold: 'unavailable',
  rented: 'unavailable',
  unavailable: 'unavailable',
};

/**
 * **Εμπορική κατάσταση → ό,τι βλέπει το κοινό για γείτονα.**
 *
 * 🔑 Αδήλωτη ή άγνωστη τιμή ⇒ `'unavailable'`, **ποτέ** `'available'`: μονάδα που κανείς δεν έβγαλε στην αγορά δεν
 * παρουσιάζεται ελεύθερη (ίδιος κανόνας με το `DEFAULT_COMMERCIAL_STATUS` και το `spaceAvailabilityBucket`).
 */
export function floorPlateNeighbourState(commercialStatus: unknown): FloorPlateNeighbourState {
  const canonical = normalizeCommercialStatus(commercialStatus);
  return canonical === null ? 'unavailable' : NEIGHBOUR_STATE_OF[canonical];
}

/** Η μία ανάγνωση του αποθηκευμένου πεδίου — το δημόσιο έγγραφο διαβάζεται **ρηχά**, άρα ο αναγνώστης ελέγχει. */
export function isFloorPlateState(value: unknown): value is FloorPlateState {
  return typeof value === 'string' && (FLOOR_PLATE_STATES as readonly string[]).includes(value);
}
