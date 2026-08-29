/**
 * @fileoverview **ΤΙ ΕΓΙΝΕ Η ΑΠΟΔΟΧΗ** — το λεξιλόγιο, ποτέ η πράξη (ADR-827 §9.21).
 * @related services/mandate/mandate-acceptance.service.ts · mandate-acceptance-prepare.ts
 * @module services/mandate/mandate-acceptance-types
 *
 * 🔴 **ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΜΕ ΤΟΥ
 * `mandate-decision-vocabulary.ts`**: τους ίδιους τύπους τους χρειάζονται **και** ο
 * ενορχηστρωτής της αποδοχής **και** η ετοιμασία που εκείνος καλεί. Γραμμένοι σε
 * οποιονδήποτε από τους δύο, η εισαγωγή θα ήταν **κυκλική** — και ο συνηθισμένος
 * «διορθωτής» της κυκλικότητας είναι το `import type` που φαίνεται να δουλεύει μέχρι
 * κάποιος να χρειαστεί **τιμή** και όχι τύπο.
 *
 * **Layering**: leaf — μόνο τύποι, κανένα I/O, κανένα ρολόι.
 */

import type { MandateRequest } from '@/types/mandate-request';
import type { MandateInvariant } from '@/types/owner-property-mandate';

import type { MandateDecisionRefusal } from '@/services/mandate/mandate-decision-vocabulary';

/** Τι έγινε η αποδοχή. */
export type AcceptanceOutcome =
  | {
      readonly kind: 'accepted';
      readonly clientContactId: string;
      /** Γεννήθηκε **νέα** καρτέλα, ή αναγνωρίστηκε υπάρχουσα; — για το ίχνος ελέγχου. */
      readonly contactCreated: boolean;
    }
  | {
      readonly kind: 'refused';
      readonly reason: MandateDecisionRefusal;
      readonly violations?: readonly MandateInvariant[];
    }
  /** 🔴 **Δεν μάθαμε** — ποτέ ίδιο με άρνηση (N.12). */
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'failed' };

export interface AcceptanceInput {
  readonly request: MandateRequest;
  readonly agencyCompanyId: string;
  /** Ο υπάλληλος που πάτησε — ταξιδεύει **μόνο** στο ίχνος ελέγχου. */
  readonly deciderUid: string;
  readonly nowISO: string;
}

/**
 * **Ό,τι ΔΕΝ είναι αποδοχή** — άρνηση, άγνωστο ή βλάβη, ποτέ τα τρία μαζί (N.12).
 *
 * 🔑 Ζει **εδώ** επειδή τον ρωτούν **και οι δύο φάσεις**: η ετοιμασία τον επιστρέφει
 * σε κάθε ανάγνωση που δεν προχωρά, και το CAS της συναλλαγής τον ξαναπαράγει με τα
 * **φρέσκα** έγγραφα.
 */
export type Refusal = Exclude<AcceptanceOutcome, { kind: 'accepted' }>;
