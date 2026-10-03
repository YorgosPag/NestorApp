/**
 * @fileoverview **Οι στάθμες που δηλώνει ένας άνθρωπος** — για ακίνητο ΧΩΡΙΣ ορόφους-οντότητες (ADR-900 §8 #2, 2β.2).
 * @module lib/floor/declared-floor-options
 *
 * 🔑 Πρότυπο: idealista «Planta» (Sótano · Semisótano · Bajo · Entreplanta · 1ª…) · Spitogatos «Όροφος»
 * (Υπόγειο · Ημιυπόγειο · Ισόγειο · Υπερυψωμένο · Ημιώροφος · 1ος…) — **ΕΝΑ** dropdown, όχι αριθμός + είδος.
 *
 * Διαφορά από το `FloorSelectField`: εκείνο δένει σε `floorId` (όροφοι-οντότητες εταιρικού κτιρίου, Revit
 * Level). Ο ιδιώτης δηλώνει σε κτίριο του επιπέδου Α, που **δεν** έχει ορόφους-οντότητες ⇒ κλειστή λίστα
 * από το λεξιλόγιο `FloorKind` (ADR-903), τιμή = το **ένα** κλειδί `floorRefKey` (`αριθμός:είδος`).
 *
 * ⚠️ **Κάθε επιλογή έχει αριθμό** (η ζήτηση ταιριάζει σε **εύρος**, ADR-900 §8 #2 Απόφαση ορόφου):
 * ημιυπόγειο −1 · υπερυψωμένο/πυλωτή/ημιώροφος 0 (δεμένα στη στάθμη του ισογείου — ο ημιώροφος **ποτέ** 0,5).
 * Δώμα/σοφίτα **δεν** προσφέρονται: η θέση τους εξαρτάται από το ύψος του κτιρίου (ο αριθμός δεν είναι γνωστός)·
 * το «ρετιρέ» είναι **είδος ακινήτου**, όχι στάθμη (`properties-enums`).
 */

import type { FloorKind } from '@/utils/floor-naming';
import { floorRefKey, type FloorRef } from './floor-ref';

/** Βαθύτερο υπόγειο που προσφέρεται. */
export const DECLARED_BASEMENT_DEPTH = 3;

/** Ψηλότερος όροφος που προσφέρεται — με περιθώριο πάνω από τα ψηλότερα κτίρια της χώρας· ό,τι πάνω, βλ. `current`. */
export const DECLARED_FLOOR_MAX = 30;

export interface DeclaredFloorOption {
  readonly value: string;
  readonly ref: FloorRef;
}

const ref = (number: number, kind: FloorKind): FloorRef => ({ number, kind });

/**
 * Η κλειστή λίστα, **κατά στάθμη** (από κάτω προς τα πάνω). Τη μοιράζεται ο επιλογέας **εύρους** της ζήτησης
 * και της αναζήτησης (`floor-level-range.ts`, 2β.3) — μία λίστα στάθμεων, όχι δύο.
 */
export function declaredFloorRefs(): FloorRef[] {
  const basements = Array.from({ length: DECLARED_BASEMENT_DEPTH }, (_, i) => ref(i - DECLARED_BASEMENT_DEPTH, 'basement'));
  const storeys = Array.from({ length: DECLARED_FLOOR_MAX }, (_, i) => ref(i + 1, 'standard'));
  return [
    ...basements,
    ref(-1, 'semi-basement'),
    ref(0, 'ground'),
    ref(0, 'raised-ground'),
    ref(0, 'pilotis'),
    ref(0, 'mezzanine'),
    ...storeys,
  ];
}

/**
 * Οι επιλογές — και η **τρέχουσα** τιμή, αν είναι εκτός λίστας (π.χ. 35ος όροφος ή παλιό είδος): ένα πεδίο
 * επεξεργασίας που δεν μπορεί να δείξει την αποθηκευμένη τιμή θα την έσβηνε σιωπηλά στην πρώτη αποθήκευση.
 */
export function declaredFloorOptions(current: FloorRef | null = null): readonly DeclaredFloorOption[] {
  const refs = declaredFloorRefs();
  if (current !== null && current.number !== null && !refs.some((r) => floorRefKey(r) === floorRefKey(current))) {
    refs.push(current);
    refs.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  }
  return refs.map((r) => ({ value: floorRefKey(r), ref: r }));
}
