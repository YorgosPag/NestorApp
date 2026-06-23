/**
 * ADR-398 §3.17 — «Υιοθέτηση μεγέθους ορθογωνίου» click helper για το column tool.
 *
 * Εξήχθη από `useColumnTool.ts` (N.7.1 file-size split — mirror του `use-column-perimeter-commit`): το
 * 1ο κλικ μέσα σε ορθογώνιο DXF ρωτά τον χρήστη (opt-in confirm) αν θα υιοθετήσει το μέγεθος+κέντρο+γωνία
 * +τύπο (κολόνα/τοιχίο κατά EC2). Η απόφαση/γεωμετρία είναι pure SSoT (`column-adopt-rect`)· εδώ μένει
 * μόνο το async handshake + το routing σε commit (adopt) ή κανονική ροή (default).
 *
 * @see ../../bim/columns/column-adopt-rect.ts — pure resolver (Φ1 rectTargets + Φ2 corner-graph) + EC2 kind
 * @see ../../bim/columns/column-adopt-size-confirm-store.ts — Promise handshake store
 * @see ./useColumnTool.ts (orchestrator)
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.17
 */

import { useCallback, type MutableRefObject } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnAnchor } from '../../bim/types/column-types';
import type { SceneUnits } from './column-completion';
import { getKindDimensionDefaults } from './column-completion';
import type { ColumnToolState } from './useColumnTool';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
import {
  findAdoptableRectUnderPoint,
  resolveAdoptProposal,
  shouldProposeAdopt,
  type AdoptProposal,
} from '../../bim/columns/column-adopt-rect';
import { classifyColumnSectionSize } from '../../bim/validators/column-validator';
import { requestColumnAdoptSizeConfirm } from '../../bim/columns/column-adopt-size-confirm-store';
import {
  setRegionPerimeterPreview,
  clearRegionPerimeterPreview,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
import { formatLengthForDisplay } from '../../config/display-length-format';

export interface ColumnRectAdoptParams {
  readonly getSceneEntitiesRef: MutableRefObject<(() => readonly Entity[]) | undefined>;
  readonly getSceneUnitsRef: MutableRefObject<(() => SceneUnits) | undefined>;
  /** Υιοθέτηση: commit στοιχείου (κολόνα/τοιχίο) στο μέγεθος + κέντρο + γωνία + τύπο της πρότασης. */
  readonly onAdopt: (s: ColumnToolState, proposal: AdoptProposal) => void;
  /** Προεπιλογή («Όχι»): κανονική ροή τοποθέτησης (2-κλικ θέση→γωνία) στο σημείο κλικ. */
  readonly onDefault: (s: ColumnToolState, point: Point2D, anchor: ColumnAnchor) => void;
}

export interface ColumnRectAdoptResult {
  /**
   * Αν το 1ο κλικ έπεσε μέσα σε υιοθετήσιμο ορθογώνιο με αισθητά διαφορετικό μέγεθος → ανοίγει το
   * confirm dialog (async) και επιστρέφει `true` (ο caller σταματά — η ροή συνεχίζει στο resolve).
   * Αλλιώς `false` (ο caller προχωρά στην κανονική ροή).
   */
  tryAdoptRectColumn(s: ColumnToolState, point: Readonly<Point2D>, anchor: ColumnAnchor): boolean;
}

export function useColumnRectAdopt(params: ColumnRectAdoptParams): ColumnRectAdoptResult {
  const { getSceneEntitiesRef, getSceneUnitsRef, onAdopt, onDefault } = params;

  const tryAdoptRectColumn = useCallback(
    (s: ColumnToolState, point: Readonly<Point2D>, anchor: ColumnAnchor): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const tol = resolveRegionLoopTolWorld(sceneUnits);
      const rect = findAdoptableRectUnderPoint(point, sceneSnapTargetsStore.get().rectTargets, entities, tol);
      if (!rect) return false;

      const proposal = resolveAdoptProposal(rect, sceneUnits);
      // Effective defaults = ribbon override → kind default (ώστε να μην ενοχλεί σε ≈default).
      const kindDims = getKindDimensionDefaults(s.kind);
      const eff = {
        width: s.overrides.width ?? kindDims.width,
        depth: s.overrides.depth ?? kindDims.depth,
      };
      if (!shouldProposeAdopt(proposal, eff)) return false;

      // §3.17 — κλιμακωτό μέγεθος (ΕΝΑ SSoT με τον validator): block (μη κατασκευάσιμο) / warning / ok.
      const shortMm = Math.min(proposal.widthMm, proposal.depthMm);
      const tier = classifyColumnSectionSize(shortMm, proposal.isShearWall);

      const captured: Point2D = { x: point.x, y: point.y };
      // Φώτισε το ανιχνευμένο περίγραμμα όσο είναι ανοιχτό το παράθυρο (reuse RegionPerimeterPreview SSoT).
      // Κόκκινο (oversized flag) όταν block (μη κατασκευάσιμο), πράσινο αλλιώς. Καθαρίζεται στο resolve.
      const label = `${formatLengthForDisplay(proposal.widthMm, { withUnit: false })} × ${formatLengthForDisplay(proposal.depthMm)}`;
      setRegionPerimeterPreview({ polygon: [...rect.polygon], oversized: tier === 'block', label });
      void (async () => {
        const action = await requestColumnAdoptSizeConfirm({
          widthMm: proposal.widthMm,
          depthMm: proposal.depthMm,
          defaultWidthMm: eff.width,
          defaultDepthMm: eff.depth,
          isShearWall: proposal.isShearWall,
          tier,
        });
        clearRegionPerimeterPreview(); // σβήσε το highlight ό,τι κι αν επέλεξε ο χρήστης
        if (action === 'adopt') onAdopt(s, proposal);
        else if (action === 'default') onDefault(s, captured, anchor);
        // 'cancel' → τίποτα (το FSM μένει σε awaitingPosition).
      })();
      return true;
    },
    [getSceneEntitiesRef, getSceneUnitsRef, onAdopt, onDefault],
  );

  return { tryAdoptRectColumn };
}
