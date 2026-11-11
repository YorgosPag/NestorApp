/**
 * ADR-929 Δ20 Σ1.3 — **ταυτότητα γραμμικής διάστασης**: «υπάρχει ήδη αυτή η διάσταση στη σκηνή;».
 *
 * Η ιδεμποτία της εγγραφής: δεύτερη έγκριση της ίδιας πρότασης (ή πρόταση πάνω σε σχέδιο που ήδη διαστασιολογήθηκε)
 * **δεν** γράφει δεύτερο αντίγραφο. Το id δεν βοηθά — κάθε πρόταση κόβει νέα ids (N.6)· η ταυτότητα είναι **γεωμετρική**,
 * όπως στο «Overkill» του AutoCAD: ίδια μετρούμενα σημεία (με οποιαδήποτε σειρά) **και** ίδια γραμμή διάστασης.
 *
 * 🔑 **Μόνο αποστάσεις, καμία γωνία-ε.** Η «ίδια γραμμή διάστασης» κρίνεται με δύο σημεία της άλλης γραμμής (το σημείο
 * αναφοράς της και ένα σημείο στη διεύθυνσή της, σε απόσταση ίση με το μετρούμενο μήκος) — και τα δύο πρέπει να απέχουν
 * ≤ ανοχή από τη δική μας. Έτσι η ανοχή έχει **μία** μονάδα (σκηνής) και ένα νόημα, ανεξάρτητα από το μήκος.
 * 🔑 Σημεία ορισμού **μόνο** μέσω `dimDefPoints` (ADR-746 §8): οι οντότητες της σκηνής έρχονται από persistence / import.
 * 🔑 Η ανοχή δίνεται από τον καλούντα σε μονάδες σκηνής (ποτέ σκληρά mm εδώ).
 *
 * Καθαρό. Καμία σκηνή, κανένα store.
 *
 * @module subapps/dxf-viewer/systems/dimensions/linear-dimension-identity
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isDimensionEntity } from '../../types/entities';
import type { LinearDimensionEntity } from '../../types/dimension';
import { degToRad } from '../../rendering/entities/shared/geometry-angle-utils';
import { calculateDistance, signedDistanceToLine } from '../../rendering/entities/shared/geometry-vector-utils';
import { dimDefPoints } from './dimension-def-points';

/** Η κανονική μορφή της σύγκρισης: δύο μετρούμενα σημεία, σημείο αναφοράς, διεύθυνση (μοίρες). */
interface LinearDimensionKey {
  readonly o1: Point2D;
  readonly o2: Point2D;
  readonly ref: Point2D;
  readonly rotation: number;
}

/** Κλειδί σύγκρισης, ή `null` για διάσταση χωρίς τρία χρησιμοποιήσιμα σημεία (ποτέ throw). */
function keyOf(dim: LinearDimensionEntity): LinearDimensionKey | null {
  const points = dimDefPoints(dim);
  if (points.length < 3 || !Number.isFinite(dim.rotation)) return null;
  return { o1: points[0], o2: points[1], ref: points[2], rotation: dim.rotation };
}

function isLinearDimension(entity: Entity): entity is LinearDimensionEntity {
  return isDimensionEntity(entity) && entity.dimensionType === 'linear';
}

function near(a: Point2D, b: Point2D, tolerance: number): boolean {
  return calculateDistance(a, b) <= tolerance;
}

/** Τα δύο μετρούμενα σημεία ταυτίζονται, με οποιαδήποτε σειρά. */
function sameOrigins(a: LinearDimensionKey, b: LinearDimensionKey, tolerance: number): boolean {
  return (near(a.o1, b.o1, tolerance) && near(a.o2, b.o2, tolerance))
    || (near(a.o1, b.o2, tolerance) && near(a.o2, b.o1, tolerance));
}

/** Σημείο της γραμμής διάστασης, σε απόσταση `length` από το σημείο αναφοράς της. */
function alongDimensionLine(k: LinearDimensionKey, length: number): Point2D {
  const angle = degToRad(k.rotation);
  return { x: k.ref.x + Math.cos(angle) * length, y: k.ref.y + Math.sin(angle) * length };
}

/** Η γραμμή διάστασης του `b` κείται πάνω στη γραμμή διάστασης του `a` (ίδια θέση **και** ίδια διεύθυνση). */
function sameDimensionLine(a: LinearDimensionKey, b: LinearDimensionKey, tolerance: number): boolean {
  const length = Math.max(calculateDistance(a.o1, a.o2), tolerance);
  const aDir = alongDimensionLine(a, length);
  const onA = (p: Point2D): boolean => Math.abs(signedDistanceToLine(p, a.ref, aDir)) <= tolerance;
  return onA(b.ref) && onA(alongDimensionLine(b, length));
}

function sameKey(a: LinearDimensionKey, b: LinearDimensionKey, tolerance: number): boolean {
  return sameOrigins(a, b, tolerance) && sameDimensionLine(a, b, tolerance);
}

/** Είναι οι δύο γραμμικές διαστάσεις **η ίδια** διάσταση (μέσα σε `tolerance` μονάδες σκηνής); */
export function isSameLinearDimension(a: LinearDimensionEntity, b: LinearDimensionEntity, tolerance: number): boolean {
  const ka = keyOf(a);
  const kb = keyOf(b);
  return ka !== null && kb !== null && sameKey(ka, kb, tolerance);
}

export interface NewDimensionsPartition<T> {
  /** Όσες δεν υπάρχουν ούτε στη σκηνή ούτε νωρίτερα στην ίδια παρτίδα — με τη σειρά της πρότασης. */
  readonly fresh: readonly T[];
  /** Πόσες της πρότασης υπάρχουν ήδη (στη σκηνή ή ως διπλότυπο μέσα στην παρτίδα). */
  readonly existing: number;
}

/**
 * Χωρίζει μια πρόταση γραμμικών διαστάσεων σε «νέες» και «υπάρχουν ήδη», απέναντι στις οντότητες της σκηνής. Οι μη
 * γραμμικές διαστάσεις και οι λοιπές οντότητες της σκηνής αγνοούνται. Πρόταση χωρίς χρησιμοποιήσιμα σημεία δεν
 * γράφεται (ποτέ μαντεψιά). Ιδεμποτία: ξανά πάνω στη σκηνή που προέκυψε από τα `fresh` ⇒ `fresh = []`.
 */
export function partitionNewLinearDimensions<T extends LinearDimensionEntity>(
  proposed: readonly T[],
  sceneEntities: readonly Entity[],
  tolerance: number,
): NewDimensionsPartition<T> {
  const known: LinearDimensionKey[] = sceneEntities
    .filter(isLinearDimension)
    .map(keyOf)
    .filter((k): k is LinearDimensionKey => k !== null);
  const fresh: T[] = [];
  for (const dim of proposed) {
    const key = keyOf(dim);
    if (key === null || known.some((k) => sameKey(k, key, tolerance))) continue;
    fresh.push(dim);
    known.push(key);
  }
  return { fresh, existing: proposed.length - fresh.length };
}
