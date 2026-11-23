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

/** Οι είσοδοι **θέσης** (όροφος/επιφάνεια) — εξαρτώνται από το είδος: επίπεδα κατοικίας ή επιφάνεια αποθήκης/στάθμευσης. */
type ObjectiveValuePlaceTarget =
  | { readonly input: 'area' }
  | { readonly input: 'levelFloor'; readonly level: number }
  | { readonly input: 'levelArea'; readonly level: number };

/**
 * Η είσοδος του υπολογιστή που γράφτηκε από έγγραφο — στη γλώσσα της προέλευσης (`levelFloor`/`levelArea` ανά επίπεδο).
 * ADR-949 Α-3: + η ημερομηνία άδειας, κοινή σε κάθε είδος.
 */
export type ObjectiveValueDeclaredTarget = ObjectiveValuePlaceTarget | { readonly input: 'permitDate' };

/** Μια αποδεκτή ανάγνωση: ποια είσοδος, ποια τιμή (στον τύπο της εισόδου), από ποιο έγγραφο. */
export type ObjectiveValueDeclaredReading =
  | { readonly target: ObjectiveValuePlaceTarget; readonly value: number; readonly source: ObjectiveValueDeclarationSource }
  | {
      readonly target: { readonly input: 'permitDate' };
      /** `YYYY-MM-DD` — η μορφή του προχείρου. */
      readonly value: string;
      readonly source: ObjectiveValueDeclarationSource;
    };

/** Η αποδοχή: μία αλλαγή του προχείρου + οι δηλώσεις για την προέλευση. */
export interface ObjectiveValueReadingApplication {
  readonly patch: Partial<ObjectiveValueDraft>;
  readonly declared: readonly ObjectiveValueDeclaredReading[];
}

const levelOf = (target: ObjectiveValueDeclaredTarget): number | null => ('level' in target ? target.level : null);

function sameTarget(a: ObjectiveValueDeclaredTarget, b: ObjectiveValueDeclaredTarget): boolean {
  return a.input === b.input && levelOf(a) === levelOf(b);
}

/** Σε ποιο είδος ανήκει μια είσοδος θέσης — `null` για όσες είναι κοινές σε κάθε είδος (ημερομηνία άδειας). */
function placeKindOf(target: ObjectiveValueDeclaredTarget): 'unit' | 'levels' | null {
  if (target.input === 'permitDate') return null;
  return target.input === 'area' ? 'unit' : 'levels';
}

/**
 * Νέες δηλώσεις πάνω στις παλιές: ίδια είσοδος ⇒ κερδίζει η νεότερη. Αλλαγή είδους (επίπεδα κατοικίας ↔ επιφάνεια
 * αποθήκης/στάθμευσης) ⇒ οι δηλώσεις θέσης του παλιού είδους δεν αφορούν πια τίποτα — φεύγουν. Η ημερομηνία άδειας
 * είναι κοινή: ούτε διώχνει ούτε διώχνεται από αλλαγή είδους.
 */
export function mergeDeclaredReadings(
  previous: readonly ObjectiveValueDeclaredReading[],
  next: readonly ObjectiveValueDeclaredReading[],
): readonly ObjectiveValueDeclaredReading[] {
  if (next.length === 0) return previous;
  const nextPlaceKind = next.map(({ target }) => placeKindOf(target)).find((kind) => kind !== null) ?? null;
  const kept = previous.filter(({ target }) => {
    if (next.some((reading) => sameTarget(reading.target, target))) return false;
    const kind = placeKindOf(target);
    return kind === null || nextPlaceKind === null || kind === nextPlaceKind;
  });
  return [...kept, ...next];
}
