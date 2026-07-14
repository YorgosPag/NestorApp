/**
 * ADR-650 M8β/Β — ο store του 3Δ νέφους: το συμβόλαιο επιβίωσης/ορατότητας/απελευθέρωσης.
 *
 * Τα δύο πράγματα που ΠΡΕΠΕΙ να κρατήσουν, γιατί αν σπάσουν ο μηχανικός βλέπει ψέματα:
 *   1. φρέσκο νέφος → ορατό αμέσως (αλλιώς τρέχει το φίλτρο και δεν βλέπει τίποτα),
 *   2. import χωρίς νέφος (CSV/DXF) → το ΠΑΛΙΟ νέφος φεύγει (αλλιώς βλέπει άλλο εργοτάξιο).
 */

import {
  clearPointCloud3D,
  getPointCloud3DState,
  setPointCloud3D,
  setPointCloud3DVisible,
  subscribePointCloud3D,
} from '../pointcloud-3d-store';
import type { PointCloudPreview } from '../pointcloud/pointcloud-types';

const CLOUD: PointCloudPreview = {
  count: 1,
  positions: new Float32Array([0, 0, 0]),
  colors: new Float32Array([1, 1, 1]),
  origin: { x: 0, y: 0 },
};

afterEach(() => clearPointCloud3D());

describe('pointcloud-3d-store (ADR-650 M8β/Β)', () => {
  it('ξεκινά άδειος και αόρατος', () => {
    expect(getPointCloud3DState()).toEqual({ preview: null, visible: false });
  });

  it('ένα φρέσκο νέφος γίνεται ορατό αμέσως — αυτός είναι ο λόγος ύπαρξής του (§9)', () => {
    setPointCloud3D(CLOUD);

    expect(getPointCloud3DState()).toEqual({ preview: CLOUD, visible: true });
  });

  it('import χωρίς νέφος σβήνει το προηγούμενο — ένα νέφος ανά αποτύπωση', () => {
    setPointCloud3D(CLOUD);
    setPointCloud3D(null);

    expect(getPointCloud3DState()).toEqual({ preview: null, visible: false });
  });

  it('η απόκρυψη κρατά τα δεδομένα· η αφαίρεση τα πετά (μνήμη)', () => {
    setPointCloud3D(CLOUD);

    setPointCloud3DVisible(false);
    expect(getPointCloud3DState()).toEqual({ preview: CLOUD, visible: false });

    clearPointCloud3D();
    expect(getPointCloud3DState().preview).toBeNull();
  });

  it('ειδοποιεί τους subscribers (το 3Δ layer ξαναχτίζει· μηδέν React state)', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePointCloud3D(listener);

    setPointCloud3D(CLOUD);
    setPointCloud3DVisible(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    clearPointCloud3D();
    expect(listener).toHaveBeenCalledTimes(2); // μετά το unsubscribe, σιωπή
  });
});
