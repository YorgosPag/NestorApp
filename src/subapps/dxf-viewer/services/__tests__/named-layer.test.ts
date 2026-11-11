/**
 * ADR-929 Δ20 Σ1.2 — η πόρτα «βρες ή φτιάξε layer» + η αναιρέσιμη εντολή της.
 *
 * Τι κλειδώνει:
 *   - νέο layer γράφεται στο ΕΓΓΡΑΦΟ (scene.layersById) και στην προβολή (LayerStore)·
 *   - υπάρχον (χωρίς διάκριση πεζών) ⇒ ίδιο id, καμία εγγραφή, κανένα βήμα ιστορικού·
 *   - undo αφαιρεί ΜΟΝΟ ό,τι πρόσθεσε· redo ξαναβάζει το ΙΔΙΟ id·
 *   - μέσα σε runAsSingleUndo: layer + οντότητες = ΕΝΑ βήμα, Ctrl+Z τα παίρνει όλα·
 *   - άκυρο όνομα / χωρίς σκηνή ⇒ ok:false, καμία εγγραφή·
 *   - DimStyle.targetLayer ≡ DIMLAYER (κενό ή "." ⇒ τρέχον layer).
 *   - Σ1.3β: planDimensionLayer = η ΑΝΑΓΝΩΣΗ του ensureDimensionLayer — ίδια απάντηση, μηδέν εγγραφές.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import type { SceneModel } from '../../types/scene';
import { createSceneLayer } from '../../types/entities';
import { CommandHistory } from '../../core/commands/CommandHistory';
import type { ICommand } from '../../core/commands/interfaces';
import { getLayer, __resetLayerStoreForTesting } from '../../stores/LayerStore';
import {
  ensureDimensionLayer,
  ensureNamedLayer,
  planDimensionLayer,
  resolveDimensionLayerSpec,
  type NamedLayerAccessor,
} from '../named-layer';

const LEVEL = 'lvl_1';

function makeAccessor(initial: SceneModel | null): NamedLayerAccessor & { scene: () => SceneModel | null; writes: () => number } {
  let scene = initial;
  let writes = 0;
  return {
    currentLevelId: LEVEL,
    getLevelScene: (id) => (id === LEVEL ? scene : null),
    setLevelScene: (id, next) => {
      if (id === LEVEL) {
        scene = next;
        writes += 1;
      }
    },
    scene: () => scene,
    writes: () => writes,
  };
}

function baseScene(): SceneModel {
  const zero = createSceneLayer({ id: 'lyr_0', name: '0' });
  return {
    entities: [],
    layersById: { [zero.id]: zero },
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  };
}

/** Εντολή-ανιχνευτής που «προσθέτει οντότητα» — για το σενάριο της μίας αναίρεσης. */
function markerCommand(log: string[]): ICommand {
  const command: ICommand = {
    id: 'marker', name: 'Marker', type: 'marker', timestamp: 0,
    execute: () => log.push('entity+'),
    undo: () => log.push('entity-'),
    redo: () => log.push('entity+'),
    getDescription: () => 'marker',
    getAffectedEntityIds: () => [],
    validate: () => null,
    serialize: () => ({ type: 'marker', id: 'marker', name: 'Marker', timestamp: 0, data: {}, version: 1 }),
  };
  return command;
}

beforeEach(() => {
  __resetLayerStoreForTesting();
});

describe('ensureNamedLayer — νέο layer', () => {
  it('γράφει στο έγγραφο ΚΑΙ στην προβολή, ένα βήμα ιστορικού', () => {
    const acc = makeAccessor(baseScene());
    const history = new CommandHistory();
    const r = ensureNamedLayer(acc, { name: 'ΔΙΑΣΤΑΣΕΙΣ' }, history);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.created).toBe(true);
    expect(acc.scene()?.layersById[r.layerId]?.name).toBe('ΔΙΑΣΤΑΣΕΙΣ');
    expect(acc.scene()?.layersById[r.layerId]?.source).toBe('system-default');
    expect(getLayer(r.layerId)?.name).toBe('ΔΙΑΣΤΑΣΕΙΣ');
    expect(history.size()).toBe(1);
  });

  it('undo αφαιρεί από έγγραφο + προβολή· redo ξαναβάζει το ΙΔΙΟ id', () => {
    const acc = makeAccessor(baseScene());
    const history = new CommandHistory();
    const r = ensureNamedLayer(acc, { name: 'A-ANNO-DIMS' }, history);
    if (!r.ok) throw new Error('expected ok');
    history.undo();
    expect(acc.scene()?.layersById[r.layerId]).toBeUndefined();
    expect(acc.scene()?.layersById.lyr_0).toBeDefined();
    expect(getLayer(r.layerId)).toBeNull();
    history.redo();
    expect(acc.scene()?.layersById[r.layerId]?.name).toBe('A-ANNO-DIMS');
    expect(getLayer(r.layerId)?.name).toBe('A-ANNO-DIMS');
  });
});

describe('ensureNamedLayer — ιδεμποτία', () => {
  it('υπάρχον layer (άλλα πεζά/κεφαλαία) ⇒ ίδιο id, καμία εγγραφή, κανένα βήμα', () => {
    const scene = baseScene();
    const dims = createSceneLayer({ id: 'lyr_dims', name: 'Dimensions' });
    scene.layersById[dims.id] = dims;
    const acc = makeAccessor(scene);
    const history = new CommandHistory();
    const r = ensureNamedLayer(acc, { name: 'DIMENSIONS' }, history);
    expect(r).toEqual({ ok: true, layerId: 'lyr_dims', created: false });
    expect(acc.writes()).toBe(0);
    expect(history.size()).toBe(0);
  });

  it('δεύτερη κλήση μετά από δημιουργία ⇒ ίδιο id, ένα μόνο layer', () => {
    const acc = makeAccessor(baseScene());
    const history = new CommandHistory();
    const a = ensureNamedLayer(acc, { name: 'ΔΙΑΣΤΑΣΕΙΣ' }, history);
    const b = ensureNamedLayer(acc, { name: 'ΔΙΑΣΤΑΣΕΙΣ' }, history);
    if (!a.ok || !b.ok) throw new Error('expected ok');
    expect(b.layerId).toBe(a.layerId);
    expect(b.created).toBe(false);
    expect(Object.keys(acc.scene()?.layersById ?? {})).toHaveLength(2);
    expect(history.size()).toBe(1);
  });
});

describe('ensureNamedLayer — μία αναίρεση με τις οντότητες (ADR-729)', () => {
  it('runAsSingleUndo: layer + οντότητες = ένα βήμα· undo με αντίστροφη σειρά', () => {
    const acc = makeAccessor(baseScene());
    const history = new CommandHistory();
    const log: string[] = [];
    let layerId = '';
    history.runAsSingleUndo('approve', () => {
      const r = ensureNamedLayer(acc, { name: 'ΔΙΑΣΤΑΣΕΙΣ' }, history);
      if (r.ok) layerId = r.layerId;
      history.execute(markerCommand(log));
    });
    expect(history.size()).toBe(1);
    expect(acc.scene()?.layersById[layerId]).toBeDefined();
    history.undo();
    expect(log).toEqual(['entity+', 'entity-']);
    expect(acc.scene()?.layersById[layerId]).toBeUndefined();
  });
});

describe('ensureNamedLayer — fail-closed', () => {
  it('άκυρο όνομα ⇒ ok:false με λόγο, καμία εγγραφή', () => {
    const acc = makeAccessor(baseScene());
    const history = new CommandHistory();
    const r = ensureNamedLayer(acc, { name: ' DIMS ' }, history);
    expect(r).toEqual({ ok: false, reason: 'LEADING_TRAILING_WS' });
    expect(acc.writes()).toBe(0);
    expect(history.size()).toBe(0);
  });

  it('χωρίς σκηνή ⇒ ok:false «no-scene»', () => {
    const acc = makeAccessor(null);
    expect(ensureNamedLayer(acc, { name: 'X' }, new CommandHistory())).toEqual({ ok: false, reason: 'no-scene' });
  });
});

describe('resolveDimensionLayerSpec — DimStyle.targetLayer ≡ DIMLAYER', () => {
  it('όνομα ⇒ spec με αυτό το όνομα', () => {
    expect(resolveDimensionLayerSpec({ targetLayer: 'A-ANNO-DIMS' })).toEqual({ name: 'A-ANNO-DIMS' });
  });

  it('κενό ή "." ⇒ null (τρέχον layer)', () => {
    expect(resolveDimensionLayerSpec({ targetLayer: '' })).toBeNull();
    expect(resolveDimensionLayerSpec({ targetLayer: '.' })).toBeNull();
    expect(resolveDimensionLayerSpec({ targetLayer: '  ' })).toBeNull();
  });
});

describe('planDimensionLayer — η προεπισκόπηση του ensureDimensionLayer (Σ1.3β)', () => {
  it('υπάρχον layer (άλλα πεζά/κεφαλαία) ⇒ «existing» με το όνομα του εγγράφου, καμία εγγραφή', () => {
    const scene = baseScene();
    const dims = createSceneLayer({ id: 'lyr_dims', name: 'A-ANNO-DIMS' });
    const withDims = { ...scene, layersById: { ...scene.layersById, [dims.id]: dims } };
    expect(planDimensionLayer(withDims, { targetLayer: 'a-anno-dims' })).toEqual({ kind: 'existing', name: 'A-ANNO-DIMS' });
  });

  it('νέο όνομα ⇒ «create»· και η εγγραφή πράγματι το δημιουργεί (ίδια απάντηση)', () => {
    const acc = makeAccessor(baseScene());
    const style = { targetLayer: 'A-ANNO-DIMS' };
    expect(planDimensionLayer(acc.scene(), style)).toEqual({ kind: 'create', name: 'A-ANNO-DIMS' });
    expect(acc.writes()).toBe(0);
    expect(ensureDimensionLayer(acc, style, new CommandHistory())).toMatchObject({ ok: true, created: true });
  });

  it('🔴 άκυρο όνομα ⇒ «refused» με τον ΙΔΙΟ λόγο που θα έδινε η εγγραφή', () => {
    const acc = makeAccessor(baseScene());
    const style = { targetLayer: 'DIM<BAD' };
    const planned = planDimensionLayer(acc.scene(), style);
    expect(planned).toEqual({ kind: 'refused', reason: 'INVALID_CHARS' });
    expect(ensureDimensionLayer(acc, style, new CommandHistory())).toEqual({ ok: false, reason: 'INVALID_CHARS' });
  });

  it('χωρίς σκηνή ⇒ «refused no-scene»', () => {
    expect(planDimensionLayer(null, { targetLayer: 'X' })).toEqual({ kind: 'refused', reason: 'no-scene' });
  });

  it('"." χωρίς τρέχον/προεπιλεγμένο layer ⇒ «refused no-layer», όπως η εγγραφή', () => {
    const acc = makeAccessor(baseScene());
    expect(planDimensionLayer(acc.scene(), { targetLayer: '.' })).toEqual({ kind: 'refused', reason: 'no-layer' });
    expect(ensureDimensionLayer(acc, { targetLayer: '.' }, new CommandHistory())).toEqual({ ok: false, reason: 'no-layer' });
  });
});
