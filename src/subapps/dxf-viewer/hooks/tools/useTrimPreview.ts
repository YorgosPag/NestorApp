/**
 * USE TRIM PREVIEW — ADR-350 Phase 2 (ADR-040 micro-leaf)
 *
 * Live overlay during a TRIM session. Thin binding over the shared
 * {@link useEditFencePreview} draw-skeleton (Cluster #16 SSoT, ADR-625): the RAF
 * lifecycle, sub-segment hover highlight, fence-preview / fence-line / pickbox
 * painting all live in the primitive. Here we bind only the store + the TRIM
 * colour policy (the colour-inverse of EXTEND):
 *  - Sub-segment / ghost path: red #FF3030 (SHIFT → EXTEND inverse green #22DD55)
 *  - Pickbox: yellow #FFD24A (SHIFT → green #22DD55)
 *  - ↗ extend-arrow tip shown while in inverse (extend) mode
 *
 * @module hooks/tools/useTrimPreview
 * @see hooks/tools/use-edit-fence-preview — shared EXTEND/TRIM draw-skeleton (ADR-625)
 */

import type { ViewTransform } from '../../rendering/types/Types';
import { TrimToolStore } from '../../systems/trim/TrimToolStore';
import { useEditFencePreview, type EditFencePreviewColors } from './use-edit-fence-preview';

export interface UseTrimPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// TRIM = red (remove), SHIFT (EXTEND inverse) = green; pickbox yellow; arrow in inverse mode.
const TRIM_COLORS: EditFencePreviewColors = {
  path: (inverse) => (inverse ? '#22DD55' : '#FF3030'),
  pickbox: (inverse) => (inverse ? '#22DD55' : '#FFD24A'),
  showArrow: (inverse) => inverse,
};

export function useTrimPreview(props: UseTrimPreviewProps): void {
  useEditFencePreview({ store: TrimToolStore, colors: TRIM_COLORS, ...props });
}
