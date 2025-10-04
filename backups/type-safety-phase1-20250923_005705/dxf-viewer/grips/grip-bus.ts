// src/subapps/dxf-viewer/grips/grip-bus.ts
// Simplified grip bus implementation for unified grips system

interface GripTarget {
  id: string;
  type: 'dxf' | 'overlay';
  getVertices: () => any[];
  getBBox: () => {min: {x: number, y: number}, max: {x: number, y: number}};
  setVertex: (i: number, p: {x: number, y: number}) => void;
}

class GripBus {
  private attachedTargets = new Map<string, GripTarget>();

  attach(target: GripTarget) {
    console.log('[GripBus] Attaching grip target:', target.id, target.type);
    this.attachedTargets.set(target.id, target);
    // TODO: Integrate with actual grip system
    // This would typically notify the grip provider to show grips for this target
  }

  detach(entityId: string) {
    console.log('[GripBus] Detaching grip target:', entityId);
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