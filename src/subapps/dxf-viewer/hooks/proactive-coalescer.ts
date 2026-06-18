/**
 * createMicrotaskCoalescer — SSoT για το «coalesce-ανά-microtask» pattern (ADR-488).
 *
 * Όλοι οι proactive structural hooks (`useProactiveStructuralLoads`,
 * `useProactiveOrganismReinforce`, `useProactiveMemberSizing`, `useStructuralOrganism`,
 * `useProactiveTieBeamTieForce`, `useAutoFoundationDesign`, `useProactiveStructuralAnalysis`
 * κ.ά.) επαναλάμβαναν το ΙΔΙΟ boilerplate: `let scheduled=false` + guard + `queueMicrotask`
 * ώστε πολλά events στο ίδιο tick → ΕΝΑ recompute (low-freq → ADR-040 safe). Αυτό το
 * primitive είναι η **μοναδική πηγή αλήθειας** του coalescing — οι hooks κρατούν μόνο τη
 * δική τους κατάσταση συσσώρευσης (loud/groupable) γύρω από το `run`.
 *
 * **Συμπεριφορά:** η `schedule()` προγραμματίζει ΕΝΑ `run` στο τέλος του τρέχοντος
 * microtask· επιπλέον κλήσεις πριν εκτελεστεί = no-op. Το flag μηδενίζεται **πριν** το
 * `run`, ώστε ένα re-entrant `schedule()` μέσα στο `run` να προγραμματίζει νέο pass
 * (ίδια σημασιολογία με το παλιό `scheduled=false` στην αρχή του recompute).
 *
 * Boy-scout (N.0.2): τα 8 υπάρχοντα αντίγραφα υιοθετούν το primitive **on-touch** —
 * βλ. `.claude-rules/pending-ratchet-work.md`.
 */

/** Coalescer με μία και μόνη μέθοδο `schedule`. */
export interface MicrotaskCoalescer {
  /** Προγραμμάτισε ΕΝΑ `run` στο τέλος του τρέχοντος microtask· διπλές κλήσεις = no-op. */
  schedule(): void;
}

/** Δημιούργησε coalescer που εκτελεί το `run` το πολύ μία φορά ανά microtask. */
export function createMicrotaskCoalescer(run: () => void): MicrotaskCoalescer {
  let scheduled = false;
  return {
    schedule(): void {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        run();
      });
    },
  };
}
