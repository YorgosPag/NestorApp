/**
 * Integrity — αποτύπωμα **εισόδων** (ποτέ αποτελέσματος)
 *
 * ADR-734 §6.3 κανόνας 2: το `inputsHash` υπολογίζεται από κανονικοποιημένες
 * **εισόδους**. Ίδιες είσοδοι + ίδια `engineVersion` ⇒ ίδιο hash.
 *
 * **Τι μπαίνει στο preimage και γιατί:**
 *
 * | Στοιχείο        | Γιατί |
 * |-----------------|-------|
 * | `preimageVersion` | Domain separation: αλλαγή του κωδικοποιητή ΠΡΕΠΕΙ να αλλάζει τα hashes, αλλιώς παλιά και νέα αποτυπώματα συγκρίνονται ψευδώς ως ίσα |
 * | `engineVersion` | Ίδιες είσοδοι σε άλλη μηχανή ≠ ίδιος αριθμός (μοτίβο Bazel action key) |
 * | `computedBy` | Ίδια items, άλλη δραστηριότητα ⇒ άλλο παράγωγο (PROV-O `prov:Activity`) |
 * | `items` | **Πλήρης** κατάσταση των items, ταξινομημένη κατά id |
 * | `params` | Ό,τι άλλο διάβασε ο υπολογισμός (π.χ. `Map` ονομάτων κατηγοριών, λίστα ακινήτων) |
 *
 * **Τι ΔΕΝ μπαίνει:** το `value` (θα ήταν hash αποτελέσματος — άλλη ερώτηση) και
 * το `computedAt` (το αποτύπωμα απαντά «ίδιες είσοδοι;», όχι «ίδια στιγμή;»).
 *
 * **Γιατί πλήρης κατάσταση item και όχι μόνο τα «σχετικά» πεδία:** η υπερ-
 * προσέγγιση είναι ασφαλής (δύο ίδια hashes ⇒ όντως ίδιες είσοδοι), ενώ η υπο-
 * προσέγγιση είναι επικίνδυνη (δύο διαφορετικές είσοδοι θα μπορούσαν να δώσουν
 * ίδιο hash και να δηλωθεί ψευδώς αναπαραγωγιμότητα). Ίδια λογική με Bazel/Nix.
 * Τα `updatedAt`/`createdAt` δεν προσθέτουν θόρυβο: αλλάζουν μόνο όταν αλλάζει
 * πράγματι το έγγραφο.
 *
 * @module services/agent-capability/vqe/integrity
 * @see ADR-734 §6.2, §6.3 κανόνας 2
 */

import type { BOQItem } from '@/types/boq';
import type { IntegrityRecord, ProvenanceActivity } from '@/types/vqe';
import { canonicalize } from './canonical-encoding';
import { sha256HexSync } from './hashing';
import { compareCodeUnits } from './ordering';

/**
 * Έκδοση της **μορφής του preimage** (γραμματική κωδικοποίησης + σύνθεση
 * πεδίων). Αύξησέ την σε ΚΑΘΕ αλλαγή είτε εδώ είτε στο `canonical-encoding`.
 */
export const VQE_PREIMAGE_VERSION = 1;

/** Είσοδοι από τις οποίες παράγεται το αποτύπωμα ακεραιότητας. */
export interface IntegrityInputs {
  /** Πλήρης έκδοση μηχανής (`resolveEngineVersion()`). */
  readonly engineVersion: string;
  /** Η δραστηριότητα που παρήγαγε την τιμή. */
  readonly computedBy: ProvenanceActivity;
  /** Τα BOQ items που διάβασε ο υπολογισμός. */
  readonly sourceItems: readonly BOQItem[];
  /** Κάθε άλλη είσοδος του υπολογισμού. `undefined` όταν δεν υπάρχει. */
  readonly params: unknown;
}

/**
 * Τα items σε κανονική σειρά (κατά id, code unit).
 *
 * Ταξινόμηση ⇒ το αποτύπωμα είναι ανεξάρτητο της σειράς άφιξης: το ίδιο
 * **σύνολο** items δίνει το ίδιο hash είτε ήρθε από Firestore query είτε από
 * cache σε άλλη σειρά. Διπλότυπα ΔΕΝ αφαιρούνται εδώ — αν ο υπολογισμός
 * μέτρησε δύο φορές το ίδιο item, το αποτύπωμα οφείλει να το αποτυπώσει
 * (το `provenance` το επισημαίνει ξεχωριστά ως προειδοποίηση).
 */
function canonicalItemOrder(items: readonly BOQItem[]): readonly BOQItem[] {
  return [...items].sort((a, b) => compareCodeUnits(a.id, b.id));
}

/** sha256 (hex) των κανονικοποιημένων εισόδων. */
export function computeInputsHash(inputs: IntegrityInputs): string {
  return sha256HexSync(
    canonicalize({
      preimageVersion: VQE_PREIMAGE_VERSION,
      engineVersion: inputs.engineVersion,
      computedBy: inputs.computedBy,
      items: canonicalItemOrder(inputs.sourceItems),
      params: inputs.params,
    }),
  );
}

/** Το πλήρες `IntegrityRecord` του φακέλου. */
export function buildIntegrityRecord(inputs: IntegrityInputs): IntegrityRecord {
  return {
    inputsHash: computeInputsHash(inputs),
    engineVersion: inputs.engineVersion,
  };
}
