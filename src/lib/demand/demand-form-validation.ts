/**
 * @fileoverview **ΤΙ ΛΕΙΠΕΙ ΑΠΟ ΤΗ ΦΟΡΜΑ** — όλα μαζί, ποτέ ένα τη φορά.
 * @related ADR-777 §7 (Α9 · Α14 §17.2) · types/property-demand.ts
 * @module lib/demand/demand-form-validation
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΠΛΗ ΣΥΝΑΡΤΗΣΗ ΚΑΙ ΟΧΙ `Resolver` ΤΟΥ react-hook-form
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένας `Resolver` αναφέρει σφάλματα **ανά πεδίο, στην υποβολή**. Η **Α14 §17.2**
 * όμως δεσμεύτηκε στο αντίθετο: *«η φόρμα **μικραίνει** όσο δίνεις περισσότερα»*, και
 * το ίδιο το `demandInvariantViolations` τεκμηριώνει ότι επιστρέφει **όλες** τις
 * παραβιάσεις γιατί *«μια φόρμα που διορθώνεται ένα σφάλμα τη φορά είναι η φόρμα που
 * η Α14 §17.2 δεσμεύτηκε να μη φτιάξει — ο χρήστης δεν μπορεί να ξέρει πόσο κοντά
 * είναι αν του λέμε ένα-ένα»*.
 *
 * Άρα εδώ υπολογίζεται **ολόκληρη η εικόνα, συνεχώς**, και η οθόνη τη δείχνει ως
 * λίστα. Το `react-hook-form` μένει αυτό που κάνει καλά — **κατάσταση πεδίων** — και
 * δεν του ανατίθεται πολιτική που δεν είναι δική του.
 *
 * *(Δευτερεύον, αλλά πραγματικό: το `@hookform/resolvers` **δεν είναι εγκατεστημένο**,
 * και δεν εγκαταστάθηκε — το δέντρο μοιράζεται με άλλον agent και ένα `npm install`
 * αγγίζει `package.json` + `package-lock.json`. Μηδέν νέα εξάρτηση.)*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΚΡΙΤΕΣ, ΔΥΟ ΕΡΩΤΗΣΕΙΣ — και **κανένας** δεν ξαναγράφτηκε εδώ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ερώτηση | Ποιος απαντά | Πού ζει |
 * |---|---|---|
 * | «είναι αριθμός αυτό που πληκτρολόγησε;» | `demandFormSchema` (zod) | `demand-form-values.ts` |
 * | «λείπει κάτι για να **φτιαχτεί** ζήτηση;» | `demandFormBlockers` | `demand-form-values.ts` |
 * | «είναι **έγκυρη** ζήτηση;» | `demandInvariantViolations` | **`types/property-demand.ts`** |
 *
 * Το τρίτο είναι το σημαντικό: είναι η **ίδια** συνάρτηση που φρουρεί την **πύλη
 * γραφής** (`property-demand.service.ts`). Δεύτερο σύνολο κανόνων εδώ θα απέκλινε
 * στην πρώτη αλλαγή, και ο χρήστης θα έβλεπε «αποθηκεύεται…» και μετά αποτυχία
 * **χωρίς πεδίο** — το χειρότερο δυνατό μήνυμα.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import {
  demandInvariantViolations,
  type DemandInvariant,
} from '@/types/property-demand';
import {
  demandDraftFrom,
  demandFormBlockers,
  demandFormSchema,
  type DemandDraft,
  type DemandFormBlocker,
  type DemandFormValues,
} from './demand-form-values';

/**
 * Η πλήρης εικόνα της φόρμας — **ποτέ boolean**.
 *
 * 🔑 Τα τρία σκέλη είναι **χωριστά** επειδή έχουν διαφορετική θεραπεία για τον
 * άνθρωπο: το `malformed` σημαίνει «αυτό δεν είναι αριθμός», το `blockers` «λείπει
 * βήμα», το `violations` «αντιφάσκεις». Ένα κοινό «η φόρμα δεν είναι έγκυρη» θα τον
 * έστελνε να ψάξει.
 */
export type DemandFormValidation =
  | {
      readonly kind: 'ready';
      readonly draft: DemandDraft;
    }
  | {
      readonly kind: 'incomplete';
      /** Πεδία που δεν διαβάζονται καν ως σχήμα (π.χ. γράμματα σε αριθμό). */
      readonly malformed: readonly string[];
      /** Λείπει βήμα της φόρμας — δεν είναι άκυρη ζήτηση, δεν είναι ζήτηση **ακόμη**. */
      readonly blockers: readonly DemandFormBlocker[];
      /** Αντιφάσεις της ίδιας της ζήτησης. **Όλες**, ποτέ η πρώτη. */
      readonly violations: readonly DemandInvariant[];
    };

/**
 * **Τιμές φόρμας → μπορεί να σταλεί;**
 *
 * ⚠️ **Το `malformed` κόβει πριν από τα άλλα δύο, και είναι σειρά-συμβόλαιο**: όταν
 * το σχήμα δεν διαβάζεται, οι κανόνες θα έκριναν **τιμές που δεν υπάρχουν**. Ίδιο
 * πρότυπο με τη σειρά ταξινόμησης του CHECK 3.47: μια ερώτηση που δεν μπορεί να τεθεί
 * δεν απαντιέται «όχι» — δεν τίθεται.
 */
export function validateDemandForm(values: DemandFormValues): DemandFormValidation {
  const parsed = demandFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      kind: 'incomplete',
      malformed: [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))],
      blockers: [],
      violations: [],
    };
  }

  const blockers = demandFormBlockers(parsed.data);
  const draft = demandDraftFrom(parsed.data);
  const violations = demandInvariantViolations(draft);

  if (blockers.length > 0 || violations.length > 0) {
    return { kind: 'incomplete', malformed: [], blockers, violations };
  }

  return { kind: 'ready', draft };
}
