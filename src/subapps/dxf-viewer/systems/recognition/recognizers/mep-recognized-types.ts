/**
 * ADR-423 — MEP specialization of the Stage 0 recognition contract.
 *
 * `RecognizedTerminal` / `RecognizedSource` EXTEND the agnostic `RecognizedElement`
 * (kernel `recognition-types.ts`). This is the ONLY place MEP semantics enter the
 * recognition layer — the engine/kernel never imports these. Feeds Stage 1 (demand:
 * each terminal exposes its connector service classifications) and Stage 2/3
 * (sources are routing anchors).
 *
 * @see ../recognition-types.ts (agnostic base)
 * @see ./sanitary-terminal-recognizer.ts (pilot recognizer)
 */

import type { MepSystemClassification } from '../../../bim/types/mep-connector-types';
import type { RecognizedElement } from '../recognition-types';

/**
 * A back-reference to an existing host connector (the `(entityId, connectorId)`
 * global-identity tuple, ADR-408) plus its system classification — so Stage 1/3
 * read demand + service from the already-modeled connectors without re-deriving.
 */
export interface RecognizedConnectorRef {
  readonly entityId: string;
  readonly connectorId: string;
  readonly systemClassification: MepSystemClassification;
}

/**
 * A recognized MEP terminal (sanitary fixture, luminaire, radiator, diffuser, …).
 * Pilot = sanitary. `serviceClassifications` is the deduped set of the systems it
 * needs (e.g. cold + drain for a WC).
 */
export interface RecognizedTerminal extends RecognizedElement {
  readonly category: 'mep-terminal';
  /** Host-specific kind (e.g. `'wc'`, `'washbasin'`). */
  readonly terminalKind: string;
  readonly serviceClassifications: readonly MepSystemClassification[];
  readonly connectorRefs: readonly RecognizedConnectorRef[];
}

/** The kind of MEP source (network origin / equipment). */
export type MepSourceKind = 'meter' | 'manifold' | 'boiler' | 'water-heater' | 'panel' | 'ahu';

/** A recognized MEP source — a network origin (manifold/boiler/panel/meter/AHU). */
export interface RecognizedSource extends RecognizedElement {
  readonly category: 'mep-source';
  readonly sourceKind: MepSourceKind;
}

// ─── Narrowing guards ────────────────────────────────────────────────────────

export function isRecognizedTerminal(el: RecognizedElement): el is RecognizedTerminal {
  return el.category === 'mep-terminal';
}

export function isRecognizedSource(el: RecognizedElement): el is RecognizedSource {
  return el.category === 'mep-source';
}
