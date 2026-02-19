/**
 * SnapPresets
 * Configuration presets for different use cases
 */

import { ExtendedSnapType } from './extended-types';
import type { SnapEngineCore } from './SnapEngineCore';

export class SnapPresets {
  constructor(private engine: SnapEngineCore) {}

  /**
   * Προεπιλογή για αρχιτεκτονικά σχέδια
   */
  setArchitecturalPreset(): void {
    this.engine.updateSettings({
      enabledTypes: new Set([
        ExtendedSnapType.ENDPOINT,
        ExtendedSnapType.MIDPOINT,
        ExtendedSnapType.INTERSECTION,
        ExtendedSnapType.PERPENDICULAR,
        ExtendedSnapType.CENTER,
        ExtendedSnapType.GRID
      ]),
      snapDistance: 7,
      showSnapMarkers: true,
      showSnapTooltips: true,
      perModePxTolerance: {
        [ExtendedSnapType.ENDPOINT]: 5,
        [ExtendedSnapType.INTERSECTION]: 6,
        [ExtendedSnapType.MIDPOINT]: 5,
        [ExtendedSnapType.CENTER]: 5,
        [ExtendedSnapType.PERPENDICULAR]: 8,
        [ExtendedSnapType.GRID]: 8
      }
    });
  }

  /**
   * Προεπιλογή για μηχανικά σχέδια
   */
  setEngineeringPreset(): void {
    this.engine.updateSettings({
      enabledTypes: new Set([
        ExtendedSnapType.ENDPOINT,
        ExtendedSnapType.MIDPOINT,
        ExtendedSnapType.INTERSECTION,
        ExtendedSnapType.CENTER,
        ExtendedSnapType.TANGENT,
        ExtendedSnapType.QUADRANT,
        ExtendedSnapType.PERPENDICULAR
      ]),
      snapDistance: 8,
      showSnapMarkers: true,
      showSnapTooltips: true,
      perModePxTolerance: {
        [ExtendedSnapType.ENDPOINT]: 5,
        [ExtendedSnapType.INTERSECTION]: 6,
        [ExtendedSnapType.MIDPOINT]: 5,
        [ExtendedSnapType.CENTER]: 5,
        [ExtendedSnapType.TANGENT]: 8,
        [ExtendedSnapType.QUADRANT]: 6,
        [ExtendedSnapType.PERPENDICULAR]: 8
      }
    });
  }

  /**
   * Απλοποιημένη προεπιλογή για γρήγορη εργασία
   */
  setSimplePreset(): void {
    this.engine.updateSettings({
      enabledTypes: new Set([
        ExtendedSnapType.ENDPOINT,
        ExtendedSnapType.MIDPOINT,
        ExtendedSnapType.INTERSECTION
      ]),
      snapDistance: 10,
      showSnapMarkers: true,
      showSnapTooltips: false,
      autoMode: true
    });
  }
}