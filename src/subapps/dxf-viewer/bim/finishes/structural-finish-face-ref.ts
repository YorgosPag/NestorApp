/**
 * ADR-449 PART B — `FinishFaceRef`: σταθερή γεωμετρική αναφορά μιας όψης (pure SSoT).
 *
 * Big-player μοντέλο (Revit «Paint»/«Split Face», C4D polygon-selection tag): το per-face
 * override **ανήκει στο element** και δείχνει σε μια **σταθερή αναφορά υπο-όψης**. Εδώ η
 * αναφορά = το **μέσο** της ακμής του footprint, quantized. Γιατί midpoint:
 *   - **Επιβιώνει reorder/reverse κορυφών** (η `orientRing` του resolver μπορεί να αναστρέψει
 *     το ring· το midpoint της ακμής είναι το ίδιο ανεξαρτήτως φοράς a→b ή b→a).
 *   - **Μοναδικό ανά όψη** (δύο διακριτές όψεις δεν μοιράζονται μέσο).
 *   - **Graceful decay**: αν μετά από reshape η όψη πάψει να υπάρχει, το key απλά δεν ταιριάζει
 *     πουθενά → το override αγνοείται (όπως στη Revit όταν σβήνεις μια βαμμένη όψη).
 *
 * Quantum: 1 canvas unit (~1mm στο τυπικό sceneUnits='mm'). «Κολλάει» float-noise & sub-mm
 * drift «από κάναβο», ΠΟΤΕ δύο πραγματικά διαφορετικές όψεις (που απέχουν ≥ δέκατα mm).
 *
 * Pure: μηδέν globals/React/THREE.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';

/** Ονομαστικός τύπος-κλειδί (string) — για αναγνωσιμότητα στα `Record<FinishFaceRef, …>`. */
export type FinishFaceRef = string;

/** Quantum (canvas units) στρογγυλοποίησης του midpoint. */
const FACE_REF_QUANTUM = 1;

const q = (v: number): number => Math.round(v / FACE_REF_QUANTUM) * FACE_REF_QUANTUM;

/**
 * Σταθερό key της όψης a→b = quantized midpoint. Ίδιο για a→b και b→a (φορά-agnostic).
 * `-0` κανονικοποιείται σε `0` (ώστε `'-0,5' !== '0,5'` να μη συμβεί ποτέ).
 */
export function finishFaceRef(a: Pt2, b: Pt2): FinishFaceRef {
  const mx = q((a.x + b.x) / 2) + 0;
  const my = q((a.y + b.y) / 2) + 0;
  return `${mx},${my}`;
}
