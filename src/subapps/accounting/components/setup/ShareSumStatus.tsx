'use client';

/**
 * @fileoverview **«Σύνολο ποσοστών = 100%»** — μία ανακοίνωση για εταίρους, μέλη και μετόχους.
 * @module subapps/accounting/components/setup/ShareSumStatus
 *
 * 🔴 **ΕΞΑΓΩΓΗ (N.0.2 · CHECK 3.28)**: το ίδιο μπλοκ ζούσε **τρεις** φορές (ΟΕ · ΕΠΕ · ΑΕ), με
 * το ίδιο κατώφλι ανοχής και την ίδια εναλλαγή `status`/`alert`. Βρέθηκε όταν η Α23 (ADR-841 §7)
 * άγγιξε τις τρεις ενότητες για το πεδίο ΓΕΜΗ.
 *
 * ⚠️ Δέχεται **έτοιμο κείμενο**, όχι κλειδιά: κάθε `t()` μένει στον γονέα με κυριολεκτικό κλειδί
 * (ορατό στη CHECK 3.8) — ίδιο δόγμα με το `HintedField`.
 */

import { AlertTriangle } from 'lucide-react';

/** Ανοχή στρογγυλοποίησης: ποσοστά με δύο δεκαδικά αθροίζουν συχνά σε 99.999… */
const SHARE_SUM_TOLERANCE = 0.01;

function isCompleteShareSum(sum: number): boolean {
  return Math.abs(sum - 100) <= SHARE_SUM_TOLERANCE;
}

interface ShareSumStatusProps {
  readonly sum: number;
  /** Π.χ. «Σύνολο ποσοστών: 100.00%» — ήδη μεταφρασμένο. */
  readonly sumLabel: string;
  readonly validLabel: string;
  readonly invalidLabel: string;
}

export function ShareSumStatus({ sum, sumLabel, validLabel, invalidLabel }: ShareSumStatusProps) {
  const valid = isCompleteShareSum(sum);

  return (
    <div
      className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
        valid
          ? 'border-[hsl(var(--text-success))] bg-[hsl(var(--bg-success))]/10 text-[hsl(var(--text-success))]'
          : 'border-destructive/50 bg-destructive/5 text-destructive'
      }`}
      role={valid ? 'status' : 'alert'}
    >
      {!valid && <AlertTriangle className="h-4 w-4 flex-shrink-0" />}
      {sumLabel}
      {valid ? ` — ${validLabel}` : ` — ${invalidLabel}`}
    </div>
  );
}
