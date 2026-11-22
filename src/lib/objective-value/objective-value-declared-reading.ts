/**
 * @fileoverview ADR-949 Α4 — **οι τιμές που δηλώσατε από έγγραφο**: ποια είσοδος, ποια τιμή, από ποιο έγγραφο και σελίδα.
 *   Χωριστά από τους αναγνώστες (`objective-value-document-reading.ts`), ώστε ο κάτοχος του προχείρου και η προέλευση
 *   να μη σέρνουν τον αναγνώστη Ε9 στο αρχικό φορτίο της σελίδας — εκείνος ταξιδεύει με τον τεμπέλικο οδηγό.
 * @related `objective-value-input-provenance.ts` (το «δηλώσατε από») · `components/objective-value/ObjectiveValueContent.tsx`
 * @module lib/objective-value/objective-value-declared-reading
 *
 * 🔴 **Ζει μόνο στη μνήμη της σελίδας** — ποτέ στη διεύθυνση, ποτέ σε αποθήκη (ADR-947 Δ2): τη φτιάχνει οποιοσδήποτε.
 *
 * **Layering**: leaf — τύποι + καθαρή συνάρτηση, μηδέν I/O.
 */

import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';

import type { ObjectiveValueDraft } from './objective-value-draft';

/** Από πού δηλώθηκε μια τιμή: το έγγραφο (id του καταλόγου ανεβάσματος) και η σελίδα του. */
export interface ObjectiveValueDeclarationSource {
  readonly document: ObjectiveValueEvidenceDocument;
  readonly page: number;
}

/** Η είσοδος του υπολογιστή που γράφτηκε από έγγραφο — στη γλώσσα της προέλευσης (`levelFloor`/`levelArea` ανά επίπεδο). */
export type ObjectiveValueDeclaredTarget =
  | { readonly input: 'area' }
  | { readonly input: 'levelFloor'; readonly level: number }
  | { readonly input: 'levelArea'; readonly level: number };

/** Μια αποδεκτή ανάγνωση: ποια είσοδος, ποια τιμή, από ποιο έγγραφο. */
export interface ObjectiveValueDeclaredReading {
  readonly target: ObjectiveValueDeclaredTarget;
  readonly value: number;
  readonly source: ObjectiveValueDeclarationSource;
}

/** Η αποδοχή: μία αλλαγή του προχείρου + οι δηλώσεις για την προέλευση. */
export interface ObjectiveValueReadingApplication {
  readonly patch: Partial<ObjectiveValueDraft>;
  readonly declared: readonly ObjectiveValueDeclaredReading[];
}

function sameTarget(a: ObjectiveValueDeclaredTarget, b: ObjectiveValueDeclaredTarget): boolean {
  return a.input === b.input && (a.input === 'area' || (b.input !== 'area' && a.level === b.level));
}

/**
 * Νέες δηλώσεις πάνω στις παλιές: ίδια είσοδος ⇒ κερδίζει η νεότερη. Αλλαγή είδους (επίπεδα κατοικίας ↔ επιφάνεια
 * αποθήκης/στάθμευσης) ⇒ οι δηλώσεις του παλιού είδους δεν αφορούν πια τίποτα — φεύγουν.
 */
export function mergeDeclaredReadings(
  previous: readonly ObjectiveValueDeclaredReading[],
  next: readonly ObjectiveValueDeclaredReading[],
): readonly ObjectiveValueDeclaredReading[] {
  if (next.length === 0) return previous;
  const residenceNext = next.some(({ target }) => target.input !== 'area');
  const kept = previous.filter(
    ({ target }) => !next.some((reading) => sameTarget(reading.target, target)) && (target.input === 'area') !== residenceNext,
  );
  return [...kept, ...next];
}
