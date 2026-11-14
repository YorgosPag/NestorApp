'use client';

/**
 * ADR-915 §39 · ADR-862 §5.3.11 — μία κάρτα **ανάθεσης έκδοσης** στα «Οι υποθέσεις μου»: ποιο έγγραφο · ποιο ακίνητο ·
 * ποιο γραφείο · πού βρίσκεται η ανάθεση (στάδιο + σειρά) · άνοιγμα χώρου.
 *
 * 🔑 Η συμμετοχή γεννιέται **ήδη ενεργή** (ο επαγγελματίας ανέλαβε στον σύνδεσμο και μπήκε με λογαριασμό) — άρα καμία
 *    «Αναλαμβάνω» εδώ. Ετυμηγορία ≠ `engaged` ⇒ ονομασμένος λόγος (ίδιο λεξιλόγιο με τη μεταβίβαση).
 *
 * @module components/conveyance/my-cases/MyIssuanceCardView
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ActingForLine } from '@/components/conveyance/acting/ActingWorkspaceField';
import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { ENGAGEMENT_STATE_PRESENTATION } from '@/components/sales/conveyance/conveyance-presentation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { caseHomeOf } from '@/lib/conveyance/acting-acceptance';
import { myCaseHref, type CaseHome } from '@/lib/conveyance/conveyance-routes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { MyIssuanceCard } from '@/types/my-engagements';
import { ISSUANCE_SPACE_KEYS, PROFESSIONAL_BALL_KEYS, PROFESSIONAL_STAGE_KEYS } from './issuance-space-labels';

interface MyIssuanceCardViewProps {
  readonly card: MyIssuanceCard;
  /** Το είδος χώρου της λίστας (§15 Γ2) — εφεδρεία **μόνο** όταν η κάρτα δεν ξέρει ακόμη το σπίτι της. */
  readonly home: CaseHome;
}

function IssuanceFacts({ card }: { readonly card: MyIssuanceCard }) {
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality']);
  const colors = useSemanticColors();
  return (
    <p className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs', colors.text.muted)}>
      <span>{t(ISSUANCE_SPACE_KEYS.fromOffice, { office: card.hostName ?? t(ISSUANCE_SPACE_KEYS.unnamedOffice) })}</span>
      {card.stage && <span>{t(PROFESSIONAL_STAGE_KEYS[card.stage])}</span>}
      {card.ballInCourt && <span>{t(ISSUANCE_SPACE_KEYS.ballLine, { party: t(PROFESSIONAL_BALL_KEYS[card.ballInCourt]) })}</span>}
      {card.actingFor && <ActingForLine actingFor={card.actingFor} />}
    </p>
  );
}

export function MyIssuanceCardView({ card, home }: MyIssuanceCardViewProps) {
  const { t } = useTranslation(['conveyance', 'document-registry', 'legality']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const presentation = ENGAGEMENT_STATE_PRESENTATION[card.engagementState];
  const Icon = presentation.icon;
  return (
    <Card asChild className="space-y-2 p-4">
      <article>
        <header className="flex flex-wrap items-start justify-between gap-2">
          <section className="min-w-0">
            <h2 className="m-0 truncate text-base font-semibold text-foreground">{card.propertyName ?? t(ISSUANCE_SPACE_KEYS.untitledProperty)}</h2>
            <p className="m-0 text-sm text-foreground">
              {t(ISSUANCE_SPACE_KEYS.kindLabel)} · {card.documentKind ? t(DOCUMENT_KIND_LABEL_KEYS[card.documentKind]) : t(ISSUANCE_SPACE_KEYS.unknownDocument)}
            </p>
          </section>
          <Badge variant={presentation.variant} className="gap-1">
            <Icon className={iconSizes.xs} aria-hidden="true" />
            {t(`engagement.states.${card.engagementState}`)}
          </Badge>
        </header>
        <IssuanceFacts card={card} />
        <footer className={cn(card.verdict === 'engaged' ? undefined : cn('text-xs', colors.text.muted))}>
          {card.verdict === 'engaged'
            ? <Link href={myCaseHref(card.engagementId, caseHomeOf(card.actingFor) ?? home)} className="text-sm font-medium text-foreground underline">{t(ISSUANCE_SPACE_KEYS.open)}</Link>
            : t(`engagement.verdicts.${card.verdict}`)}
        </footer>
      </article>
    </Card>
  );
}
