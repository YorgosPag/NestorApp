'use client';

/**
 * @fileoverview **«ΠΟΥ ΒΡΙΣΚΟΜΑΙ ΚΑΙ ΠΟΣΑ ΜΕΝΟΥΝ;»** — τα βήματα μιας πρόσκλησης (ADR-915 §39, 2026-11-14).
 * @module components/invitations/InvitationSteps
 *
 * Πρώτο βήμα **πάντα** ο λογαριασμός· τα επόμενα τα δίνει το είδος (ήδη μεταφρασμένα). Σημασιολογικό `<ol>` με
 * `aria-current="step"` (WAI-ARIA) — ο αναγνώστης οθόνης λέει «βήμα 1 από 3, τρέχον».
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { INVITATION_ACCOUNT_KEYS, INVITATION_ACCOUNT_NS } from './invitation-account-labels';

interface InvitationStepsProps {
  /** Τα βήματα **μετά** τον λογαριασμό, μεταφρασμένα από το είδος. */
  readonly after: readonly string[];
  /** 0 = λογαριασμός. */
  readonly current: number;
}

export function InvitationSteps({ after, current }: InvitationStepsProps) {
  const { t } = useTranslation([INVITATION_ACCOUNT_NS]);
  const steps = [t(INVITATION_ACCOUNT_KEYS.stepAccount), ...after];
  return (
    <nav aria-label={t(INVITATION_ACCOUNT_KEYS.stepsLabel)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === current ? 'step' : undefined}
            className={cn(index === current ? 'font-semibold text-foreground' : 'text-muted-foreground')}
          >
            {index + 1}. {label}
            {index < steps.length - 1 ? <span aria-hidden="true"> → </span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
