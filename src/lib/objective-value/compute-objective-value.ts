/**
 * @fileoverview **Ο ΕΝΑΣ υπολογιστής αντικειμενικής αξίας** — καθαρή συνάρτηση, χωρίς I/O, για κάθε καταναλωτή.
 * @related ADR-898 · ADR-889 §10 (η τιμή ζώνης από τη θέση) · ΠΟΛ.1149/1994
 * @module lib/objective-value/compute-objective-value
 *
 * 🔑 **Τρεις καταναλωτές, μία μηχανή**: η δημόσια σελίδα υπολογιστή, η αγγελία προς πώληση και η ιεραρχία του
 * εργολάβου (έργο → κτίριο → όροφος → ακίνητο → παρακολουθήματα) καλούν **αυτή** τη συνάρτηση. Κανείς δεν
 * πολλαπλασιάζει συντελεστές μόνος του.
 *
 * 🔴 **Είναι ΕΝΔΕΙΚΤΙΚΟΣ υπολογισμός, όχι πιστοποιητικό** — η φορολογητέα αξία οριστικοποιείται στο myPROPERTY της
 * ΑΑΔΕ. Και **δεν** είναι εκτίμηση αγοραίας αξίας (ADR-889 §7): είναι ο κανόνας του νόμου πάνω σε δηλωμένα στοιχεία.
 *
 * Εκτός εμβέλειας (ADR-898 §7): επαγγελματική στέγη (έντυπο 2), οικόπεδο / υπόλοιπο ΣΔ (έντυπο 3), ειδικά κτίρια
 * (6Α-6Ζ), ακίνητα εκτός σχεδίου.
 */

import { computeParking, computeStorage } from './objective-value-ancillary';
import { computeResidence } from './objective-value-residence';
import type { ObjectiveValueInput, ObjectiveValueResult } from './objective-value-types';

export function computeObjectiveValue(input: ObjectiveValueInput): ObjectiveValueResult {
  switch (input.form) {
    case 'residence':
      return computeResidence(input);
    case 'storage':
      return computeStorage(input);
    case 'parking':
      return computeParking(input);
  }
}
