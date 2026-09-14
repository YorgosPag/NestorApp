/**
 * @fileoverview **Πόσες φορές, και πόσο αραιά, ξαναζητάμε ένα chunk** πριν ρωτήσουμε αν άλλαξε
 * η έκδοση.
 * @related ADR-860 §Ε3
 * @module lib/app-version/chunk-recovery/retry-policy
 *
 * 🔑 **ΓΙΑΤΙ ΕΠΑΝΑΛΗΨΗ ΠΡΙΝ ΑΠΟ ΟΤΙΔΗΠΟΤΕ ΑΛΛΟ**: τα προσωρινά σφάλματα δικτύου (κινητό σε
 * τούνελ, αλλαγή Wi-Fi, container που αλλάζει εκείνο το δευτερόλεπτο) είναι η **συχνότερη**
 * αιτία — το ADR-858 §5.5 την κατέγραψε με `curl 200` δευτερόλεπτα μετά την αποτυχία. Μια
 * αόρατη επανάληψη λύνει το πρόβλημα **χωρίς** να μάθει ποτέ ο άνθρωπος ότι υπήρξε.
 *
 * 🔑 **ΓΙΑΤΙ jitter**: μετά από deploy **πολλές** καρτέλες αποτυγχάνουν την ίδια στιγμή. Χωρίς
 * τυχαιότητα θα ξαναχτυπούσαν όλες μαζί σε κάθε βήμα (thundering herd). Πρότυπο AWS
 * Architecture Blog, «Exponential Backoff and Jitter» — *full jitter*.
 *
 * ⚠️ Η τυχαιότητα **εγχέεται** (`random`) ώστε τα tests να είναι ντετερμινιστικά.
 */

/** Οι ρυθμίσεις — ΕΝΑ σημείο. Συνολική αναμονή στη χειρότερη περίπτωση ≈ 0,3 + 0,9 + 2,7 = 3,9s. */
export const CHUNK_RETRY_POLICY = {
  /** Επαναλήψεις **μετά** την πρώτη αποτυχία. */
  maxRetries: 3,
  /** Βάση του εκθετικού backoff. */
  baseDelayMs: 300,
  /** Πολλαπλασιαστής ανά βήμα. */
  factor: 3,
  /** Οροφή μίας αναμονής — ποτέ άνθρωπος να κοιτά κενή οθόνη για πολύ. */
  maxDelayMs: 3_000,
} as const;

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly factor: number;
  readonly maxDelayMs: number;
}

/**
 * Αναμονή πριν από την επανάληψη `attempt` (0-based). *Full jitter*: ομοιόμορφα στο
 * `[ceiling/2, ceiling]` — το κάτω μισό κρατά την αναμονή ουσιαστική ώστε η επανάληψη να μην
 * πέσει στο **ίδιο** παράθυρο βλάβης.
 */
export function retryDelayMs(
  attempt: number,
  policy: RetryPolicy = CHUNK_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * policy.factor ** attempt);
  const half = ceiling / 2;
  return Math.round(half + random() * half);
}
