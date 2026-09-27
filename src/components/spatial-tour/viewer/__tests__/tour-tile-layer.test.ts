/**
 * @fileoverview **Η ΣΤΡΩΣΗ ΠΛΑΚΙΔΙΩΝ ΕΝΟΣ ΚΥΒΟΥ** (ADR-884 Φ2ε · §4.11) — αληθινά αντικείμενα three (χωρίς WebGL).
 *
 * - **Φ** — φύλακας στάσης: πλακίδιο άλλης στάσης δεν μπαίνει ποτέ (M11 — «εικόνα του Α πάνω στο Β»).
 * - **Σ** — σειρά σχεδίασης: ψηλότερο επίπεδο πάνω από χαμηλότερο, όλα πάνω από τη βάση του κύβου.
 * - **Α** — αδιαφάνεια: το ΙΔΙΟ uniform με τη βάση (το σβήσιμο της μετάβασης τα παίρνει μαζί του).
 * - **Ο** — όριο και αποδέσμευση: πάνω από `TILE_LAYER_MAX` φεύγει το παλαιότερο· αλλαγή στάσης καθαρίζει τα πάντα.
 */

import type { Mesh, ShaderMaterial } from 'three';

import type { TourTileAddress } from '@/lib/spatial-tour/viewer/tour-tile-visibility';

import type { TourFaceImage } from '../tour-panorama-source';
import { createTileLayer, TILE_LAYER_MAX } from '../tour-tile-layer';

const IMAGE = { width: 512, height: 512 } as TourFaceImage;
const at = (level: number, row = 0, col = 0): TourTileAddress => ({ level, face: 'front', row, col });
const meshes = (layer: ReturnType<typeof createTileLayer>) => layer.group.children as Array<Mesh<never, ShaderMaterial>>;

describe('createTileLayer', () => {
  it('Φ — πλακίδιο ΑΛΛΗΣ στάσης αγνοείται· της δικής του μπαίνει', () => {
    const layer = createTileLayer({ value: 1 });
    layer.setStop('b');
    expect(layer.put('a', '0/front/0/0', at(0), 512, IMAGE)).toBe(false);
    expect(layer.put('b', '0/front/0/0', at(0), 512, IMAGE)).toBe(true);
    expect(meshes(layer)).toHaveLength(1);
  });

  it('Σ — σειρά σχεδίασης: βάση + 1 + επίπεδο, και ακολουθεί τη βάση όταν ο κύβος αλλάζει στρώση', () => {
    const layer = createTileLayer({ value: 1 });
    layer.setStop('a');
    layer.put('a', 'low', at(1), 1024, IMAGE);
    layer.put('a', 'high', at(3), 2560, IMAGE);
    expect(meshes(layer).map((m) => m.renderOrder)).toEqual([2, 4]);
    layer.setBaseOrder(10);
    expect(meshes(layer).map((m) => m.renderOrder)).toEqual([12, 14]);
  });

  it('Α — το uniform αδιαφάνειας είναι το ΙΔΙΟ αντικείμενο με της βάσης', () => {
    const opacity = { value: 1 };
    const layer = createTileLayer(opacity);
    layer.setStop('a');
    layer.put('a', 't', at(0), 512, IMAGE);
    opacity.value = 0.25;
    expect(meshes(layer)[0].material.uniforms.opacity.value).toBe(0.25);
  });

  it('Ο — πάνω από το όριο φεύγει το παλαιότερο· αλλαγή στάσης αδειάζει τη στρώση', () => {
    const layer = createTileLayer({ value: 1 });
    layer.setStop('a');
    for (let i = 0; i <= TILE_LAYER_MAX; i++) layer.put('a', `t${i}`, at(3, Math.floor(i / 5) % 5, i % 5), 2560, IMAGE);
    expect(meshes(layer)).toHaveLength(TILE_LAYER_MAX);
    expect(layer.has('t0')).toBe(false);
    expect(layer.has(`t${TILE_LAYER_MAX}`)).toBe(true);
    layer.setStop('b');
    expect(meshes(layer)).toHaveLength(0);
  });
});
