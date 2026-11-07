/**
 * **Η αλήθεια από το CAD** (ADR-929 §6.9, Βήμα 3): τα πρωτογενή ενός διανυσματικού σχεδίου **με ετικέτα ρόλου**, ώστε το
 * χρυσό σύνολο να βγαίνει από το ίδιο το CAD και όχι από χειρωνακτικές ετικέτες.
 *
 * 🔑 **Ένα λεξιλόγιο με τον αναγνωριστή.** Οι ρόλοι είναι οι ρόλοι τμήματος της Φ5.4 (`classify/segment-roles.ts`) συν
 * `other` για ό,τι το CAD ξέρει αλλά ο αναγνωριστής δεν ονομάζει (σύμβολα, γραμμοσκιάσεις, έπιπλα).
 * 🔑 **Η διάσταση κρατά τα σημεία μέτρησης.** Όχι μόνο «εδώ υπάρχει διάσταση»: η τιμή που γράφει το CAD και τα δύο σημεία
 * που μετρά, ώστε να ελεγχθούν τα `dimensionSpans` της Φ5.5 (ποιες παρειές μετρά κάθε διάσταση).
 * 🔑 **Μονάδες σχεδίου, χωρίς μετατροπή.** Η καταγραφή (`lib/geometry/registration`) τα φέρνει στα pixel της εικόνας.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/testing/cad-truth/cad-truth-types
 */

import type { AffinePoint } from '@/lib/geometry/affine-2x3';

/** Οι ρόλοι της αλήθειας. Οι τέσσερις πρώτοι αντιστοιχούν σε ρόλους τμήματος του αναγνωριστή. */
export type CadTruthRole = 'wall-face' | 'dimension-line' | 'extension-line' | 'annotation' | 'other';

export interface CadTruthSegment {
  readonly a: AffinePoint;
  readonly b: AffinePoint;
  readonly role: CadTruthRole;
}

export interface CadTruthDimension {
  /** Το κείμενο όπως το γράφει το CAD (π.χ. «2.10»)· κενό ⇒ μετρημένη τιμή. */
  readonly text: string;
  /** Τα δύο σημεία που μετρά η διάσταση (βάσεις των γραμμών επέκτασης). */
  readonly measured: readonly [AffinePoint, AffinePoint];
  /** Η γραμμή διάστασης. */
  readonly line: readonly [AffinePoint, AffinePoint];
}

export interface CadTruthText {
  readonly text: string;
  readonly at: AffinePoint;
}

export interface CadTruth {
  readonly segments: readonly CadTruthSegment[];
  readonly dimensions: readonly CadTruthDimension[];
  readonly texts: readonly CadTruthText[];
  /** Ό,τι δεν διαβάστηκε (π.χ. άγνωστος τύπος), με πλήθος — ποτέ σιωπηλή παράλειψη. */
  readonly skipped: Readonly<Record<string, number>>;
}

/** Τα τμήματα που αξίζουν για την **καταγραφή**: παρειές τοίχων (σταθερές, μακριές, πάντα τυπωμένες). */
export function registrationSegments(truth: CadTruth): readonly CadTruthSegment[] {
  return truth.segments.filter((s) => s.role === 'wall-face');
}
