'use client';

/**
 * @fileoverview **Η ΜΙΑ εντολή «μετακίνησε την ευκαιρία στο στάδιο Χ»** — για πίνακα, «Μετακίνηση σε…» και φόρμα (ADR-929).
 * @module components/crm/stage-move/useStageTransitionCommand
 *
 * Ροή: ποιο αίτημα; (κλείσιμο ⇒ διάλογος · επανάνοιγμα ⇒ επιβεβαίωση · αλλιώς άμεσα) → αισιόδοξη εικόνα → πόρτα →
 *   - επιτυχία ανοιχτό→ανοιχτό ⇒ μήνυμα με **Αναίρεση** (Gmail): πίσω με `expectedStage = νέο`, άρα κι αυτή με CAS·
 *   - επιτυχία κλεισίματος/επανανοίγματος ⇒ απλό μήνυμα (ήταν ήδη συνειδητή πράξη με διάλογο)·
 *   - σύγκρουση ⇒ η εικόνα επιστρέφει και λέμε **πού** βρίσκεται πραγματικά· άρνηση / σφάλμα ⇒ επαναφορά + μήνυμα.
 * 🔑 **Μία μετακίνηση ανά κάρτα τη φορά** (`isMoving`): η δεύτερη θα έστελνε `expectedStage` που ο server δεν έχει
 *    γράψει ακόμη ⇒ ψευδής σύγκρουση. Ο πίνακας κλειδώνει την κάρτα όσο πετά το αίτημα.
 */

import { useCallback, useRef, useState } from 'react';

import { isClosedStage, stageKind, type OpportunityStage } from '@/config/crm/opportunity-stages';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { targetOf, type StageTransitionRequest } from '@/services/crm/opportunity-stage-transition';
import type { Opportunity } from '@/types/crm';
import { postStageTransition, type StageMoveResult } from './stage-move-api';
import { useStageDialogs, type StageDialogs } from './useStageDialogs';

export interface StageMoveCallbacks {
  /** Η κάρτα να φανεί αμέσως στο νέο στάδιο. */
  readonly onOptimistic?: (opportunityId: string, stage: OpportunityStage) => void;
  /** Η αισιόδοξη εικόνα ακυρώνεται — ισχύει ό,τι λένε τα δεδομένα. */
  readonly onRevert?: (opportunityId: string) => void;
}

export interface StageTransitionCommand {
  readonly requestMove: (opportunity: Opportunity, to: OpportunityStage) => Promise<boolean>;
  readonly isMoving: (opportunityId: string) => boolean;
  readonly dialogs: StageDialogs;
}

function useInFlight() {
  const ref = useRef(new Set<string>());
  const [, setVersion] = useState(0);
  const set = useCallback((id: string, flying: boolean) => {
    if (flying) ref.current.add(id); else ref.current.delete(id);
    setVersion((v) => v + 1);
  }, []);
  return { has: useCallback((id: string) => ref.current.has(id), []), set };
}

export function useStageTransitionCommand(callbacks: StageMoveCallbacks = {}): StageTransitionCommand {
  const { t } = useTranslation('crm');
  const notifications = useNotifications();
  const dialogs = useStageDialogs();
  const inFlight = useInFlight();
  const { onOptimistic, onRevert } = callbacks;
  const stageLabel = useCallback((stage: OpportunityStage) => t(`opportunities.stages.${stage}`), [t]);

  const report = useCallback((id: string, result: StageMoveResult, onUndo: (() => void) | null) => {
    if (result.kind === 'ok') {
      const stage = stageLabel(result.response.stage);
      if (onUndo && result.response.outcome === 'applied') {
        notifications.notify(t('pipeline.move.moved', { stage }), { type: 'info', actions: [{ label: t('pipeline.move.undo'), onClick: onUndo }] });
      } else notifications.success(t('pipeline.move.moved', { stage }));
      return;
    }
    onRevert?.(id);
    if (result.kind === 'conflict') {
      const where = result.currentStage ? stageLabel(result.currentStage) : t('pipeline.move.unknownStage');
      notifications.warning(t('pipeline.move.conflict', { stage: where }));
    } else notifications.error(t(result.kind === 'refused' ? 'pipeline.move.refused' : 'pipeline.move.failed'));
  }, [notifications, onRevert, stageLabel, t]);

  const commit = useCallback(async (opportunity: Opportunity, from: OpportunityStage, request: StageTransitionRequest, undoable: boolean): Promise<boolean> => {
    const id = opportunity.id;
    if (!id || inFlight.has(id)) return false;
    const to = targetOf(request);
    inFlight.set(id, true);
    onOptimistic?.(id, to);
    const result = await postStageTransition(id, { expectedStage: from, request });
    inFlight.set(id, false);
    const undo = undoable
      ? () => { void commit({ ...opportunity, stage: to }, to, { kind: 'open', target: from }, false); }
      : null;
    report(id, result, undo);
    return result.kind === 'ok';
  }, [inFlight, onOptimistic, report]);

  const requestMove = useCallback(async (opportunity: Opportunity, to: OpportunityStage): Promise<boolean> => {
    const kind = stageKind(to);
    const from = opportunity.stage;
    let request: StageTransitionRequest | null;
    if (kind !== 'open') request = await dialogs.askClose(opportunity, kind);
    else if (isClosedStage(from)) request = (await dialogs.askReopen(opportunity, to)) ? { kind: 'open', target: to } : null;
    else request = { kind: 'open', target: to };
    if (!request) return false;
    return commit(opportunity, from, request, request.kind === 'open' && !isClosedStage(from));
  }, [commit, dialogs]);

  return { requestMove, isMoving: inFlight.has, dialogs };
}
