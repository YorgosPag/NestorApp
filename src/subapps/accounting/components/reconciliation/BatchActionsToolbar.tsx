/**
 * @fileoverview BatchActionsToolbar Component (Phase 2d)
 * @description Toolbar with batch accept/auto-match actions and progress indicator
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q11 (Batch actions)
 * @compliance CLAUDE.md Enterprise Standards — semantic HTML, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { CheckCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface BatchActionsToolbarProps {
  selectedCount: number;
  autoMatchableCount: number;
  onAcceptAll: () => void;
  onAcceptSelected: () => void;
  batchProgress: { running: boolean; completed: number; total: number } | null;
  disabled: boolean;
}

export function BatchActionsToolbar({
  selectedCount,
  autoMatchableCount,
  onAcceptAll,
  onAcceptSelected,
  batchProgress,
  disabled,
}: BatchActionsToolbarProps) {
  const { t } = useTranslation('accounting');

  if (batchProgress?.running) {
    const pct = batchProgress.total > 0
      ? (batchProgress.completed / batchProgress.total) * 100
      : 0;
    return (
      <nav className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30" aria-label="Batch progress">
        <span className="text-sm text-muted-foreground">
          {t('reconciliation.batchProgress', {
            completed: batchProgress.completed,
            total: batchProgress.total,
          })}
        </span>
        <Progress value={pct} className="flex-1 h-2" />
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30" aria-label="Batch actions">
      <Button
        size="sm"
        variant="default"
        onClick={onAcceptAll}
        disabled={disabled || autoMatchableCount === 0}
      >
        <Zap className="h-4 w-4 mr-1" />
        {t('reconciliation.batchAcceptAll')}
        {autoMatchableCount > 0 && (
          <Badge variant="secondary" className="ml-1.5 text-[10px]">
            {autoMatchableCount}
          </Badge>
        )}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onAcceptSelected}
        disabled={disabled || selectedCount === 0}
      >
        <CheckCheck className="h-4 w-4 mr-1" />
        {t('reconciliation.batchAcceptSelected')}
        {selectedCount > 0 && (
          <Badge variant="outline" className="ml-1.5 text-[10px]">
            {selectedCount}
          </Badge>
        )}
      </Button>
    </nav>
  );
}
