/**
 * SnapPresets
 * Configuration presets for different use cases
 */

import { ExtendedSnapType, type ProSnapSettings } from './extended-types';
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
      snapDistance: 12,
      showSnapMarkers: true,
      showSnapTooltips: true,
      perModePxTolerance: {
        [ExtendedSnapType.ENDPOINT]: 8,
        [ExtendedSnapType.INTERSECTION]: 10,
        [ExtendedSnapType.MIDPOINT]: 8,
        [ExtendedSnapType.CENTER]: 8,
        [ExtendedSnapType.PERPENDICULAR]: 12,
        [ExtendedSnapType.GRID]: 10
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
      snapDistance: 15,
      showSnapMarkers: true,
      showSnapTooltips: true,
      perModePxTolerance: {
        [ExtendedSnapType.ENDPOINT]: 10,
        [ExtendedSnapType.INTERSECTION]: 12,
        [ExtendedSnapType.MIDPOINT]: 10,
        [ExtendedSnapType.CENTER]: 10,
        [ExtendedSnapType.TANGENT]: 14,
        [ExtendedSnapType.QUADRANT]: 12,
        [ExtendedSnapType.PERPENDICULAR]: 14
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
      snapDistance: 20,
      showSnapMarkers: true,
      showSnapTooltips: false,
      autoMode: true
    });
  }
}