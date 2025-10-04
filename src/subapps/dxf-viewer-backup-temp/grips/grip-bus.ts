// src/subapps/dxf-viewer/grips/grip-bus.ts
// Simplified grip bus implementation for unified grips system

import type { Point2D } from '../rendering/types/Types';

interface GripTarget {
  id: string;
  type: 'dxf' | 'overlay';
  getVertices: () => Array<Point2D>;
  getBBox: () => {min: Point2D, max: Point2D};
  setVertex: (i: number, p: Point2D) => void;
}

class GripBus {
  private attachedTargets = new Map<string, GripTarget>();

  attach(target: GripTarget) {

    this.attachedTargets.set(target.id, target);
    // TODO: Integrate with actual grip system
    // This would typically notify the grip provider to show grips for this target
  }

  detach(entityId: string) {

    this.attachedTargets.delete(entityId);
    // TODO: Integrate with actual grip system
    // This would typically notify the grip provider to hide grips for this target
  }

  getAttachedTargets() {
    return Array.from(this.attachedTargets.values());
  }

  isAttached(entityId: string) {
    return this.attachedTargets.has(entityId);
  }
}

export const gripBus = new GripBus();