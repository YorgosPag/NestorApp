'use client';

/**
 * ADR-651 Φάση Μ — **AI σετ φύλλων από πρόθεση** (§8 #4), μέσα στον υπάρχοντα πίνακα φύλλων.
 *
 * Ο χρήστης γράφει τι σετ θέλει σε φυσική γλώσσα («όλοι οι όροφοι εκτός υπογείου, αρίθμηση από
 * Α-1») → το AI **προτείνει** ποιοι όροφοι μπαίνουν + υπόδειξη αρίθμησης → το σχέδιο εφαρμόζεται
 * στο **ίδιο** `useSheetSetEdits` state (επιλογή + επαναρίθμηση) → ο χρήστης **βλέπει & διορθώνει**
 * στον ίδιο πίνακα πριν τυπώσει. **Ποτέ** αυτόματη παραγωγή/print χωρίς review (πρακτική Revit
 * «Sheet Set from Views» — ο άνθρωπος στο review).
 *
 * Το AI βγάζει μόνο **πρόθεση**· η αρίθμηση/τίτλοι παράγονται ντετερμινιστικά από το μοντέλο
 * (`sheet-numbering.ts` μέσω `applyPlan`). Αποτυχία AI ⇒ μήνυμα, καμία αλλαγή επιλογής.
 *
 * @see ../../../text-engine/title-block/ai/ai-title-block-client.ts — `requestSheetSetPlan`
 * @see ./useSheetSetEdits.ts — `applyPlan` (το σχέδιο οδηγεί το υπάρχον state)
 */

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { requestSheetSetPlan } from '../../../text-engine/title-block/ai/ai-title-block-client';
import { toTitleBlockLocale } from '../../../text-engine/title-block/title-block-presets';
import type { SheetRow } from '../../../text-engine/title-block/sheet-set';
import type { UseSheetSetEditsResult } from './useSheetSetEdits';

export interface SheetSetAiPlannerProps {
  readonly rows: readonly SheetRow[];
  readonly state: UseSheetSetEditsResult;
  readonly disabled?: boolean;
}

/** Ό,τι δείχνει το UI μετά μια πρόταση: η σημείωση του AI + πόσα άγνωστα ids πετάχτηκαν. */
interface PlanFeedback {
  readonly notes: string;
  readonly droppedCount: number;
  readonly selectedCount: number;
}

export function SheetSetAiPlanner({
  rows,
  state,
  disabled = false,
}: SheetSetAiPlannerProps): React.JSX.Element {
  const { t, i18n } = useTranslation('dxf-viewer-shell');
  const [intent, setIntent] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [feedback, setFeedback] = React.useState<PlanFeedback | null>(null);

  const canPlan = !disabled && !busy && intent.trim().length > 0 && rows.length > 0;

  const handlePlan = React.useCallback(async () => {
    setBusy(true);
    setFailed(false);
    setFeedback(null);
    const levels = rows.map((row) => ({ id: row.levelId, name: row.levelName, label: row.titleText }));
    const plan = await requestSheetSetPlan(
      intent.trim(),
      levels,
      toTitleBlockLocale(i18n.language),
    );
    if (!plan) {
      setFailed(true);
      setBusy(false);
      return;
    }
    state.applyPlan(plan.selectedLevelIds, plan.numbering);
    setFeedback({
      notes: plan.notes,
      droppedCount: plan.droppedLevelIds.length,
      selectedCount: plan.selectedLevelIds.length,
    });
    setBusy(false);
  }, [intent, rows, i18n.language, state]);

  return (
    <section className="flex flex-col gap-2 rounded border border-dashed border-border p-2">
      <header className="flex flex-col gap-0.5">
        <Label htmlFor="sheet-set-ai-intent" className="text-sm font-medium">
          {t('print.sheets.ai.label')}
        </Label>
        <p className="text-xs text-muted-foreground">{t('print.sheets.ai.hint')}</p>
      </header>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          id="sheet-set-ai-intent"
          size="sm"
          className="min-w-56 flex-1"
          value={intent}
          placeholder={t('print.sheets.ai.placeholder')}
          onChange={(event) => setIntent(event.target.value)}
          disabled={disabled || busy}
        />
        <Button variant="outline" size="sm" onClick={handlePlan} disabled={!canPlan}>
          {busy ? t('print.sheets.ai.loading') : t('print.sheets.ai.button')}
        </Button>
      </div>

      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('print.sheets.ai.error')}
        </p>
      )}

      {feedback && (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <p>{t('print.sheets.ai.applied', { count: feedback.selectedCount })}</p>
          {feedback.notes.trim() && <p className="[overflow-wrap:anywhere]">{feedback.notes}</p>}
          {feedback.droppedCount > 0 && (
            <p className="text-[hsl(var(--text-warning))]">
              {t('print.sheets.ai.dropped', { count: feedback.droppedCount })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
