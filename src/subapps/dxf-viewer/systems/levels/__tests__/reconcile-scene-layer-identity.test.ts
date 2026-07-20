/**
 * ADR-635 Φ C.17 — `reconcileSceneLayerIdentity` (layer identity στο σύνορο εισαγωγής).
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ: κάθε import έκοβε ΝΕΑ τυχαία layer ids ενώ τα per-entity persisted
 * entities κρατούν στο Firestore το ΠΑΛΙΟ layerId → 117 ορφανές γραμμοσκιάσεις
 * (μετρημένο 2026-07-20: άθροισμα per-layer 2178 vs scene 2295). Το κορυφαίο test
 * («an existing hatch doc's layerId still resolves after re-import») αποτυγχάνει αν
 * εξουδετερωθεί το fix — δεν είναι διακοσμητικό.
 */

import { reconcileSceneLayerIdentity } from '../reconcile-scene-layer-identity';
import { createSceneLayer } from '../../../types/scene-types';
import type { Entity, SceneLayer, SceneModel } from '../../../types/entities';
import { getEntitiesByLayer } from '../../../services/shared/layer-operation-utils';
// Το `getEntitiesByLayer` resolve-άρει μέσω του LayerStore **singleton** — ακριβώς όπως
// στην παραγωγή, όπου το `useDxfSceneConversion` τον υδατώνει από το `scene.layersById`.
// Τον γεμίζουμε ρητά ώστε το test να ελέγχει ΟΛΗ την αλυσίδα που παρήγαγε το 2178 vs 2295.
import { setLayers as hydrateLayerStore } from '../../../stores/LayerStore';
import { EMPTY_BOUNDS } from '../../../config/geometry-constants';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function layer(input: { id: string; name: string; sourceName?: string } & Partial<SceneLayer>): SceneLayer {
  return createSceneLayer({ ...input, source: 'dxf-import' });
}

function scene(layers: SceneLayer[], entities: Entity[] = []): SceneModel {
  const layersById: Record<string, SceneLayer> = {};
  for (const l of layers) layersById[l.id] = l;
  return { entities, layersById, bounds: { ...EMPTY_BOUNDS }, units: 'mm' };
}

/** Ένα hatch όπως ακριβώς το γυρίζει το `hatchDocToEntity` — layerId ωμό από το Firestore. */
function hatch(id: string, layerId: string): Entity {
  return { id, type: 'hatch', layerId, visible: true, boundaryPaths: [] } as unknown as Entity;
}

function line(id: string, layerId: string): Entity {
  return {
    id, type: 'line', layerId,
    start: { x: 0, y: 0 }, end: { x: 1, y: 1 },
  } as unknown as Entity;
}

function layersOf(s: SceneModel): SceneLayer[] {
  return Object.values(s.layersById);
}

// ─── Ο πυρήνας ───────────────────────────────────────────────────────────────

describe('reconcileSceneLayerIdentity — reconcile-by-name', () => {
  it('reuses the existing layer id when the incoming layer has the same name', () => {
    const existing = scene([layer({ id: 'lyr_A', name: 'ΤΟΙΧΟΙ' })]);
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })], [line('l1', 'lyr_B')]);

    const { scene: out, reusedLayerIds } = reconcileSceneLayerIdentity(incoming, existing.layersById);

    expect(reusedLayerIds).toBe(1);
    expect(out.layersById['lyr_A']).toBeDefined();
    expect(out.layersById['lyr_B']).toBeUndefined();
    expect((out.entities[0] as { layerId: string }).layerId).toBe('lyr_A');
  });

  // ⭐ DISCRIMINATING — αυτό ΑΚΡΙΒΩΣ έσπαγε στην παραγωγή.
  it("an existing hatch doc's layerId still resolves after re-import", () => {
    const existing = scene([layer({ id: 'lyr_A', name: 'ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ' })]);
    // Το re-import κόβει νέο id για το ΙΔΙΟ όνομα· το hatch έρχεται από το Firestore
    // κρατώντας το ΠΑΛΙΟ id (όπως το επιστρέφει το `hatchDocToEntity`).
    const incoming = scene(
      [layer({ id: 'lyr_B', name: 'ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ' })],
      [hatch('h1', 'lyr_A')],
    );

    const { scene: out } = reconcileSceneLayerIdentity(incoming, existing.layersById);
    hydrateLayerStore(layersOf(out)); // ό,τι κάνει το useDxfSceneConversion στο [currentScene]

    // Το layer του hatch υπάρχει ΚΑΙ το hatch είναι προσβάσιμο ανά layer (ορατότητα/
    // πάγωμα/isolate/χρώμα). Χωρίς το fix, το `lyr_A` δεν υπάρχει στο layersById →
    // `resolveEntityLayerName` γυρίζει undefined → 0 entities: ακριβώς τα 117 ορφανά.
    expect(out.layersById['lyr_A']).toBeDefined();
    expect(getEntitiesByLayer(out.entities, 'ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ')).toHaveLength(1);
  });

  it('matches layer names case-insensitively (AutoCAD parity)', () => {
    const existing = scene([layer({ id: 'lyr_A', name: 'Walls' })]);
    const incoming = scene([layer({ id: 'lyr_B', name: 'WALLS' })]);

    const { scene: out, reusedLayerIds } = reconcileSceneLayerIdentity(incoming, existing.layersById);

    expect(reusedLayerIds).toBe(1);
    expect(out.layersById['lyr_A']).toBeDefined();
    // Το ΟΝΟΜΑ που βλέπει ο χρήστης μένει σταθερό (ArchiCAD Append).
    expect(out.layersById['lyr_A'].name).toBe('Walls');
  });

  it('always reconciles the DXF default layer "0"', () => {
    // Το «0» είναι το σημαντικότερο match: κάθε νέο BIM entity καρφώνεται στο id του.
    const existing = scene([layer({ id: 'lyr_zero', name: '0' })]);
    const incoming = scene([layer({ id: 'lyr_new', name: '0' })], [line('l1', 'lyr_new')]);

    const { scene: out } = reconcileSceneLayerIdentity(incoming, existing.layersById);

    expect(out.layersById['lyr_zero']).toBeDefined();
    expect((out.entities[0] as { layerId: string }).layerId).toBe('lyr_zero');
  });
});

// ─── §Ε — ποιος κερδίζει τι ──────────────────────────────────────────────────

describe('reconcileSceneLayerIdentity — merge policy', () => {
  it('existing wins for user state; incoming wins for appearance', () => {
    const existing = scene([layer({
      id: 'lyr_A', name: 'ΤΟΙΧΟΙ',
      visible: false, frozen: true, locked: true, transparency: 40, plottable: false,
      color: '#ff0000', colorAci: 1, linetype: 'DASHED', lineweight: 0.5,
    })]);
    const incoming = scene([layer({
      id: 'lyr_B', name: 'ΤΟΙΧΟΙ',
      visible: true, frozen: false, locked: false, transparency: 0, plottable: true,
      color: '#0000ff', colorAci: 5, linetype: 'Continuous', lineweight: 0.25,
    })]);

    const merged = reconcileSceneLayerIdentity(incoming, existing.layersById).scene.layersById['lyr_A'];

    // Κατάσταση χρήστη — ο λόγος ύπαρξης του σταθερού id.
    expect(merged.visible).toBe(false);
    expect(merged.frozen).toBe(true);
    expect(merged.locked).toBe(true);
    expect(merged.transparency).toBe(40);
    expect(merged.plottable).toBe(false);
    // Εμφάνιση από το αρχείο — αλλιώς το swatch λέει κόκκινο ενώ η γεωμετρία είναι μπλε
    // (ο builder ψήνει το BYLAYER χρώμα μέσα στο entity).
    expect(merged.color).toBe('#0000ff');
    expect(merged.colorAci).toBe(5);
    expect(merged.linetype).toBe('Continuous');
    expect(merged.lineweight).toBe(0.25);
  });
});

// ─── §Β/§Γ/§Ζ — τα δίχτυα ────────────────────────────────────────────────────

describe('reconcileSceneLayerIdentity — safety invariants', () => {
  it('never collapses two incoming layers onto one existing id', () => {
    // Ένα κακοσχηματισμένο DXF μπορεί να παράγει «Walls» ΚΑΙ «WALLS» (ο registerLayer
    // κάνει case-sensitive keying). Αν και τα δύο έπαιρναν το ίδιο existing id, το ένα
    // θα ΕΣΒΗΝΕ σιωπηλά το άλλο από το `layersById`.
    const existing = scene([layer({ id: 'lyr_A', name: 'Walls' })]);
    const incoming = scene([
      layer({ id: 'lyr_B', name: 'Walls' }),
      layer({ id: 'lyr_C', name: 'WALLS' }),
    ]);

    const { scene: out, nameCollisions } = reconcileSceneLayerIdentity(incoming, existing.layersById);

    expect(Object.keys(out.layersById)).toHaveLength(2);
    expect(nameCollisions).toEqual(['WALLS']);
  });

  it('carries over existing layers absent from the incoming file', () => {
    // Ένας τοίχος που ζωγράφισε ο χρήστης ζει σε layer που το νέο DXF δεν έχει. Χωρίς
    // carry-over, το layer εξαφανίζεται και ο τοίχος (που επιστρέφει από το
    // `mergeDocsIntoScene`) ορφανιάζει εκ νέου — το ίδιο bug από άλλη πόρτα.
    const existing = scene([
      layer({ id: 'lyr_A', name: 'ΤΟΙΧΟΙ' }),
      layer({ id: 'lyr_user', name: 'ΔΙΚΑ ΜΟΥ' }),
    ]);
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })]);

    const { scene: out, carriedOverLayers } = reconcileSceneLayerIdentity(incoming, existing.layersById);

    expect(carriedOverLayers).toBe(1);
    expect(out.layersById['lyr_user']).toBeDefined();
  });

  it('leaves entities whose layerId is in no layer table untouched', () => {
    // ΜΗΝ τα ρίξεις στο «0»: θα έκρυβε σιωπηλά το ανοιχτό ADR-670 (BIM entities με
    // layerId = levelId) και θα έσπαγε το `deriveLayersByIdFromEntities` net.
    const existing = scene([layer({ id: 'lyr_A', name: 'ΤΟΙΧΟΙ' })]);
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })], [line('l1', 'lvl_orphan')]);

    const { scene: out } = reconcileSceneLayerIdentity(incoming, existing.layersById);

    expect((out.entities[0] as { layerId: string }).layerId).toBe('lvl_orphan');
  });

  it('returns the same reference when there are no existing layers', () => {
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })]);

    expect(reconcileSceneLayerIdentity(incoming, {}).scene).toBe(incoming);
    expect(reconcileSceneLayerIdentity(incoming, null).scene).toBe(incoming);
    expect(reconcileSceneLayerIdentity(incoming, undefined).scene).toBe(incoming);
  });
});

// ─── §Α — nested containers ──────────────────────────────────────────────────

describe('reconcileSceneLayerIdentity — nested containers', () => {
  const existing = scene([layer({ id: 'lyr_A', name: 'ΤΟΙΧΟΙ' })]);

  it('remaps block members recursively (nested blocks)', () => {
    const inner = {
      id: 'blk_inner', type: 'block', layerId: 'lyr_B',
      position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0,
      entities: [line('deep', 'lyr_B')],
    } as unknown as Entity;
    const outer = {
      id: 'blk_outer', type: 'block', layerId: 'lyr_B',
      position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0,
      entities: [inner],
    } as unknown as Entity;
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })], [outer]);

    const out = reconcileSceneLayerIdentity(incoming, existing.layersById).scene;
    const block = out.entities[0] as unknown as { layerId: string; entities: Array<{ layerId: string; entities: Array<{ layerId: string }> }> };

    expect(block.layerId).toBe('lyr_A');
    expect(block.entities[0].layerId).toBe('lyr_A');
    expect(block.entities[0].entities[0].layerId).toBe('lyr_A');
  });

  it('remaps ArrayEntity.hiddenSources and GroupEntity.members', () => {
    const arr = {
      id: 'arr1', type: 'array', layerId: 'lyr_B',
      hiddenSources: [line('src', 'lyr_B')], params: {}, kind: 'rect',
    } as unknown as Entity;
    const grp = {
      id: 'grp1', type: 'group', layerId: 'lyr_B',
      members: [line('mem', 'lyr_B')],
    } as unknown as Entity;
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })], [arr, grp]);

    const out = reconcileSceneLayerIdentity(incoming, existing.layersById).scene;

    expect((out.entities[0] as unknown as { hiddenSources: Array<{ layerId: string }> }).hiddenSources[0].layerId).toBe('lyr_A');
    expect((out.entities[1] as unknown as { members: Array<{ layerId: string }> }).members[0].layerId).toBe('lyr_A');
  });
});

// ─── §Θ — purity ─────────────────────────────────────────────────────────────

describe('reconcileSceneLayerIdentity — purity & structural sharing', () => {
  const existing = scene([layer({ id: 'lyr_A', name: 'ΤΟΙΧΟΙ' })]);

  it('does not mutate the incoming scene', () => {
    const l = line('l1', 'lyr_B');
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })], [l]);
    Object.freeze(incoming);
    Object.freeze(incoming.entities);
    Object.freeze(l);

    expect(() => reconcileSceneLayerIdentity(incoming, existing.layersById)).not.toThrow();
    expect((l as unknown as { layerId: string }).layerId).toBe('lyr_B');
  });

  it('keeps unchanged entities reference-equal (WeakMap cache health)', () => {
    // Το entity ζει σε layer που ΔΕΝ remap-άρεται → πρέπει να γυρίσει ΙΔΙΟ reference.
    const untouched = line('l1', 'lyr_other');
    const incoming = scene([
      layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' }),
      layer({ id: 'lyr_other', name: 'ΑΛΛΟ' }),
    ], [untouched]);

    const out = reconcileSceneLayerIdentity(incoming, existing.layersById).scene;

    expect(out.entities[0]).toBe(untouched);
  });

  it('is idempotent', () => {
    const incoming = scene([layer({ id: 'lyr_B', name: 'ΤΟΙΧΟΙ' })], [line('l1', 'lyr_B')]);

    const first = reconcileSceneLayerIdentity(incoming, existing.layersById).scene;
    const second = reconcileSceneLayerIdentity(first, existing.layersById);

    expect(second.scene).toBe(first);
    expect(second.remappedEntities).toBe(0);
  });
});

// ─── Βήμα 4 — sourceName ─────────────────────────────────────────────────────

describe('reconcileSceneLayerIdentity — sourceName (rename-then-reimport)', () => {
  it('reconciles by sourceName after the user renamed the layer', () => {
    // Ο χρήστης μετονόμασε «WALLS» → «Τοίχοι» (renameLayer: id σταθερό, name αλλάζει).
    // Χωρίς το sourceName το re-import του ΙΔΙΟΥ αρχείου δεν θα έβρισκε match → ξανά ορφανά.
    const existing = scene([layer({ id: 'lyr_A', name: 'Τοίχοι', sourceName: 'WALLS' })]);
    const incoming = scene([layer({ id: 'lyr_B', name: 'WALLS', sourceName: 'WALLS' })], [hatch('h1', 'lyr_A')]);

    const { scene: out, reusedLayerIds } = reconcileSceneLayerIdentity(incoming, existing.layersById);

    expect(reusedLayerIds).toBe(1);
    expect(out.layersById['lyr_A']).toBeDefined();
    // Το όνομα που διάλεξε ο χρήστης δεν χάνεται στο re-import.
    expect(out.layersById['lyr_A'].name).toBe('Τοίχοι');
  });
});
