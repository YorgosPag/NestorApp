/* eslint-disable design-system/prefer-design-system-imports -- Uses useDesignTokens (semantic colors + icon sizes) */
/**
 * TrashNotice — η **μία** λωρίδα που εξηγεί μια απόσυρση (προειδοποίηση κάδου ή εξήγηση αρχείου).
 *
 * Ζούσε μέσα στην `TrashActionsBar`. Εξήχθη όταν απέκτησε δεύτερο καταναλωτή — την ταινία του κλειδωμένου
 * πλαισίου λεπτομερειών (`RetiredRecordBanner`, ADR-329 §3.9): δεύτερη λωρίδα με δικά της χρώματα θα ήταν
 * δύο όψεις για το ίδιο μήνυμα, στην ίδια οθόνη, η μία κάτω από την άλλη.
 *
 * @component
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { useIconSizes } from "@/hooks/useIconSizes";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";

export type TrashNoticeTone = "warning" | "info";

/**
 * Πλήρεις κλάσεις ανά τόνο — ΟΧΙ σύνθεση `--bg-${tone}`: το Tailwind βλέπει μόνο ό,τι γράφεται ολόκληρο.
 * Και οι δύο τόνοι είναι ζεύγη token (`--bg-*` + `--text-*`) που ορίζονται και στα δύο θέματα.
 */
const NOTICE_TONES = {
  warning: {
    Icon: AlertTriangle,
    box: "bg-[hsl(var(--bg-warning))]/40 border border-[hsl(var(--text-warning))]",
    icon: "text-[hsl(var(--text-warning))]",
  },
  info: {
    Icon: Info,
    box: "bg-[hsl(var(--bg-info))]/40 border border-[hsl(var(--text-info))]",
    icon: "text-[hsl(var(--text-info))]",
  },
} as const satisfies Record<TrashNoticeTone, { Icon: typeof AlertTriangle; box: string; icon: string }>;

interface TrashNoticeProps {
  /** `warning` = η εκκαθάριση του κάδου · `info` = η εξήγηση του αρχείου. */
  readonly tone: TrashNoticeTone;
  /** Μία παράγραφος ή περισσότερες — η λωρίδα δεν αποφασίζει τη δομή του κειμένου. */
  readonly children: ReactNode;
}

export function TrashNotice({ tone, children }: TrashNoticeProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const notice = NOTICE_TONES[tone];

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-md ${notice.box} text-sm ${colors.text.muted}`}>
      <notice.Icon className={`${iconSizes.sm} ${notice.icon} shrink-0 mt-0.5`} />
      <div className="min-w-0 flex flex-col gap-1">{children}</div>
    </div>
  );
}
