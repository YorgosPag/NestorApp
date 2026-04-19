/**
 * @fileoverview CandidateCard Component (Phase 2d)
 * @description Displays a single match candidate with tier badge, confidence, and match button
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11
 * @compliance CLAUDE.md Enterprise Standards — semantic HTML, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Check, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { MatchCandidate } from '@/subapps/accounting/types';
import { TIER_BADGE_VARIANT } from './tier-colors';
import { formatAccountingCurrency } from '../../utils/format';

interface CandidateCardProps {
  candidate: MatchCandidate;
  onMatch: (entityId: string, entityType: MatchCandidate['entityType']) => void;
  matching: boolean;
}

export function CandidateCard({ candidate, onMatch, matching }: CandidateCardProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <section className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={TIER_BADGE_VARIANT[candidate.tier]}>
              {Math.round(candidate.confidence)}%
            </Badge>
            <span className="text-sm font-medium truncate">
              {candidate.displayLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatAccountingCurrency(candidate.amount)}
            <span className="mx-1.5">·</span>
            {candidate.date}
          </p>
          {candidate.matchReasons.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3 w-3" />
                  {candidate.matchReasons.length} {t('reconciliation.matchReasons')}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="text-xs space-y-0.5">
                  {candidate.matchReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
        </section>
        <Button
          size="sm"
          onClick={() => onMatch(candidate.entityId, candidate.entityType)}
          disabled={matching}
        >
          <Check className="h-4 w-4 mr-1" />
          {t('reconciliation.matchAction')}
        </Button>
      </CardContent>
    </Card>
  );
}
