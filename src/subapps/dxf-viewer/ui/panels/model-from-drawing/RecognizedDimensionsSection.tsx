'use client';

/**
 * ADR-929 Δ20 Σ1.3β — η στρώση **«Διαστάσεις»** μέσα στο ίδιο εργαλείο ελέγχου (Δ10/Δ18): τι θα γράψει η έγκριση
 * ΠΡΙΝ πατηθεί — «Θα δημιουργηθούν N · Υπάρχουν ήδη M», σε ποιο επίπεδο (υπάρχον ή νέο), και αν το επίπεδο είναι
 * άκυρο, ότι οι διαστάσεις **δεν** θα γραφτούν και γιατί. Τίποτα σιωπηλό.
 *
 * Ίδια γραμμή υπομνήματος με τους τοίχους (`StatusCountRow` — ίδια ετικέτα, ίδιο μοτίβο γραμμής του καμβά):
 * «Θα δημιουργηθούν» σημαίνει το ίδιο πράγμα σε κάθε στρώση.
 *
 * Καθαρή παρουσίαση: η περίληψη έρχεται από τον ελεγκτή (`summarizeRecognizedDimensions`, ο ΙΔΙΟΣ υπολογισμός με
 * την εγγραφή). Χαμηλόσυχνο (ADR-040).
 *
 * @see ../../../systems/model-from-drawing/model-from-drawing-dimensions.ts
 */

import * as React from 'react';
import type { WallProposalStatus } from '../../../bim/model-from-drawing/wall-proposal';
import type { DimensionLayerTarget } from '../../../services/named-layer';
import type { RecognizedDimensionSummary } from '../../../systems/model-from-drawing/model-from-drawing-dimensions';
import { DIMENSION_LAYER_REFUSAL_LABEL_KEY } from '../../../systems/model-from-drawing/dimension-label-keys';
import { MUTED, SECTION_TITLE, StatusCountRow, ToneSwatch, type Translate } from './ModelFromDrawingSections';

/** Οι δύο καταστάσεις που έχει νόημα να έχει μια διάσταση της αναγνώρισης, με τη σειρά του υπομνήματος. */
type DimensionRow = readonly [Extract<WallProposalStatus, 'ready' | 'existing'>, 'fresh' | 'existing'];

const DIMENSION_ROWS: readonly DimensionRow[] = [
  ['ready', 'fresh'],
  ['existing', 'existing'],
];

function layerText(layer: DimensionLayerTarget, t: Translate): string {
  switch (layer.kind) {
    case 'existing': return t('modelFromDrawing.dimensions.layer.existing', { name: layer.name });
    case 'create': return t('modelFromDrawing.dimensions.layer.create', { name: layer.name });
    case 'current': return t('modelFromDrawing.dimensions.layer.current');
    case 'refused':
      return t('modelFromDrawing.dimensions.layer.refused', { reason: t(DIMENSION_LAYER_REFUSAL_LABEL_KEY[layer.reason]) });
  }
}

/** Σε ποιο επίπεδο — μόνο όταν κάτι θα γραφτεί· η άρνηση ως `alert`, γιατί αλλάζει ό,τι κάνει η έγκριση. */
function LayerLine({ layer, t }: { readonly layer: DimensionLayerTarget; readonly t: Translate }): React.ReactElement {
  if (layer.kind === 'refused') {
    return (
      <p className="m-0 flex items-start gap-1.5 text-[11px] text-foreground" role="alert" data-testid="mfd-dimensions-layer" data-kind={layer.kind}>
        <ToneSwatch tone="reject" />
        {layerText(layer, t)}
      </p>
    );
  }
  return <p className={MUTED} data-testid="mfd-dimensions-layer" data-kind={layer.kind}>{layerText(layer, t)}</p>;
}

export function RecognizedDimensionsSection({ summary, t }: {
  readonly summary: RecognizedDimensionSummary | null;
  readonly t: Translate;
}): React.ReactElement | null {
  if (!summary || summary.fresh + summary.existing === 0) return null;
  return (
    <section className="flex flex-col gap-1" data-testid="mfd-dimensions">
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.dimensions.title')}</h4>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {DIMENSION_ROWS.map(([status, field]) => (
          <StatusCountRow key={status} status={status} count={summary[field]} t={t} />
        ))}
      </ul>
      {summary.fresh > 0 ? <LayerLine layer={summary.layer} t={t} /> : null}
    </section>
  );
}
