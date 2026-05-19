/**
 * Aggregator hook for BIM contextual ribbon bridges (stair / wall / opening /
 * slab / column / beam). Extracted from DxfViewerContent.tsx to keep that file
 * under the 500-line SRP limit. Each bridge is a thin contextual-tab wire-up.
 */
import { useRibbonStairBridge, type UseRibbonStairBridgeProps } from '../bim/hooks/use-ribbon-stair-bridge';
import { useRibbonWallBridge, type UseRibbonWallBridgeProps } from '../ui/ribbon/hooks/useRibbonWallBridge';
import { useRibbonOpeningBridge, type UseRibbonOpeningBridgeProps } from '../ui/ribbon/hooks/useRibbonOpeningBridge';
import { useRibbonSlabBridge, type UseRibbonSlabBridgeProps } from '../ui/ribbon/hooks/useRibbonSlabBridge';
import { useRibbonColumnBridge, type UseRibbonColumnBridgeProps } from '../ui/ribbon/hooks/useRibbonColumnBridge';
import { useRibbonBeamBridge, type UseRibbonBeamBridgeProps } from '../ui/ribbon/hooks/useRibbonBeamBridge';
import { useRibbonSlabOpeningBridge, type UseRibbonSlabOpeningBridgeProps } from '../ui/ribbon/hooks/useRibbonSlabOpeningBridge';

export type UseDxfBimBridgesProps =
  & UseRibbonStairBridgeProps
  & UseRibbonWallBridgeProps
  & UseRibbonOpeningBridgeProps
  & UseRibbonSlabBridgeProps
  & UseRibbonColumnBridgeProps
  & UseRibbonBeamBridgeProps
  & UseRibbonSlabOpeningBridgeProps;

export function useDxfBimBridges(p: UseDxfBimBridgesProps) {
  const stairBridge = useRibbonStairBridge(p);
  const wallBridge = useRibbonWallBridge(p);
  const openingBridge = useRibbonOpeningBridge(p);
  const slabBridge = useRibbonSlabBridge(p);
  const columnBridge = useRibbonColumnBridge(p);
  const beamBridge = useRibbonBeamBridge(p);
  const slabOpeningBridge = useRibbonSlabOpeningBridge(p);
  return { stairBridge, wallBridge, openingBridge, slabBridge, columnBridge, beamBridge, slabOpeningBridge };
}
