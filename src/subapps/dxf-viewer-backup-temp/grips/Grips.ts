// DISABLED: Legacy Grip System - replaced with Unified Grips System (UGS)
// import { gripBus } from './grip-bus';              
// import { resolveGripTarget } from './resolveTarget'; 
// import { assert } from '../utils/assert';

export const Grips = {
  // DISABLED: Legacy grip system - use Unified Grips System instead
  /**
   * Συνδέει grips σε οντότητα (DXF ή overlay).
   * Για overlays περνάμε type: 'overlay' ώστε ο resolver να διαβάσει τα vertices από το overlay repo.
   */
  attachTo(entityId: string, type: 'dxf' | 'overlay' = 'overlay') {
    // DISABLED: Use Unified Grips System instead
    return;
  },
  detachFrom(entityId: string) {
    // DISABLED: Use Unified Grips System instead
    return;
  }
};