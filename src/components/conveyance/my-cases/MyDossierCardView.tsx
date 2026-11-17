'use client';

/**
 * ADR-916 Φ-Ε1 · ADR-862 §5.3.11 — μία κάρτα **φακέλου ιδιώτη** στα «Οι υποθέσεις μου»: ποιος φάκελος · με ποιον ρόλο ·
 * ως πότε · άνοιγμα.
 *
 * 🔑 Η συμμετοχή γεννιέται **ήδη ενεργή** από την αποδοχή της πρόσκλησης (όπως η ανάθεση έκδοσης) — καμία «Αναλαμβάνω»
 *    εδώ. Ετυμηγορία ≠ `engaged` ⇒ ονομασμένος λόγος (ίδιο λεξιλόγιο με τα άλλα είδη: ληγμένη · ανακλημένη…).
 * 🔒 Κανένα στοιχείο του κατόχου — μόνο το όνομα του φακέλου, όπως το έδωσε ο ίδιος.
 *
 * @module components/conveyance/my-cases/MyDossierCardView
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ActingForLine } from '@/components/conveyance/acting/ActingWorkspaceField';
import { ENGAGEMENT_STATE_PRESENTATION } from '@/components/sales/conveyance/conveyance-presentation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { caseHomeOf } from '@/lib/conveyance/acting-acceptance';
import { myCaseHref, type CaseHome } from '@/lib/conveyance/conveyance-routes';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/intl-formatting';
import { Link } from '@/lib/workspace/navigation';
import type { MyDossierCard } from '@/types/my-engagements';
import { DOSSIER_ROLE_KEY, DOSSIER_SPACE_KEYS } from './dossier-space-labels';

interface MyDossierCardViewProps {
  readonly card: MyDossierCard;
  /** Το είδος χώρου της λίστας (§15 Γ2) — εφεδρεία **μόνο** όταν η κάρτα δεν ξέρει ακόμη το σπίτι της. */
  readonly home: CaseHome;
}

export function MyDossierCardView({ card, home }: MyDossierCardViewProps) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const presentation = ENGAGEMENT_STATE_PRESENTATION[card.engagementState];
  const Icon = presentation.icon;
  return (
    <Card asChild className="space-y-2 p-4">
      <article>
        <header className="flex flex-wrap items-start justify-between gap-2">
          <section className="min-w-0">
            <h2 className="m-0 truncate text-base font-semibold text-foreground">{card.dossierLabel ?? t(DOSSIER_SPACE_KEYS.untitled)}</h2>
            <p className="m-0 text-sm text-foreground">
              {t(DOSSIER_SPACE_KEYS.kindLabel)} · {t(DOSSIER_SPACE_KEYS.roleLine, { role: t(DOSSIER_ROLE_KEY[card.role]) })}
            </p>
          </section>
          <Badge variant={presentation.variant} className="gap-1">
            <Icon className={iconSizes.xs} aria-hidden="true" />
            {t(`engagement.states.${card.engagementState}`)}
          </Badge>
        </header>
        <p className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs', colors.text.muted)}>
          <span>{t(DOSSIER_SPACE_KEYS.expiresLine, { date: formatDate(card.expiresAt) })}</span>
          {card.actingFor && <ActingForLine actingFor={card.actingFor} />}
        </p>
        <footer className={cn(card.verdict === 'engaged' ? undefined : cn('text-xs', colors.text.muted))}>
          {card.verdict === 'engaged'
            ? <Link href={myCaseHref(card.engagementId, caseHomeOf(card.actingFor) ?? home)} className="text-sm font-medium text-foreground underline">{t(DOSSIER_SPACE_KEYS.open)}</Link>
            : t(`engagement.verdicts.${card.verdict}`)}
        </footer>
      </article>
    </Card>
  );
}
