'use client';

/**
 * ADR-911 Φ3β — το πάνελ του βοηθού **«Μοντέλο από το σχέδιο»**.
 *
 * Modeless, συρόμενο (ο ΙΔΙΟΣ φλοιός αναθεώρησης με τα πάνελ της τοπογραφίας — `TopoReviewPanel`):
 * ο άνθρωπος πρέπει να βλέπει το σχέδιο όσο αποφασίζει. Δύο όψεις:
 *
 *   · `picking` — «δείξε μία γραμμή τοίχου» (Δ1).
 *   · `review`  — υπόμνημα με πλήθη · λειτουργία ανά ομάδα πάχους (Δ3) · αμφίσημα (Δ7) ·
 *                 απορρίψεις με λόγο · αναφορά κάλυψης · ΜΙΑ έγκριση που γράφει τον αριθμό.
 *
 * Η έγκριση είναι κλειδωμένη όσο εκκρεμεί ομάδα πάχους ή δεν υπάρχει τοίχος να γραφτεί. Ο
 * ελεγκτής ξαναελέγχει και τα δύο (`modelFromDrawingSession.approve`) — το κουμπί είναι η ευγένεια,
 * όχι η εγγύηση.
 *
 * Καθαρή παρουσίαση: κατάσταση ως prop, αποφάσεις ως callbacks. Χαμηλόσυχνο (ADR-040).
 *
 * @see ../../../app/ModelFromDrawingHost.tsx (ο host: store + εξαρτήσεις)
 * @see ../../../systems/model-from-drawing/model-from-drawing-session.ts (ο ελεγκτής)
 */

import * as React from 'react';
import { Wand2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import type { WallCategory } from '../../../bim/types/wall-types';
import { groupsAwaitingConfirmation } from '../../../bim/model-from-drawing/assistant-preview';
import type {
  ModelFromDrawingNotice,
  ModelFromDrawingState,
} from '../../../systems/model-from-drawing/model-from-drawing-store';
import { TopoReviewPanel } from '../topography/TopoReviewPanel';
import {
  type Translate,
  ColorChip,
  CoverageSection,
  DecisionsSection,
  GroupsSection,
  RejectedSection,
  StatusLegend,
} from './ModelFromDrawingSections';

export interface ModelFromDrawingPanelActions {
  readonly onClose: () => void;
  /** «Άλλο δείγμα»: νέα συνεδρία, οπλισμένη. */
  readonly onResample: () => void;
  readonly onConfirmGroup: (thicknessMm: number, category: WallCategory) => void;
  readonly onSetUndecided: (key: string, isWall: boolean) => void;
  readonly onFocus: (key: string) => void;
  readonly onApprove: () => void;
}

export interface ModelFromDrawingPanelProps {
  readonly state: ModelFromDrawingState;
  readonly actions: ModelFromDrawingPanelActions;
}

/** Κάθε ειδοποίηση με ΡΗΤΟ κλειδί (όχι συναρμολογημένο): το CHECK 3.8 βλέπει ότι υπάρχουν όλα. */
function noticeText(notice: ModelFromDrawingNotice, t: Translate): string {
  switch (notice.kind) {
    case 'no-scene': return t('modelFromDrawing.notice.no-scene');
    case 'no-line': return t('modelFromDrawing.notice.no-line');
    case 'no-color': return t('modelFromDrawing.notice.no-color');
    case 'stale': return t('modelFromDrawing.notice.stale');
    case 'unconfirmed': return t('modelFromDrawing.notice.unconfirmed');
    case 'written': return t('modelFromDrawing.notice.written', { count: notice.count });
    case 'refused':
      if (notice.refusal === 'overlap') return t('modelFromDrawing.notice.refused.overlap', { blocked: notice.blocked });
      if (notice.refusal === 'nothing-to-write') return t('modelFromDrawing.notice.refused.nothing-to-write');
      return t('modelFromDrawing.notice.refused.no-active-scene');
  }
}

function Notice({ notice, t }: { readonly notice: ModelFromDrawingNotice | null; readonly t: Translate }): React.ReactElement | null {
  if (!notice) return null;
  return (
    <p
      className="m-0 rounded border border-border bg-accent/60 px-2 py-1.5 text-[11px] text-foreground"
      role="status" data-testid="mfd-notice" data-kind={notice.kind}
    >
      {noticeText(notice, t)}
    </p>
  );
}

function ReviewBody({ state, actions, t }: ModelFromDrawingPanelProps & { readonly t: Translate }): React.ReactElement | null {
  const { proposal, wallColorHex } = state;
  if (!proposal) return null;
  const locked = proposal.walls.length === 0 || groupsAwaitingConfirmation(proposal).length > 0;
  return (
    <>
      <p className="m-0 flex items-center gap-1.5 text-xs text-foreground">
        {wallColorHex ? <ColorChip hex={wallColorHex} /> : null}
        <span className="flex-1">{t('modelFromDrawing.sample.label')}</span>
        <Button type="button" variant="ghost" size="xs" onClick={actions.onResample}>
          {t('modelFromDrawing.sample.change')}
        </Button>
      </p>
      <StatusLegend proposal={proposal} t={t} />
      <GroupsSection groups={proposal.groups} onConfirm={actions.onConfirmGroup} t={t} />
      <DecisionsSection
        proposal={proposal} acceptedKeys={state.acceptedKeys} focusedKey={state.focusedKey}
        onSetUndecided={actions.onSetUndecided} onFocus={actions.onFocus} t={t}
      />
      <RejectedSection proposal={proposal} focusedKey={state.focusedKey} onFocus={actions.onFocus} t={t} />
      <CoverageSection proposal={proposal} t={t} />
      <Notice notice={state.notice} t={t} />
      <Button
        type="button" size="sm" disabled={locked} onClick={actions.onApprove}
        data-testid="mfd-approve"
      >
        {t('modelFromDrawing.approve', { count: proposal.walls.length })}
      </Button>
    </>
  );
}

export function ModelFromDrawingPanel({ state, actions }: ModelFromDrawingPanelProps): React.ReactElement | null {
  const { t } = useTranslation('dxf-viewer-shell');
  if (state.phase === 'closed') return null;
  return (
    <TopoReviewPanel
      title={t('modelFromDrawing.title')}
      icon={<Wand2 className="size-4" aria-hidden="true" />}
      onClose={actions.onClose}
      stackIndex={0}
      testId="model-from-drawing-panel"
    >
      <section className="flex flex-col gap-2.5">
        {state.phase === 'picking' ? (
          <>
            <p className="m-0 text-xs text-foreground" data-testid="mfd-pick-instruction">
              {t('modelFromDrawing.pick.instruction')}
            </p>
            <Notice notice={state.notice} t={t} />
          </>
        ) : (
          <ReviewBody state={state} actions={actions} t={t} />
        )}
      </section>
    </TopoReviewPanel>
  );
}
