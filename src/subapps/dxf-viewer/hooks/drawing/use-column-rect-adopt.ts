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
  findAdoptableColumnPerimeter,
  resolvePerimeterAdoptInfo,
  shouldProposeAdopt,
  type AdoptProposal,
} from '../../bim/columns/column-adopt-rect';
import type { ClosedPerimeter } from '../../bim/walls/perimeter-from-faces';
import { classifyColumnSectionSize } from '../../bim/validators/column-validator';
import { requestColumnAdoptSizeConfirm } from '../../bim/columns/column-adopt-size-confirm-store';
import {
  setRegionPerimeterPreview,
  singleZoneRegionPreview,
  clearRegionPerimeterPreview,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
import { formatLengthForDisplay } from '../../config/display-length-format';

export interface ColumnRectAdoptParams {
  readonly getSceneEntitiesRef: MutableRefObject<(() => readonly Entity[]) | undefined>;
  readonly getSceneUnitsRef: MutableRefObject<(() => SceneUnits) | undefined>;
  /** Υιοθέτηση ΟΡΘΟΓΩΝΙΟΥ: commit στοιχείου (κολόνα/τοιχίο) στο μέγεθος + κέντρο + γωνία + τύπο. */
  readonly onAdopt: (s: ColumnToolState, proposal: AdoptProposal) => void;
  /** Υιοθέτηση Γ/Τ/Π/σύνθετου: build+append τοιχίου του ΑΚΡΙΒΟΥΣ πολυγώνου (polygon-backed). */
  readonly onAdoptShape: (s: ColumnToolState, perimeter: ClosedPerimeter) => void;
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
  const { getSceneEntitiesRef, getSceneUnitsRef, onAdopt, onAdoptShape, onDefault } = params;

  const tryAdoptRectColumn = useCallback(
    (s: ColumnToolState, point: Readonly<Point2D>, anchor: ColumnAnchor): boolean => {
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const tol = resolveRegionLoopTolWorld(sceneUnits);
      // FULL SSoT — ΚΑΘΕ κλειστό σχήμα κάτω από το σημείο (ορθογώνιο robust corner-graph
      // Ή Γ/Τ/Π/σύνθετο polygon-backed). ΙΔΙΟ detection με το hover preview → preview ≡ commit.
      const perimeter = findAdoptableColumnPerimeter(
        point, sceneSnapTargetsStore.get().rectTargets, entities, tol, sceneUnits,
      );
      if (!perimeter) return false;

      const info = resolvePerimeterAdoptInfo(perimeter, sceneUnits);
      // Effective defaults = ribbon override → kind default (ώστε να μην ενοχλεί σε ≈default).
      const kindDims = getKindDimensionDefaults(s.kind);
      const eff = {
        width: s.overrides.width ?? kindDims.width,
        depth: s.overrides.depth ?? kindDims.depth,
      };
      // Ορθογώνιο ≈ default → αθόρυβη κανονική ροή. Τα Γ/Τ/Π ΠΑΝΤΑ προτείνονται (δεν
      // αναπαρίστανται ως default σημειακή κολόνα → το σχήμα είναι ρητή πρόθεση).
      if (info.isRectangle && !shouldProposeAdopt(info, eff)) return false;

      // §3.17 — κλιμακωτό μέγεθος (ΕΝΑ SSoT με τον validator): block (μη κατασκευάσιμο) / warning / ok.
      const shortMm = Math.min(info.widthMm, info.depthMm);
      const tier = classifyColumnSectionSize(shortMm, info.isShearWall);

      const captured: Point2D = { x: point.x, y: point.y };
      // Φώτισε το ανιχνευμένο περίγραμμα (ΟΛΟΚΛΗΡΟ το σχήμα — Γ/Τ/Π) όσο είναι ανοιχτό το
      // παράθυρο (reuse RegionPerimeterPreview SSoT). Κόκκινο όταν block, πράσινο αλλιώς.
      const label = `${formatLengthForDisplay(info.widthMm, { withUnit: false })} × ${formatLengthForDisplay(info.depthMm)}`;
      // ADR-419 §thickness-zones — ΕΝΑ ανιχνευμένο περίγραμμα = μία ζώνη, μέσω του SSoT
      // smart constructor του store (μηδέν raw literal → μηδέν απόκλιση σχήματος· η
      // προηγούμενη legacy `{polygon,label}` έσκαγε τον overlay στο `zones.length`).
      setRegionPerimeterPreview(singleZoneRegionPreview([...perimeter.polygon], label, tier === 'block'));
      void (async () => {
        const action = await requestColumnAdoptSizeConfirm({
          widthMm: info.widthMm,
          depthMm: info.depthMm,
          defaultWidthMm: eff.width,
          defaultDepthMm: eff.depth,
          isShearWall: info.isShearWall,
          tier,
        });
        clearRegionPerimeterPreview(); // σβήσε το highlight ό,τι κι αν επέλεξε ο χρήστης
        if (action === 'adopt') {
          // Ορθογώνιο → παραμετρικό commit (υπάρχον path)· Γ/Τ/Π → polygon-backed τοιχίο.
          if (info.isRectangle && info.rectProposal) onAdopt(s, info.rectProposal);
          else onAdoptShape(s, perimeter);
        } else if (action === 'default') onDefault(s, captured, anchor);
        // 'cancel' → τίποτα (το FSM μένει σε awaitingPosition).
      })();
      return true;
    },
    [getSceneEntitiesRef, getSceneUnitsRef, onAdopt, onAdoptShape, onDefault],
  );

  return { tryAdoptRectColumn };
}
