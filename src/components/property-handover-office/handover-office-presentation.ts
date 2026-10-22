/**
 * @fileoverview **Πώς φαίνεται η κρίση της καρτέλας «Παράδοση»** — σήμα · εικονίδιο · σειρά ανά κάτοχο κίνησης, και
 *   εικονίδιο ανά κατάσταση βήματος (ADR-916 §5.15 Φ-Δ).
 * @related lib/property-handover/handover-office-status.ts (η κρίση) · PropertyHandoverView.tsx (ο καταναλωτής)
 * @module components/property-handover-office/handover-office-presentation
 *
 * 🔑 **Ένα σημείο για τη γλώσσα των χρωμάτων**: κάθε κάτοχος κίνησης έχει **λέξη + εικονίδιο + χρώμα** (ποτέ μόνο χρώμα —
 *    WCAG 1.4.1). Τα κείμενα ζουν στο i18n (`properties-detail:handover.move.*`), όχι εδώ.
 * 🎯 **Σειρά «Action Required» πρώτα** (DocuSign Manage): ό,τι περιμένει το γραφείο ανεβαίνει πάνω· ό,τι δεν θέλει
 *    τίποτα πέφτει κάτω.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  FileSignature,
  Hourglass,
  Minus,
  OctagonAlert,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

import type { BadgeVariantProps } from '@/components/ui/badge';
import type { HandoverOfficeMove, HandoverOfficeStepState, PropertyHandoverOfficeEntry } from '@/types/property-handover';

interface HandoverMovePresentation {
  readonly variant: NonNullable<BadgeVariantProps['variant']>;
  readonly Icon: LucideIcon;
  /** Μικρότερο ⇒ ψηλότερα στη λίστα. */
  readonly priority: number;
}

export const HANDOVER_MOVE_PRESENTATION: Readonly<Record<HandoverOfficeMove, HandoverMovePresentation>> = {
  office: { variant: 'warning', Icon: AlertTriangle, priority: 0 },
  buyer: { variant: 'info', Icon: Hourglass, priority: 1 },
  system: { variant: 'secondary', Icon: RefreshCw, priority: 2 },
  sale: { variant: 'secondary', Icon: FileSignature, priority: 3 },
  none: { variant: 'muted', Icon: Minus, priority: 4 },
};

/** Το χρώμα ενός βήματος — όνομα του semantic κλειδιού (`useSemanticColors().text.*`), ποτέ κλάση εδώ. */
type HandoverStepTone = 'success' | 'info' | 'warning' | 'muted';

export const HANDOVER_STEP_PRESENTATION: Readonly<Record<HandoverOfficeStepState, { readonly Icon: LucideIcon; readonly tone: HandoverStepTone }>> = {
  done: { Icon: CheckCircle2, tone: 'success' },
  current: { Icon: CircleDot, tone: 'info' },
  blocked: { Icon: OctagonAlert, tone: 'warning' },
  pending: { Icon: Circle, tone: 'muted' },
};

/** Ταξινόμηση: πρώτα ό,τι περιμένει το γραφείο· σταθερή μέσα σε κάθε ομάδα (σειρά του διακομιστή). */
export function sortHandoverEntries(entries: readonly PropertyHandoverOfficeEntry[]): readonly PropertyHandoverOfficeEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => HANDOVER_MOVE_PRESENTATION[a.entry.status.move].priority - HANDOVER_MOVE_PRESENTATION[b.entry.status.move].priority || a.index - b.index)
    .map(({ entry }) => entry);
}

/** Πόσες παραδόσεις ανά κάτοχο κίνησης — μόνο όσοι έχουν τουλάχιστον μία, με τη σειρά προτεραιότητας. */
export function handoverMoveCounts(entries: readonly PropertyHandoverOfficeEntry[]): readonly { readonly move: HandoverOfficeMove; readonly count: number }[] {
  const counts = new Map<HandoverOfficeMove, number>();
  for (const { status } of entries) counts.set(status.move, (counts.get(status.move) ?? 0) + 1);
  return [...counts]
    .map(([move, count]) => ({ move, count }))
    .sort((a, b) => HANDOVER_MOVE_PRESENTATION[a.move].priority - HANDOVER_MOVE_PRESENTATION[b.move].priority);
}
