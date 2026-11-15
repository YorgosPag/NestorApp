'use client';

/**
 * ADR-929 §6.20 · Δ22 — **«Κράτησε τα αναγνωρισμένα»** μέσα στο ίδιο εργαλείο ελέγχου (Δ10/Δ18): η στρώση «Γραμμές»
 * (θα γραφτούν / υπάρχουν ήδη / σε ποιο επίπεδο), η επιλογή «με βεβαιότητα ≥ X» και η ΜΙΑ πράξη που κρατά διαστάσεις
 * **και** γραμμές ως οντότητες — ενεργή **ανεξάρτητα από τους τοίχους** (Δ20).
 *
 * Το κουμπί κλειδώνει μόνο όταν δεν υπάρχει τίποτα νέο ή λείπει η βαθμονόμηση· ο ελεγκτής ξαναελέγχει
 * (`modelFromDrawingSession.keep`) — το κουμπί είναι η ευγένεια, όχι η εγγύηση.
 *
 * Καθαρή παρουσίαση: οι περιλήψεις έρχονται από τον ελεγκτή (ο ΙΔΙΟΣ υπολογισμός με την εγγραφή). Χαμηλόσυχνο (ADR-040).
 *
 * @see ../../../systems/model-from-drawing/keep-recognized.ts
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { WallProposalStatus } from '../../../bim/model-from-drawing/wall-proposal';
import type { NamedLayerTarget } from '../../../services/named-layer';
import type { RecognizedDimensionSummary } from '../../../systems/model-from-drawing/model-from-drawing-dimensions';
import type { RecognizedLinesSummary } from '../../../systems/model-from-drawing/keep-recognized';
import { DIMENSION_LAYER_REFUSAL_LABEL_KEY } from '../../../systems/model-from-drawing/dimension-label-keys';
import { PLAN_CONFIDENCE_ORDER, type PlanConfidenceTier } from '../../../systems/plan-recognition/plan-confidence';
import { MUTED, SECTION_TITLE, StatusCountRow, ToneSwatch, type Translate } from './ModelFromDrawingSections';

/** Κάθε επίπεδο με ΡΗΤΟ κλειδί (CHECK 3.8). */
const TIER_LABEL_KEY: Readonly<Record<PlanConfidenceTier, string>> = {
  high: 'modelFromDrawing.keep.tier.high',
  medium: 'modelFromDrawing.keep.tier.medium',
  low: 'modelFromDrawing.keep.tier.low',
};

const LINE_ROWS: readonly (readonly [Extract<WallProposalStatus, 'ready' | 'existing'>, 'fresh' | 'existing'])[] = [
  ['ready', 'fresh'],
  ['existing', 'existing'],
];

function isTier(value: string): value is PlanConfidenceTier {
  return (PLAN_CONFIDENCE_ORDER as readonly string[]).includes(value);
}

export interface KeepRecognizedActions {
  readonly onKeepRecognized: () => void;
  readonly onKeepTierChange: (tier: PlanConfidenceTier) => void;
}

function layerText(layer: NamedLayerTarget, t: Translate): string {
  switch (layer.kind) {
    case 'existing': return t('modelFromDrawing.keep.lines.layer.existing', { name: layer.name });
    case 'create': return t('modelFromDrawing.keep.lines.layer.create', { name: layer.name });
    case 'refused':
      return t('modelFromDrawing.keep.lines.layer.refused', { reason: t(DIMENSION_LAYER_REFUSAL_LABEL_KEY[layer.reason]) });
  }
}

function LinesLayerLine({ layer, t }: { readonly layer: NamedLayerTarget; readonly t: Translate }): React.ReactElement {
  if (layer.kind === 'refused') {
    return (
      <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" role="alert" data-testid="mfd-lines-layer" data-kind={layer.kind}>
        <ToneSwatch tone="reject" />
        {layerText(layer, t)}
      </p>
    );
  }
  return <p className={MUTED} data-testid="mfd-lines-layer" data-kind={layer.kind}>{layerText(layer, t)}</p>;
}

function TierSelect({ tier, onChange, t }: {
  readonly tier: PlanConfidenceTier;
  readonly onChange: (tier: PlanConfidenceTier) => void;
  readonly t: Translate;
}): React.ReactElement {
  const label = t('modelFromDrawing.keep.tier.label');
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-foreground">
      <span className="flex-1">{label}</span>
      <Select value={tier} onValueChange={(v) => { if (isTier(v)) onChange(v); }}>
        <SelectTrigger size="sm" aria-label={label} data-testid="mfd-keep-tier">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-[10rem]">
          {PLAN_CONFIDENCE_ORDER.map((option) => (
            <SelectItem key={option} value={option} className="whitespace-nowrap">{t(TIER_LABEL_KEY[option])}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function LinesSection({ summary, tier, onTierChange, t }: {
  readonly summary: RecognizedLinesSummary;
  readonly tier: PlanConfidenceTier;
  readonly onTierChange: (tier: PlanConfidenceTier) => void;
  readonly t: Translate;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-1" data-testid="mfd-lines">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.keep.lines.title')}</h4>
      <TierSelect tier={tier} onChange={onTierChange} t={t} />
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {LINE_ROWS.map(([status, field]) => (
          <StatusCountRow key={status} status={status} count={summary[field]} t={t} />
        ))}
      </ul>
      {summary.fresh > 0 ? <LinesLayerLine layer={summary.layer} t={t} /> : null}
    </section>
  );
}

export function KeepRecognizedSection({ dimensions, lines, tier, calibrated, actions, t }: {
  readonly dimensions: RecognizedDimensionSummary | null;
  readonly lines: RecognizedLinesSummary | null;
  readonly tier: PlanConfidenceTier;
  readonly calibrated: boolean;
  readonly actions: KeepRecognizedActions;
  readonly t: Translate;
}): React.ReactElement | null {
  if (!dimensions && !lines) return null;
  const freshDimensions = dimensions?.fresh ?? 0;
  const freshLines = lines?.fresh ?? 0;
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-keep">
      {lines ? <LinesSection summary={lines} tier={tier} onTierChange={actions.onKeepTierChange} t={t} /> : null}
      <p className={MUTED}>{t('modelFromDrawing.keep.hint')}</p>
      <Button
        type="button" size="sm" variant="secondary" data-testid="mfd-keep-recognized"
        disabled={!calibrated || freshDimensions + freshLines === 0} onClick={actions.onKeepRecognized}
      >
        {t('modelFromDrawing.keep.button', { dimensions: freshDimensions, lines: freshLines })}
      </Button>
    </section>
  );
}
