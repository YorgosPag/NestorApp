'use client';

/**
 * ADR-929 Δ21 (0) · Δ7 Γ — **«Σχέδιο υπό κλίμακα / Σκίτσο με το χέρι»**: το είδος με το οποίο τρέχει η σύντηξη, **ορατό** με
 * τον λόγο του, και αλλαγή με ένα κλικ. Η αυτόματη κρίση εφαρμόζεται (ποτέ σιωπηλά: ο λόγος φαίνεται πάντα), και η επιλογή
 * του ανθρώπου νικά μέχρι το «Αυτόματη κρίση».
 *
 * Καθαρή παρουσίαση: δεν διαβάζει store, δεν γράφει τίποτα· η επιλογή φεύγει προς τα πάνω ως callback.
 *
 * @see ../../../bim/plan-recognition/fusion/drawing-kind.ts (η ΜΙΑ απόφαση)
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import type { PlanDrawingKindChoice, PlanDrawingKindDecision } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import { MUTED, SECTION_TITLE, type Translate } from './ModelFromDrawingSections';

export interface PlanDrawingKindView {
  /** Το είδος με το οποίο έτρεξε η σύντηξη, και ποιος το αποφάσισε. */
  readonly decision: PlanDrawingKindDecision;
  /** Η επιλογή του ανθρώπου· `null` = αποφασίζει η μηχανή. */
  readonly choice: PlanDrawingKindChoice | null;
}

export interface PlanDrawingKindActions {
  /** `null` = ξανά η αυτόματη κρίση. */
  readonly onSet: (choice: PlanDrawingKindChoice | null) => void;
}

const KIND_KEY: Readonly<Record<PlanDrawingKindChoice, string>> = {
  drawing: 'modelFromDrawing.image.drawingKind.drawing',
  sketch: 'modelFromDrawing.image.drawingKind.sketch',
};

/** Ο λόγος της απόφασης — ρητά κλειδιά (CHECK 3.8), ένα ανά περίπτωση. */
const REASON_KEY = {
  human: 'modelFromDrawing.image.drawingKind.reason.human',
  vector: 'modelFromDrawing.image.drawingKind.reason.vector',
  toScale: 'modelFromDrawing.image.drawingKind.reason.toScale',
  notToScale: 'modelFromDrawing.image.drawingKind.reason.notToScale',
  unproven: 'modelFromDrawing.image.drawingKind.reason.unproven',
} as const;

function reasonKey(decision: PlanDrawingKindDecision): string {
  switch (decision.basis) {
    case 'human': return REASON_KEY.human;
    case 'vector-source': return REASON_KEY.vector;
    case 'dimensions': return decision.kind === 'sketch' ? REASON_KEY.notToScale : REASON_KEY.toScale;
    case 'default': return REASON_KEY.unproven;
  }
}

/**
 * Τι σημαίνει η κρίση για τις προτάσεις τιμών (`planReadValueMeasure`): σκίτσο ⇒ μόνο με ανεξάρτητη κλίμακα · αναπόδεικτο ⇒
 * μόνο όταν αποδειχτεί μέτρο. Υπό κλίμακα ⇒ τίποτα να ειπωθεί.
 */
function DrawingKindEffect({ decision, t }: { readonly decision: PlanDrawingKindDecision; readonly t: Translate }): React.ReactElement | null {
  const key = decision.kind === 'sketch' ? 'modelFromDrawing.image.drawingKind.sketchEffect'
    : decision.basis === 'default' ? 'modelFromDrawing.image.drawingKind.unprovenEffect' : null;
  return key === null ? null : <p className={MUTED} data-testid="mfd-drawing-kind-effect">{t(key)}</p>;
}

/** Στον έλεγχο της εικόνας, όταν υπάρχει αποτέλεσμα σύντηξης. */
export function PlanDrawingKindSection({ view, actions, t }: {
  /** `null` = καμία σύντηξη ακόμη. */
  readonly view: PlanDrawingKindView | null;
  readonly actions: PlanDrawingKindActions;
  readonly t: Translate;
}): React.ReactElement | null {
  if (view === null) return null;
  const selected: PlanDrawingKindChoice = view.decision.kind === 'sketch' ? 'sketch' : 'drawing';
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-drawing-kind" data-kind={selected} data-basis={view.decision.basis}>
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.image.drawingKind.title')}</h4>
      <SegmentedControl
        value={selected} onValueChange={(next) => actions.onSet(next)}
        aria-label={t('modelFromDrawing.image.drawingKind.title')} data-testid="mfd-drawing-kind-control"
      >
        {(['drawing', 'sketch'] as const).map((kind) => (
          <SegmentedControlItem key={kind} value={kind} size="xs" data-testid={`mfd-drawing-kind-${kind}`}>
            {t(KIND_KEY[kind])}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <p className={MUTED} role="status" data-testid="mfd-drawing-kind-reason">{t(reasonKey(view.decision))}</p>
      <DrawingKindEffect decision={view.decision} t={t} />

      {view.choice !== null ? (
        <Button type="button" variant="ghost" size="xs" className="self-start" onClick={() => actions.onSet(null)} data-testid="mfd-drawing-kind-auto">
          {t('modelFromDrawing.image.drawingKind.auto')}
        </Button>
      ) : null}
    </section>
  );
}
