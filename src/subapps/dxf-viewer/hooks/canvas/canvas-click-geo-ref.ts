/**
 * ADR-650 M10 — «Κοινό σημείο γεωαναφοράς»: ΕΝΑ κλικ σε γνωστό σημείο του σχεδίου
 * καταγράφει την ΤΟΠΙΚΗ του συντεταγμένη (Revit «Specify Coordinates at Point»). Το
 * panel μετά ζητά την πραγματική ΕΓΣΑ συντεταγμένη και συνθέτει το transform.
 *
 * Ζει σε δικό του module (ίδιο idiom με `canvas-click-topo-boundary.ts`) — το wiring
 * μένει ΕΝΑ branch στο `useCanvasClickHandler`. Το `worldPoint` φτάνει ΗΔΗ snapped στο
 * πλησιέστερο χαρακτηριστικό (κορυφή/άκρο), οπότε ο χρήστης πιάνει ακριβώς τη γωνία που
 * θέλει· καμία επιπλέον γεωμετρία εδώ — μόνο capture + μήνυμα.
 *
 * @see ../../systems/geo-referencing/geo-ref-pick-store.ts — captureGeoRefPick
 */

import type { Point2D } from '../../rendering/types/Types';
import {
  captureGeoRefPick,
  getGeoRefPickState,
} from '../../systems/geo-referencing/geo-ref-pick-store';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { i18n } from '@/i18n';
import { dlog } from '../../debug';
import type { UseCanvasClickHandlerParams } from './canvas-click-types';

const GEO_REF_NS = 'dxf-viewer-shell';

/**
 * Capture the click's LOCAL coordinate into the armed pick slot. Always consumes the
 * click (so it does not fall through to drawing/selection). No armed slot → the tool is
 * on but the panel has not requested a point yet: prompt and consume.
 */
export function handleGeoRefAnchorClick(
  worldPoint: Point2D,
  _p: UseCanvasClickHandlerParams,
): boolean {
  const armed = getGeoRefPickState().armedSlot;
  if (armed === null) {
    toolHintOverrideStore.setOverride(i18n.t('geoRef.status.armSlot', { ns: GEO_REF_NS }));
    return true;
  }
  captureGeoRefPick(worldPoint);
  toolHintOverrideStore.setOverride(i18n.t('geoRef.status.captured', { ns: GEO_REF_NS }));
  dlog('handleGeoRefAnchorClick', `slot ${armed} @ (${worldPoint.x.toFixed(1)}, ${worldPoint.y.toFixed(1)})`);
  return true;
}
