/**
 * Κοινοί τύποι του κελύφους κτιρίου (ADR-396 · ADR-937 · ADR-422).
 *
 * Ζούσαν μέσα στο παλιό `envelope-perimeter.ts` (γράφος τοίχων). Με το ένα SSoT κελύφους
 * (`envelope-topology.ts` → ένωση αποτυπωμάτων τοίχων+κολωνών+δοκαριών, ADR-937 2026-11-13) ο γράφος
 * αποσύρθηκε· οι τύποι μένουν εδώ, χωρίς λογική.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.1
 */

import type { BimPolyline } from '../types/bim-base';
import type { WallKind, WallParams } from '../types/wall-types';

export type { ColumnForEnvelope } from './envelope-column-bridge';

export interface WallForEnvelope {
  readonly id: string;
  readonly kind: WallKind;
  readonly params: WallParams;
}

/** Ένα τρέξιμο μόνωσης ETICS κατά μήκος ενός δακτυλίου του κελύφους (`computeEnvelopeShell`). */
export interface EnvelopeChain {
  readonly exteriorFaceLoop: BimPolyline;
  readonly insulationOuterLoop: BimPolyline;
  readonly closed: boolean;
  /** true όταν το τρέξιμο **περικλείει χώρο** (στο shell: ίσο με `closed`). SSoT ETICS gate (§3.1). */
  readonly enclosesRegion: boolean;
  readonly perimeterM: number;
  readonly wallIds: readonly string[];
  readonly columnIds: readonly string[];
  /** Δοκάρια που συνεισφέρουν στο κέλυφος· consumers διαβάζουν `?? []`. BOQ per-element attribution. */
  readonly beamIds?: readonly string[];
  /**
   * ADR-401 v2 (Phase B3b) — source wall id **ανά ακμή** του `exteriorFaceLoop`, ευθυγραμμισμένο 1:1 με
   * `envelopeFaceEdges(exteriorFaceLoop)`. `null` = ακμή μη-τοίχου (→ επίπεδο fallback).
   */
  readonly edgeWallIds?: readonly (string | null)[];
}
