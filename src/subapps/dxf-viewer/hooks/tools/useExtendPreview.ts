/**
 * USE EXTEND PREVIEW — ADR-353 (ADR-040 micro-leaf)
 *
 * Live canvas overlay during an EXTEND session. Thin binding over the shared
 * {@link useEditFencePreview} draw-skeleton (Cluster #16 SSoT, ADR-625): the RAF
 * lifecycle, hover-path / fence-preview / fence-line / pickbox painting all live
 * in the primitive. Here we bind only the store + the EXTEND colour policy:
 *  - Ghost extension path + pickbox: green #22DD55 (SHIFT → TRIM inverse red #FF3030)
 *  - ↗ extend-arrow tip shown while NOT in inverse (trim) mode
 *
 * @module hooks/tools/useExtendPreview
 * @see hooks/tools/use-edit-fence-preview — shared EXTEND/TRIM draw-skeleton (ADR-625)
 */

import type { ViewTransform } from '../../rendering/types/Types';
import { ExtendToolStore } from '../../systems/extend/ExtendToolStore';
import { useEditFencePreview, type EditFencePreviewColors } from './use-edit-fence-preview';

export interface UseExtendPreviewProps {
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// EXTEND = green (add), SHIFT (TRIM inverse) = red; arrow shown in extend mode.
const EXTEND_COLORS: EditFencePreviewColors = {
  path: (inverse) => (inverse ? '#FF3030' : '#22DD55'),
  pickbox: (inverse) => (inverse ? '#FF3030' : '#22DD55'),
  showArrow: (inverse) => !inverse,
};

export function useExtendPreview(props: UseExtendPreviewProps): void {
  useEditFencePreview({ store: ExtendToolStore, colors: EXTEND_COLORS, ...props });
}
