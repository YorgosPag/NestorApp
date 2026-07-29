/**
 * 🔴 ADR-635 Φ C.23 — μια οντότητα με **μη-πεπερασμένη** συντεταγμένη φεύγει από την εισαγωγή
 * και **αναφέρεται**· δεν ρίχνει ολόκληρο το αρχείο.
 *
 * ## Το περιστατικό (μετρημένο 2026-07-29, `47_ergasia.dxf`)
 *
 * `Math.min(x, NaN) === NaN`. Άρα **μία** οντότητα με NaN έκανε NaN ολόκληρο το bbox της σκηνής·
 * το `normalizeEntitiesToOrigin` μετά μετέφρασε **κάθε** οντότητα κατά αυτό το NaN ⇒ **1 σπασμένη
 * οντότητα → 2.903 σπασμένες** ⇒ `Scene validation failed` ⇒ **μηδέν** εισαγωγή, με τον έναν ένοχο
 * πνιγμένο μέσα σε 2.903 θύματα.
 *
 * Αυτό ήταν το **αντίθετο** της αρχής του Φ3 (Revit/Figma: εισάγεις ό,τι μπορείς, **αναφέρεις** ό,τι
 * δεν μπορείς) — και ίσχυε για **κάθε** μελλοντικό converter που θα ξέφευγε, όχι μόνο για αυτόν.
 *
 * ## Γιατί ΕΔΩ και όχι στην επικύρωση
 * Ο έλεγχος πρέπει να τρέξει **πριν** από τον υπολογισμό των bounds. Μετά, η μόλυνση είναι καθολική
 * και ο πραγματικός ένοχος γίνεται αδύνατο να ξεχωρίσει από τα θύματά του.
 *
 * ## Γιατί απορρίπτεται και το ±Infinity
 * Το `Infinity − Infinity` ξαναγεννά `NaN` στον υπολογισμό `max − min` — άρα ένα άπειρο κουτί
 * είναι εξίσου δηλητηριώδες με ένα NaN, απλώς αργεί ένα βήμα να φανεί.
 *
 * @see dxf-out-of-extents-filter.ts — ο αδελφός του (ADR-462 R21): ίδιο σχήμα «kept/dropped».
 * @see scene-validation.ts — ο ΕΝΑΣ ορισμός του «μη-πεπερασμένη συντεταγμένη» (κοινός SSoT).
 */

import type { AnySceneEntity } from '../types/scene';
import { recordError, type ImportDiagnostics } from './dxf-import-diagnostics';
import { findNonFiniteCoordinate } from './scene-validation';

export interface NonFiniteFilterResult {
  kept: AnySceneEntity[];
  dropped: number;
}

/**
 * Κρατά όσες οντότητες έχουν αποκλειστικά πεπερασμένη γεωμετρία· οι υπόλοιπες καταγράφονται
 * στα diagnostics (τύπος, `id`, **και η διαδρομή** του πεδίου — π.χ. `points[3].y = NaN`) ώστε
 * το toast «Import Warnings» να ονομάζει τον ένοχο αντί να τον κρύβει.
 */
export function dropNonFiniteEntities(
  entities: AnySceneEntity[],
  diagnostics: ImportDiagnostics,
): NonFiniteFilterResult {
  const kept: AnySceneEntity[] = [];
  let dropped = 0;

  for (const entity of entities) {
    const bad = findNonFiniteCoordinate(entity);
    if (!bad) {
      kept.push(entity);
      continue;
    }
    dropped++;
    recordError(diagnostics, {
      kind: entity.type || 'UNKNOWN',
      reason: `non-finite coordinate at ${bad.path || '<root>'} = ${bad.value}`,
      at: entity.id,
    });
  }

  return { kept, dropped };
}
