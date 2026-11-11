/**
 * @fileoverview **Η ΛΩΡΙΔΑ ΤΗΣ ΠΡΟΤΑΣΗΣ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΥ** — «Πρόταση από την κάτοψη: Νότιο, Δυτικό — [Εφαρμογή] [Απόρριψη]».
 * @related ADR-937 Φάση Β/Γ · lib/property/orientation-proposal (ο ΕΝΑΣ αναγνώστης) · OrientationCompassGrid
 * @module components/properties/shared/OrientationProposalStrip
 *
 * 🔴 **Ο άνθρωπος έχει τον τελευταίο λόγο.** Η λωρίδα **δεν** αλλάζει μόνη της τίποτα: «Εφαρμογή» = αλλαγή στη φόρμα,
 *    που ο άνθρωπος αποθηκεύει όπως κάθε άλλη· «Απόρριψη» = σβήνει την πρόταση, όχι το δηλωμένο.
 * 🔑 Όταν η πρόταση **συμπίπτει** με το δηλωμένο, η λωρίδα σιωπά — δεν έχει τίποτα να προτείνει.
 */

import React from 'react';
import type { TFunction } from 'i18next';
import { Lightbulb } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ORIENTATION_LABELS, type OrientationType } from '@/constants/property-features-enterprise';
import { useIconSizes } from '@/hooks/useIconSizes';
import { proposalMatches, type OrientationProposal } from '@/lib/property/orientation-proposal';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

export interface OrientationProposalStripProps {
  readonly proposal: OrientationProposal | null;
  readonly declared: readonly OrientationType[];
  readonly onApply: (values: readonly OrientationType[]) => void;
  readonly onDismiss: () => void;
  readonly disabled?: boolean;
  /** Το `t` του namespace `properties-enums`. */
  readonly t: TFunction;
}

export function OrientationProposalStrip(props: OrientationProposalStripProps) {
  const { proposal, declared, onApply, onDismiss, disabled, t } = props;
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  if (!proposal || proposal.values.length === 0 || proposalMatches(proposal, declared)) return null;

  const names = proposal.values.map((o) => t(ORIENTATION_LABELS[o])).join(', ');
  const title = proposal.source === 'map'
    ? t('orientation.proposal.fromMap', { names })
    : t('orientation.proposal.fromFloorplan', { names });

  return (
    <aside className="space-y-1 rounded-md border border-border p-2 text-xs">
      <p className="m-0 flex items-start gap-1 font-medium">
        <Lightbulb className={cn(iconSizes.xs, 'mt-0.5 shrink-0')} />
        {title}
      </p>
      {proposal.northAssumed && (
        <p className={cn('m-0', colors.text.muted)}>{t('orientation.proposal.northAssumed')}</p>
      )}
      <menu className="m-0 flex gap-1 p-0">
        <li className="list-none">
          <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs"
            disabled={disabled} onClick={() => onApply(proposal.values)}>
            {t('orientation.proposal.apply')}
          </Button>
        </li>
        <li className="list-none">
          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs"
            disabled={disabled} onClick={onDismiss}>
            {t('orientation.proposal.dismiss')}
          </Button>
        </li>
      </menu>
    </aside>
  );
}
