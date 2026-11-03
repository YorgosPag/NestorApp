'use client';

/**
 * Η κατάσταση ενός συμφωνητικού υπεργολαβίας όπως τη δείχνει η οθόνη (ADR-928 §5.5 · Φ3α-2) — **ένα** σημείο για
 * εικονίδιο + τόνο + ετικέτα, κοινό για τη λίστα, τα φίλτρα και (Φ3γ) τον επεξεργαστή.
 *
 * Κάθε κατάσταση έχει **δικό της εικονίδιο**, ώστε να διαβάζεται χωρίς χρώμα (CHECK 3.41)· ο τόνος είναι δεύτερο
 * κανάλι, ποτέ το μόνο. Οι τερματικές «χωρίς συμφωνία» (απορρίφθηκε · αποσύρθηκε) είναι ουδέτερες: δεν είναι βλάβη.
 * Το χρώμα από το SSoT του design system (`getStatusColor`, πλαίσιο + κείμενο — ποτέ γέμισμα + κείμενο ίδιου token).
 */

import {
  Ban,
  CalendarX,
  CheckCircle2,
  FilePen,
  FileSignature,
  HardHat,
  Send,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { cn, getStatusColor } from '@/lib/design-system';
import type { SubcontractAgreementStatus } from '@/subapps/procurement/subcontracts/types/agreement';

/** Ο τόνος ως λέξη του design system (`resolveStatusToken`)· `null` = ουδέτερο. */
type StatusTone = 'info' | 'warning' | 'success' | 'error' | 'completed' | null;

interface StatusPresentation {
  readonly icon: LucideIcon;
  readonly tone: StatusTone;
}

export const SUBCONTRACT_AGREEMENT_STATUS_PRESENTATION: Readonly<Record<SubcontractAgreementStatus, StatusPresentation>> = {
  draft: { icon: FilePen, tone: null },
  issued: { icon: Send, tone: 'info' },
  accepted: { icon: FileSignature, tone: 'info' },
  in_execution: { icon: HardHat, tone: 'success' },
  completed: { icon: CheckCircle2, tone: 'completed' },
  discarded: { icon: Trash2, tone: null },
  withdrawn: { icon: Undo2, tone: null },
  expired: { icon: CalendarX, tone: 'warning' },
  terminated: { icon: Ban, tone: 'error' },
};

/** Οι κλάσεις τόνου μιας κατάστασης (πλαίσιο + κείμενο) — κοινές για badge και φίλτρα. */
export function subcontractStatusToneClasses(status: SubcontractAgreementStatus): string {
  const { tone } = SUBCONTRACT_AGREEMENT_STATUS_PRESENTATION[status];
  if (tone === null) return 'text-muted-foreground';
  return cn(getStatusColor(tone, 'text'), getStatusColor(tone, 'border'));
}

interface SubcontractAgreementStatusBadgeProps {
  readonly status: SubcontractAgreementStatus;
  readonly className?: string;
}

export function SubcontractAgreementStatusBadge({ status, className }: SubcontractAgreementStatusBadgeProps) {
  const { t } = useTranslation('procurement');
  const Icon = SUBCONTRACT_AGREEMENT_STATUS_PRESENTATION[status].icon;
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium whitespace-nowrap', subcontractStatusToneClasses(status), className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t(`subcontracts.status.${status}`)}
    </Badge>
  );
}
