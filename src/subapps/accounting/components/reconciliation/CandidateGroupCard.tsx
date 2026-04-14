/**
 * @fileoverview CandidateGroupCard Component (Phase 2d)
 * @description Displays N:M match group with combined total and individual candidates
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11 (N:M matching UI)
 * @compliance CLAUDE.md Enterprise Standards — semantic HTML, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Layers, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MatchCandidateGroup } from '@/subapps/accounting/types';
import { TIER_BADGE_VARIANT } from './tier-colors';
import { formatCurrency } from '../../utils/format';

interface CandidateGroupCardProps {
  group: MatchCandidateGroup;
  transactionAmount: number;
  onMatch: () => void;
  matching: boolean;
}

export function CandidateGroupCard({
  group,
  transactionAmount,
  onMatch,
  matching,
}: CandidateGroupCardProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const amountDiff = Math.abs(group.totalAmount - transactionAmount);
  const hasDiff = amountDiff > 0.01;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {t('reconciliation.groupMatch', { count: group.candidates.length })}
          </CardTitle>
          <Badge variant={TIER_BADGE_VARIANT[group.tier]}>
            {Math.round(group.confidence)}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <ul className="space-y-1">
          {group.candidates.map((c) => (
            <li key={c.entityId} className="flex justify-between text-sm">
              <span className="truncate">{c.displayLabel}</span>
              <span className="text-muted-foreground ml-2 shrink-0">
                {formatCurrency(c.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t pt-2">
          <div className="text-sm">
            <span className="font-medium">
              {t('reconciliation.groupTotal')}: {formatCurrency(group.totalAmount)}
            </span>
            {hasDiff && (
              <span className="ml-2 text-destructive text-xs">
                (Δ {formatCurrency(amountDiff)})
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={onMatch}
            disabled={matching}
          >
            <Check className="h-4 w-4 mr-1" />
            {t('reconciliation.matchAction')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
