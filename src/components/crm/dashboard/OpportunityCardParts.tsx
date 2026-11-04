'use client';

/**
 * @fileoverview **Τα κομμάτια της κάρτας ευκαιρίας που αφορούν τη ροή** (ADR-929): «μέρες στο στάδιο» και
 *   «Μετακίνηση σε…».
 * @module components/crm/dashboard/OpportunityCardParts
 *
 * 🔑 Το «Μετακίνηση σε…» είναι ο **δεύτερος δρόμος** προς την ΙΔΙΑ εντολή με το σύρσιμο — για πληκτρολόγιο, αφή,
 *    αναγνώστη οθόνης και για όποιον δεν θέλει να σύρει σε μακριά στήλη (HubSpot «Move to stage»).
 * 🔑 Η «παγωμένη» κάρτα (Pipedrive rotting) σημαίνεται με **κείμενο + χρώμα**, ποτέ μόνο χρώμα.
 */

import React from 'react';
import { ArrowRightLeft, Hourglass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OPPORTUNITY_STAGE_IDS, type OpportunityStage } from '@/config/crm/opportunity-stages';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { StageAge } from '../utils/pipeline-board';

export function StageAgeBadge({ age }: { readonly age: StageAge | null }) {
  const { t } = useTranslation('crm');
  const colors = useSemanticColors();
  if (!age) return null;
  return (
    <p className={cn('m-0 flex items-center gap-1 text-xs', age.stale ? cn('font-medium', colors.text.warning) : colors.text.muted)}>
      <Hourglass className="h-3 w-3" aria-hidden />
      {t(age.stale ? 'pipeline.card.staleDays' : 'pipeline.card.stageDays', { count: age.days })}
    </p>
  );
}

interface MoveToMenuProps {
  readonly current: OpportunityStage;
  readonly name: string;
  readonly disabled: boolean;
  readonly onMoveTo: (stage: OpportunityStage) => void;
}

export function MoveToMenu({ current, name, disabled, onMoveTo }: MoveToMenuProps) {
  const { t } = useTranslation('crm');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={disabled}
          aria-label={t('pipeline.card.moveToOf', { name })} onClick={(e) => e.stopPropagation()}>
          <ArrowRightLeft className="h-3 w-3" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{t('pipeline.card.moveTo')}</DropdownMenuLabel>
        {OPPORTUNITY_STAGE_IDS.filter((stage) => stage !== current).map((stage) => (
          <DropdownMenuItem key={stage} onSelect={() => onMoveTo(stage)}>{t(`opportunities.stages.${stage}`)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
