/**
 * ADR-909 Β2.2 — ΑΓΚΥΡΕΣ της **όψης της δημόσιας κάτοψης**: ό,τι είναι της συνεδρίας δεν ταξιδεύει.
 *
 *   Ο1  μέσα στην όψη το store απαντά με το ΠΡΟΤΥΠΟ· μετά, με τη συνεδρία
 *   Ο2  ρίψη μέσα στην απόδοση ⇒ το store επανέρχεται (και η ρίψη περνά)
 *   Ο3  κανένας συνδρομητής δεν ειδοποιείται — ο ζωντανός καμβάς δεν ξανασχεδιάζεται
 *   Ο4  η κλίμακα σχεδίασης ΜΕΝΕΙ της συνεδρίας
 *   Ο5  το πρότυπο καλύπτει ΚΑΘΕ ρύθμιση όψης εκτός από την κλίμακα («όλα εκτός από», όχι λίστα)
 *   Α1  απομόνωση: μέσα «καμία», μετά όπως ήταν — και εμφωλευμένα
 *   Α2  🏆 απομονωμένη κολόνα: έξω ο τοίχος παραλείπεται, μέσα ΟΧΙ
 *   Τ1  κρυφό «DXF Σχέδιο»: έξω η γραμμή παραλείπεται, μέσα ΟΧΙ
 */

import type { DxfEntityUnion } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { isEntityLayerSkipped } from '../../../canvas-v2/dxf-canvas/dxf-entity-layer-skip';
import { resolveBimSettings } from '../../../config/bim-render-settings-types';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { renderWithViewSettings } from '../../../state/bim-render-settings-view-scope';
import {
  __resetIsolateEffectsForTesting,
  getIsolateEffectsSnapshot,
  renderWithIsolateSuspended,
  setIsolateEffects,
} from '../../../systems/isolate/IsolateEffectsStore';
import { publicFloorplanViewTemplate, renderInPublicFloorplanView } from '../public-floorplan-view';

const store = useBimRenderSettingsStore;
const initial = store.getState();

const wall = { id: 'wall_1', type: 'wall', layerId: 'lyr_1', visible: true } as unknown as DxfEntityUnion;

beforeEach(() => {
  store.setState(initial, true);
  __resetIsolateEffectsForTesting();
});

describe('Ο — το store μέσα από το πρότυπο', () => {
  it('Ο1 μέσα το ΠΡΟΤΥΠΟ, μετά η συνεδρία', () => {
    store.setState({ cutPlaneActive: true, showReinforcement: true });

    const seen = renderInPublicFloorplanView(() => {
      const { cutPlaneActive, showReinforcement } = store.getState();
      return { cutPlaneActive, showReinforcement };
    });

    expect(seen).toStrictEqual({ cutPlaneActive: false, showReinforcement: false });
    expect(store.getState().cutPlaneActive).toBe(true);
    expect(store.getState().showReinforcement).toBe(true);
  });

  it('Ο2 ρίψη μέσα στην απόδοση ⇒ το store επανέρχεται', () => {
    store.setState({ cutPlaneActive: true });
    const live = store.getState;

    expect(() => renderWithViewSettings({ cutPlaneActive: false }, () => { throw new Error('boom'); })).toThrow('boom');

    expect(store.getState).toBe(live);
    expect(store.getState().cutPlaneActive).toBe(true);
  });

  it('Ο3 κανένας συνδρομητής δεν ειδοποιείται', () => {
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    renderInPublicFloorplanView(() => store.getState());
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });

  it('Ο4 η κλίμακα σχεδίασης ΜΕΝΕΙ της συνεδρίας', () => {
    store.setState({ drawingScale: 20, drawingScaleUserSet: true });

    const seen = renderInPublicFloorplanView(() => store.getState());

    expect(seen.drawingScale).toBe(20);
    expect(seen.drawingScaleUserSet).toBe(true);
  });

  it('Ο5 το πρότυπο καλύπτει ΚΑΘΕ ρύθμιση όψης εκτός από την κλίμακα', () => {
    const everySetting = Object.keys(resolveBimSettings(null)).sort();
    const templated = Object.keys(publicFloorplanViewTemplate()).sort();

    expect(templated).toStrictEqual(everySetting.filter((key) => !key.startsWith('drawingScale')));
  });
});

describe('Α — η απομόνωση είναι της συνεδρίας', () => {
  const isolateColumn = (): void =>
    setIsolateEffects({ mode: 'freeze', isolatedLayerIds: [], isolatedEntityIds: ['column_1'], dimOpacityPercent: 30 });

  it('Α1 μέσα «καμία απομόνωση», μετά όπως ήταν — και εμφωλευμένα', () => {
    isolateColumn();

    const inside = renderWithIsolateSuspended(() => {
      const nested = renderWithIsolateSuspended(() => getIsolateEffectsSnapshot().active);
      return { nested, afterNested: getIsolateEffectsSnapshot().active };
    });

    expect(inside).toStrictEqual({ nested: false, afterNested: false });
    expect(getIsolateEffectsSnapshot().active).toBe(true);
  });

  it('Α2 🏆 απομονωμένη κολόνα: έξω ο τοίχος παραλείπεται, μέσα ΟΧΙ', () => {
    isolateColumn();

    expect(isEntityLayerSkipped(wall)).toBe(true);
    expect(renderInPublicFloorplanView(() => isEntityLayerSkipped(wall))).toBe(false);
    expect(isEntityLayerSkipped(wall)).toBe(true);
  });
});

describe('Τ — η τομή και το «DXF Σχέδιο» είναι της όψης', () => {
  it('Τ1 κρυφό «DXF Σχέδιο»: έξω η γραμμή παραλείπεται, μέσα ΟΧΙ', () => {
    const line = { id: 'line_1', type: 'line', layerId: 'lyr_1', visible: true } as unknown as DxfEntityUnion;
    store.setState({ dxfImport: { ...store.getState().dxfImport, visible: false } });

    expect(isEntityLayerSkipped(line)).toBe(true);
    expect(renderInPublicFloorplanView(() => isEntityLayerSkipped(line))).toBe(false);
  });
});
