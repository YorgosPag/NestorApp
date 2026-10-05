'use client';

/**
 * ADR-901 Φ2 §5.4 — μία κάρτα στα «Οι υποθέσεις μου»: ακίνητο · ρόλος μου · κατάσταση συμμετοχής ·
 * πρόοδος καταλόγου (μόνο αφού αναλάβω) · ημέρα υπογραφής · η επόμενη ενέργεια.
 *
 * 🔑 Η πρόταση δείχνει **ποιο** ακίνητο και **ως τι** — αρκετά για να αποφασίσει ο άνθρωπος — αλλά **τίποτα**
 *    από το περιεχόμενο πριν το «Αναλαμβάνω» (Entra `PendingAcceptance`).
 *
 * @module components/conveyance/my-cases/MyCaseCardView
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ActingForLine } from '@/components/conveyance/acting/ActingWorkspaceField';
import { ENGAGEMENT_STATE_PRESENTATION } from '@/components/sales/conveyance/conveyance-presentation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { caseHomeOf } from '@/lib/conveyance/acting-acceptance';
import { myCaseHref, type CaseHome } from '@/lib/conveyance/conveyance-routes';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { MyCaseCard } from '@/types/conveyance-case';

interface MyCaseCardViewProps {
  readonly card: MyCaseCard;
  /** Το είδος χώρου της λίστας (§15 Γ2) — εφεδρεία **μόνο** όταν η κάρτα δεν ξέρει ακόμη το σπίτι της. */
  readonly home: CaseHome;
  readonly busy: boolean;
  readonly onRespond: (engagementId: string, decision: 'accept' | 'decline') => void;
}

function CardFacts({ card }: { readonly card: MyCaseCard }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <p className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs', colors.text.muted)}>
      {card.caseState && <span>{t(`state.${card.caseState}`)}</span>}
      {card.summary && <span>{t('summary.progress', { complete: card.summary.complete, applicable: card.summary.applicable })}</span>}
      {card.targetSigningDate && <span>{t('engagement.myCases.signing', { date: formatDate(card.targetSigningDate) })}</span>}
      {card.engagementState === 'offered' && <span>{t('engagement.myCases.offerExpires', { date: formatDate(card.expiresAt) })}</span>}
      {/* ADR-901 §15 (Γ1) — για λογαριασμό ποιου ενεργώ: γραφείο, ή προσωρινά ο προσωπικός μου χώρος. */}
      {card.actingFor && <ActingForLine actingFor={card.actingFor} />}
    </p>
  );
}

function CardActions({ card, home, busy, onRespond }: MyCaseCardViewProps) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  if (card.engagementState === 'offered') {
    return (
      <footer className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => onRespond(card.engagementId, 'accept')}>{t('engagement.myCases.accept')}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onRespond(card.engagementId, 'decline')}>{t('engagement.myCases.decline')}</Button>
      </footer>
    );
  }
  if (card.verdict === 'engaged') {
    return (
      <footer>
        {/* §15 Γ2 — ο σύνδεσμος ακολουθεί το ΣΠΙΤΙ της συμμετοχής, όχι το πού βρίσκεται η λίστα. */}
        <Link href={myCaseHref(card.engagementId, caseHomeOf(card.actingFor) ?? home)} className="text-sm font-medium text-foreground underline">{t('engagement.myCases.open')}</Link>
      </footer>
    );
  }
  return <footer className={cn('text-xs', colors.text.muted)}>{t(`engagement.verdicts.${card.verdict}`)}</footer>;
}

export function MyCaseCardView(props: MyCaseCardViewProps) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const { card } = props;
  const presentation = ENGAGEMENT_STATE_PRESENTATION[card.engagementState];
  const Icon = presentation.icon;
  return (
    <article className="space-y-2 rounded-md border border-border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <section className="min-w-0">
          <h2 className="m-0 truncate text-base font-semibold text-foreground">{card.propertyName ?? t('engagement.myCases.untitled')}</h2>
          <p className="m-0 text-sm text-foreground">{t(`engagement.roles.${card.role}`)}</p>
        </section>
        <Badge variant={presentation.variant} className="gap-1">
          <Icon className={iconSizes.xs} aria-hidden="true" />
          {t(`engagement.states.${card.engagementState}`)}
        </Badge>
      </header>
      <CardFacts card={card} />
      <CardActions {...props} />
    </article>
  );
}
