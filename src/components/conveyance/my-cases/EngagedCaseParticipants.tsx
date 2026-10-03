'use client';

/**
 * ADR-901 Φ4 §5.4 καρτέλα 3 — **ποιος είναι στην υπόθεση**, όπως τον βλέπει ο επαγγελματίας.
 *
 * Η δηλωμένη ιδιότητα των **άλλων** (Ε-4) φαίνεται εδώ με την **ίδια** απόδοση που βλέπει ο οικοδεσπότης
 * (`DeclaredCredentialLine`): μία πρόταση, δύο θεατές. Ο server στέλνει **ήδη** μόνο ρόλο, όνομα και δήλωση,
 * χωρίς email ή uid (Α18).
 *
 * @module components/conveyance/my-cases/EngagedCaseParticipants
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DeclaredCredentialLine } from '@/components/conveyance/shared/DeclaredCredentialLine';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { CaseParticipantView } from '@/types/conveyance-case';

function ParticipantRow({ participant }: { readonly participant: CaseParticipantView }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <li className="space-y-1 rounded-md border border-border bg-card p-3">
      <p className="m-0 text-sm font-medium text-foreground">
        {t(`engagement.roles.${participant.role}`)}
        {participant.isViewer && <span className={cn('ml-1 font-normal', colors.text.muted)}>{t('engagement.case.participants.you')}</span>}
      </p>
      <p className="m-0 flex flex-wrap gap-x-3 text-sm">
        {participant.displayName && <span className="text-foreground">{participant.displayName}</span>}
        {participant.declaredCredential
          ? <DeclaredCredentialLine credential={participant.declaredCredential} />
          : <span className={cn('text-xs', colors.text.muted)}>{t('engagement.case.participants.noCredential')}</span>}
      </p>
    </li>
  );
}

export function EngagedCaseParticipants({ participants }: { readonly participants: readonly CaseParticipantView[] }) {
  const { t } = useTranslation(['conveyance']);
  return (
    <section className="space-y-3" aria-labelledby="engaged-case-participants">
      <h2 id="engaged-case-participants" className="m-0 text-base font-semibold text-foreground">{t('engagement.case.participants.title')}</h2>
      <ul className="grid gap-2">
        {participants.map((participant) => (
          <ParticipantRow key={participant.role} participant={participant} />
        ))}
      </ul>
    </section>
  );
}
