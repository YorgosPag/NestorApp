/**
 * Άγκυρες της συρραφής του κλικ (ADR-777 §8.76) — `listing-map-pick.ts`.
 *
 * Ο χάρτης είναι ψεύτικος (jsdom χωρίς WebGL): καταγράφει τους χειριστές, απαντά στο
 * `queryRenderedFeatures` ό,τι του πούμε, και η πηγή απαντά με **ελεγχόμενες** Promise —
 * ώστε να δοκιμαστεί η σειρά (δεύτερο κλικ πριν απαντήσει η πρώτη).
 */

import { bindMapPick, type ListingMapStack, type MapPickHandlers } from '../listing-map-pick';
import type { MapEventTarget, MapPointerEvent, RenderedFeature } from '../results-map-contract';

interface Deferred<T> { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void }
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const leaf = (id: string, lng: number, lat: number): RenderedFeature => ({
  properties: { id },
  geometry: { type: 'Point', coordinates: [lng, lat] },
});

function fakeMap(hits: RenderedFeature[]) {
  let click: ((e: MapPointerEvent) => void) | null = null;
  const expansion: Array<Deferred<number>> = [];
  const leaves: Array<Deferred<RenderedFeature[]>> = [];
  const flyTo = jest.fn();
  const cursor = { style: { cursor: '' } };
  const target = {
    on: (ev: string, layerOrHandler: unknown) => {
      if (ev === 'click' && typeof layerOrHandler === 'function') click = layerOrHandler as (e: MapPointerEvent) => void;
    },
    getCanvas: () => cursor,
    queryRenderedFeatures: () => hits,
    getSource: () => ({
      getClusterExpansionZoom: () => { const d = deferred<number>(); expansion.push(d); return d.promise; },
      getClusterLeaves: () => { const d = deferred<RenderedFeature[]>(); leaves.push(d); return d.promise; },
    }),
    cameraForBounds: () => ({ center: { lng: 22.95, lat: 40.635 }, zoom: 9 }),
    flyTo,
  } as unknown as MapEventTarget;
  const fire = (lng = 22.94, lat = 40.64) => {
    if (click === null) throw new Error('click not bound');
    click({ point: { x: 1, y: 1 }, lngLat: { lng, lat }, originalEvent: { kind: 'human' } });
  };
  return { target, fire, expansion, leaves, flyTo, setHits: (h: RenderedFeature[]) => hits.splice(0, hits.length, ...h) };
}

function handlers() {
  const stacks: Array<ListingMapStack | null> = [];
  const h: Required<MapPickHandlers> = {
    onPeek: jest.fn(),
    onSelect: jest.fn(),
    onClear: jest.fn(),
    onStack: (s) => { stacks.push(s); },
  };
  return { ref: { current: h }, h, stacks };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const clusterHit: RenderedFeature = {
  layer: { id: 'listing-cluster' },
  properties: { cluster: true, cluster_id: 4, point_count: 2 },
};

describe('bindMapPick', () => {
  it('χωρίς onSelect δεν δένεται τίποτα (οθόνη 3)', () => {
    const map = fakeMap([]);
    bindMapPick(map.target, { current: {} });
    expect(() => map.fire()).toThrow('click not bound');
  });

  it('κλικ στο κενό ⇒ ακύρωση + κλείσιμο εκκρεμούς λίστας', () => {
    const map = fakeMap([]);
    const { ref, h, stacks } = handlers();
    bindMapPick(map.target, ref);
    map.fire();
    expect(h.onClear).toHaveBeenCalledTimes(1);
    expect(stacks).toEqual([null]);
  });

  it('πινέζα με δακτύλιο ⇒ ΜΙΑ επιλογή (όχι δύο, όπως με χειριστή ανά επίπεδο)', () => {
    const map = fakeMap([
      { layer: { id: 'listing-pin-ring' }, properties: { id: 'a' } },
      { layer: { id: 'listing-pin' }, properties: { id: 'a' } },
    ]);
    const { ref, h } = handlers();
    bindMapPick(map.target, ref);
    map.fire();
    expect(h.onSelect).toHaveBeenCalledTimes(1);
    expect(h.onSelect).toHaveBeenCalledWith('a');
  });

  it('δύο πινέζες στο ίδιο σημείο ⇒ λίστα στο σημείο του κλικ', () => {
    const map = fakeMap([
      { layer: { id: 'listing-pin' }, properties: { id: 'a' } },
      { layer: { id: 'listing-pin' }, properties: { id: 'b' } },
    ]);
    const { ref, stacks } = handlers();
    bindMapPick(map.target, ref);
    map.fire(23, 40);
    expect(stacks.at(-1)).toEqual({ ids: ['a', 'b'], point: { lng: 23, lat: 40 } });
  });

  it('ομάδα που χωρίζει ⇒ πτήση σε max(κάδρο, διάσπαση), με το originalEvent ως eventData', async () => {
    const map = fakeMap([clusterHit]);
    const { ref } = handlers();
    bindMapPick(map.target, ref);
    map.fire();
    map.expansion[0].resolve(12);
    map.leaves[0].resolve([leaf('a', 22.94, 40.64), leaf('b', 22.96, 40.63)]);
    await flush();
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    const [options, eventData] = map.flyTo.mock.calls[0];
    expect(options).toMatchObject({ center: { lng: 22.95, lat: 40.635 }, zoom: 12 });
    expect(options).toHaveProperty('speed');
    expect(options).not.toHaveProperty('duration');
    expect(eventData).toEqual({ originalEvent: { kind: 'human' } });
  });

  it('ομάδα που ΔΕΝ χωρίζει (ταυτιζόμενα) ⇒ λίστα στην αληθινή θέση, καμία πτήση', async () => {
    const map = fakeMap([clusterHit]);
    const { ref, h, stacks } = handlers();
    bindMapPick(map.target, ref);
    map.fire(1, 1);
    map.expansion[0].resolve(15);
    map.leaves[0].resolve([leaf('a', 22.94, 40.64), leaf('b', 22.94, 40.64)]);
    await flush();
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(h.onClear).toHaveBeenCalled();
    expect(stacks.at(-1)).toEqual({ ids: ['a', 'b'], point: { lng: 22.94, lat: 40.64 } });
  });

  it('μπαγιάτικη απάντηση (δεύτερο κλικ πριν απαντήσει η πηγή) ⇒ αγνοείται', async () => {
    const map = fakeMap([clusterHit]);
    const { ref } = handlers();
    bindMapPick(map.target, ref);
    map.fire();
    map.setHits([]);
    map.fire();
    map.expansion[0].resolve(12);
    map.leaves[0].resolve([leaf('a', 22.94, 40.64), leaf('b', 22.96, 40.63)]);
    await flush();
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it('η πηγή απορρίπτει (setData ακύρωσε το cluster_id) ⇒ σιωπή, κανένα σφάλμα', async () => {
    const map = fakeMap([clusterHit]);
    const { ref, stacks } = handlers();
    bindMapPick(map.target, ref);
    map.fire();
    map.expansion[0].reject(new Error('No cluster with the specified id.'));
    map.leaves[0].resolve([]);
    await flush();
    expect(map.flyTo).not.toHaveBeenCalled();
    expect(stacks).toEqual([null]);
  });
});
