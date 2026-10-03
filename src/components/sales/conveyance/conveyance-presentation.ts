/**
 * ADR-901 Φ1 — πώς φαίνεται κάθε κατάσταση γραμμής: **σχήμα + κείμενο + χρώμα**, ποτέ μόνο
 * χρώμα (CHECK 3.41 — «ξέρω ποιο είναι ποιο χωρίς να δω χρώμα;»). ΕΝΑΣ πίνακας για όλη την
 * καρτέλα — το κείμενο ζει στο `conveyance.json` (`status.<κατάσταση>`).
 *
 * @module components/sales/conveyance/conveyance-presentation
 */

import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  FileClock,
  FileQuestion,
  FileWarning,
  HelpCircle,
  Hourglass,
  Landmark,
  LogOut,
  type LucideIcon,
  MailQuestion,
  ShieldCheck,
  ShieldOff,
  Undo2,
  XCircle,
} from 'lucide-react';
import type { ChecklistRowStatus } from '@/types/conveyance-case';
import type { EngagementState } from '@/types/engagement';

type ConveyanceBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'muted' | 'outline';

interface StatusPresentation {
  readonly icon: LucideIcon;
  readonly variant: ConveyanceBadgeVariant;
}

export const STATUS_PRESENTATION: Readonly<Record<ChecklistRowStatus, StatusPresentation>> = {
  needs_answer: { icon: HelpCircle, variant: 'outline' },
  missing: { icon: FileQuestion, variant: 'error' },
  uploaded: { icon: FileClock, variant: 'info' },
  stale: { icon: FileWarning, variant: 'warning' },
  rejected: { icon: XCircle, variant: 'error' },
  accepted: { icon: CheckCircle2, variant: 'success' },
  expiring: { icon: Clock, variant: 'warning' },
  expired: { icon: AlertTriangle, variant: 'error' },
  notary_side: { icon: Landmark, variant: 'muted' },
  not_applicable: { icon: CircleSlash, variant: 'muted' },
};

/** Σειρά προτεραιότητας μέσα σε ενότητα: ό,τι θέλει ενέργεια πρώτο (σχήμα «inbox»). */
export const STATUS_ORDER: readonly ChecklistRowStatus[] = [
  'expired', 'rejected', 'missing', 'stale', 'expiring', 'uploaded', 'needs_answer', 'notary_side', 'accepted', 'not_applicable',
];

/**
 * ADR-901 Φ2 — η κατάσταση **συμμετοχής** επαγγελματία: ίδιο δόγμα (σχήμα + κείμενο + χρώμα). Επτά καταστάσεις,
 * **επτά διαφορετικά εικονίδια** — το «ανακλήθηκε» δεν μοιάζει με το «έληξε», γιατί έχουν άλλη θεραπεία (ADR-862 Α4).
 * Κείμενο: `conveyance.json` → `engagement.states.<κατάσταση>`.
 */
export const ENGAGEMENT_STATE_PRESENTATION: Readonly<Record<EngagementState, StatusPresentation>> = {
  offered: { icon: MailQuestion, variant: 'info' },
  active: { icon: ShieldCheck, variant: 'success' },
  declined: { icon: XCircle, variant: 'muted' },
  withdrawn: { icon: Undo2, variant: 'muted' },
  revoked: { icon: ShieldOff, variant: 'error' },
  expired: { icon: Hourglass, variant: 'warning' },
  completed: { icon: LogOut, variant: 'muted' },
};
