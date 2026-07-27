/**
 * ADR-649 §associative — ζωντανή ετικέτα εμβαδού: το lock του μηχανισμού.
 *
 * Κλειδώνει τα **τέσσερα** πράγματα που, αν σπάσουν, δεν κρασάρουν — απλώς το σχέδιο αρχίζει
 * να λέει ψέματα (ή η εφαρμογή παγώνει):
 *
 *   1. **Αλλάζει η πηγή ⇒ αλλάζει ο αριθμός.** Το πρόβλημα που λύνει όλη η δουλειά.
 *   2. **Ιδεμποτεντικό.** Δεύτερο πέρασμα χωρίς αλλαγή ⇒ **καμία** εγγραφή. Αυτό ΕΙΝΑΙ ο
 *      μηχανισμός που κόβει τον βρόχο του ADR-492 §4 (storm/freeze) — αν πέσει, ο κύκλος
 *      δεν συγκλίνει και η εφαρμογή κολλάει, όχι απλώς «γράφει λίγο παραπάνω».
 *   3. **Ένας μηχανισμός για ΟΛΟΥΣ τους τύπους.** Τα ίδια τεστ τρέχουν παραμετρικά για
 *      γραμμοσκίαση ΚΑΙ τοπογραφική επιφάνεια — αλλιώς φτιάξαμε topo-only δίδυμο (N.18).
 *   4. **Ορφανή αναφορά + επιστροφή.** Σβήνει η πηγή → «####»· επιστρέφει (undo) → ο
 *      πραγματικός αριθμός, από τον ΙΔΙΟ κώδικα (scene-derived, καμία διαδρομή «un-orphan»).
 */

import type { Entity, TextEntity } from '../../../types/entities';
import type { SceneEntity } from '../../../core/commands/interfaces';
import type { TopoPoint } from '../../topography/topo-types';
import { cascadeAreaLabels } from '../area-label-cascade';
import { buildAreaLabelEntity, INVALID_AREA_REFERENCE } from '../area-label';
import { clearTopo, setTopoPoints } from '../../topography/TopoPointStore';
import { invalidateTopoSurface } from '../../topography/topo-surface';
import { invalidateTopoSurveyPointIndex } from '../../topography/topo-survey-point-resolve';
import { buildTopoSurfaceEntity } from '../../topography/topo-surface-entity';
import { setGeoReference } from '../../geo-referencing/geo-reference-store';

// ─────────────────────────────────────────────────────────────────────────────
// Ελάχιστη σκηνή — καταγράφει ΚΑΘΕ γραφή, ώστε το «καμία εγγραφή» να είναι μετρήσιμο
// ─────────────────────────────────────────────────────────────────────────────

function makeScene(initial: readonly Entity[]) {
  const map = new Map<string, Entity>(initial.map((e) => [e.id, e]));
  const writes: string[] = [];
  return {
    writes,
    getEntities: (): readonly SceneEntity[] => [...map.values()] as unknown as SceneEntity[],
    getEntity: (id: string) => map.get(id) as unknown as SceneEntity | undefined,
    updateEntity: (id: string, patch: Partial<SceneEntity>) => {
      writes.push(id);
      const current = map.get(id);
      if (current) map.set(id, { ...current, ...(patch as object) } as Entity);
    },
    remove: (id: string) => map.delete(id),
    restore: (e: Entity) => map.set(e.id, e),
    label: (id: string) => map.get(id) as TextEntity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Δύο πηγές, ΙΔΙΑ σύμβαση — αν κάποιος γράψει topo-only κλάδο, η παραμετροποίηση τον πιάνει
// ─────────────────────────────────────────────────────────────────────────────

/** Γραμμοσκίαση 10m × 10m (canonical mm) — μεγαλώνει σε 20m × 10m στο «grow». */
function hatchSource(widthMm: number): Entity {
  return {
    id: 'src-hatch',
    type: 'hatch',
    layerId: 'lyr_x',
    boundaryPaths: [[
      { x: 0, y: 0 }, { x: widthMm, y: 0 }, { x: widthMm, y: 10_000 }, { x: 0, y: 10_000 },
    ]],
  } as unknown as Entity;
}

/** Τοπογραφική επιφάνεια από 4 survey points — μεγαλώνει με μεγαλύτερο πλάτος. */
function topoSource(widthMm: number): Entity {
  const points: readonly TopoPoint[] = [
    { x: 0, y: 0, z: 0 },
    { x: widthMm, y: 0, z: 0 },
    { x: widthMm, y: 10_000, z: 1000 },
    { x: 0, y: 10_000, z: 1000 },
  ];
  clearTopo();
  invalidateTopoSurface();
  invalidateTopoSurveyPointIndex();
  setTopoPoints(points, 'existing');
  const entity = buildTopoSurfaceEntity('existing', 'lyr_topo');
  if (!entity) throw new Error('fixture: η επιφάνεια δεν τριγωνοποιήθηκε');
  return entity as unknown as Entity;
}

const SOURCES = [
  ['γραμμοσκίαση', hatchSource],
  ['τοπογραφική επιφάνεια', topoSource],
] as const;

afterEach(() => {
  setGeoReference(null);
  clearTopo();
  invalidateTopoSurface();
  invalidateTopoSurveyPointIndex();
});

describe.each(SOURCES)('cascadeAreaLabels — πηγή: %s', (_label, makeSource) => {
  /** Πηγή + η ετικέτα της, έτοιμες σε σκηνή. */
  function seed(widthMm = 10_000) {
    const source = makeSource(widthMm);
    const label = buildAreaLabelEntity(source, { x: 1, y: 1 });
    if (!label) throw new Error('fixture: η πηγή δεν έδωσε μετρήσιμο εμβαδόν');
    return { source, label, scene: makeScene([source, label]) };
  }

  it('η ετικέτα γεννιέται ΜΕ τον associative σύνδεσμο', () => {
    const { source, label } = seed();
    expect(label.areaSourceId).toBe(source.id);
  });

  it('μεγαλώνει η πηγή ⇒ η ετικέτα δείχνει ΝΕΟ αριθμό', () => {
    const { source, label, scene } = seed();
    const before = scene.label(label.id).text;

    scene.restore(makeSource(20_000)); // ίδιο id, διπλάσιο εμβαδόν
    const changed = cascadeAreaLabels([source.id], scene);

    expect(changed).toHaveLength(1);
    expect(scene.label(label.id).text).not.toBe(before);
  });

  it('ΙΔΕΜΠΟΤΕΝΤΙΚΟ: δεύτερο πέρασμα χωρίς αλλαγή ⇒ ΚΑΜΙΑ εγγραφή (ADR-492 §4 zero-loop)', () => {
    const { source, label, scene } = seed();
    scene.restore(makeSource(20_000));

    expect(cascadeAreaLabels([source.id], scene)).toHaveLength(1);
    const writesAfterFirst = scene.writes.length;

    // Δεύτερο (και τρίτο) πέρασμα πάνω στην ΙΔΙΑ σκηνή: τίποτα δεν άλλαξε.
    expect(cascadeAreaLabels([source.id], scene)).toHaveLength(0);
    expect(cascadeAreaLabels([source.id], scene)).toHaveLength(0);
    expect(scene.writes).toHaveLength(writesAfterFirst);
    void label;
  });

  it('αμετάβλητη πηγή ⇒ καμία εγγραφή ήδη από το ΠΡΩΤΟ πέρασμα', () => {
    const { source, scene } = seed();
    expect(cascadeAreaLabels([source.id], scene)).toHaveLength(0);
    expect(scene.writes).toHaveLength(0);
  });

  it('πύλη κόστους: άσχετο changedId ⇒ η ετικέτα δεν ξανα-υπολογίζεται καν', () => {
    const { label, scene } = seed();
    scene.restore(makeSource(20_000)); // η πηγή ΟΝΤΩΣ άλλαξε…
    // …αλλά η εντολή δεν την ανέφερε → ο cascade δεν πρέπει να αγγίξει τίποτα.
    expect(cascadeAreaLabels(['κάποιο-άλλο-id'], scene)).toHaveLength(0);
    expect(scene.writes).toHaveLength(0);
    void label;
  });

  it('σβήνει η πηγή ⇒ «####»· επιστρέφει ⇒ ο πραγματικός αριθμός (ίδιος κώδικας)', () => {
    const { source, label, scene } = seed();
    const original = scene.label(label.id).text;

    scene.remove(source.id);
    expect(cascadeAreaLabels([source.id], scene)).toHaveLength(1);
    const orphaned = scene.label(label.id).text;
    expect(orphaned).toContain(INVALID_AREA_REFERENCE);
    // Το ΠΡΟΘΕΜΑ επιβιώνει: «Εμβαδόν: ####» λέει και τι έλειπε και ότι λείπει.
    expect(orphaned.split('\n')).toHaveLength(original.split('\n').length);
    expect(orphaned).not.toBe(original);

    // Ιδεμποτεντικό ΚΑΙ στην ορφανή κατάσταση — αλλιώς κάθε πέρασμα θα ξανάγραφε «####».
    expect(cascadeAreaLabels([source.id], scene)).toHaveLength(0);

    // Undo της διαγραφής: καμία ξεχωριστή διαδρομή «un-orphan» — ο ίδιος reconciler.
    scene.restore(source);
    expect(cascadeAreaLabels([source.id], scene)).toHaveLength(1);
    expect(scene.label(label.id).text).toBe(original);
  });

  it('η ΘΕΣΗ της ετικέτας δεν αγγίζεται ποτέ (ο χρήστης την έχει τοποθετήσει)', () => {
    const { source, label, scene } = seed();
    const position = { ...label.position };
    scene.restore(makeSource(20_000));
    cascadeAreaLabels([source.id], scene);
    expect(scene.label(label.id).position).toEqual(position);
  });

  it('το ΜΕΓΕΘΟΣ κειμένου διατηρείται (annotation style, όχι παράγωγο) — καμία αναπήδηση', () => {
    const { source, label, scene } = seed();
    const height = label.textNode?.paragraphs[0].runs[0].style.height;
    expect(height).toBeGreaterThan(0);

    scene.restore(makeSource(20_000));
    cascadeAreaLabels([source.id], scene);
    expect(scene.label(label.id).textNode?.paragraphs[0].runs[0].style.height).toBe(height);
  });
});

describe('cascadeAreaLabels — φρουρές', () => {
  it('σκέτο κείμενο ΧΩΡΙΣ σύνδεσμο μένει άθικτο (παλιές ετικέτες = στιγμιότυπα)', () => {
    const plain = {
      id: 'plain-text', type: 'text', layerId: 'lyr_x',
      position: { x: 0, y: 0 }, text: 'Εμβαδόν: 999,00 m²',
    } as unknown as Entity;
    const scene = makeScene([hatchSource(10_000), plain]);
    expect(cascadeAreaLabels(['src-hatch'], scene)).toHaveLength(0);
    expect(scene.writes).toHaveLength(0);
  });

  it('κενό changedIds ⇒ καμία σάρωση σκηνής', () => {
    const scene = makeScene([hatchSource(10_000)]);
    expect(cascadeAreaLabels([], scene)).toHaveLength(0);
  });

  it('scene manager χωρίς getEntities ⇒ ασφαλές no-op, όχι κρασάρισμα', () => {
    const minimal = {
      getEntity: () => undefined,
      updateEntity: () => undefined,
    };
    expect(cascadeAreaLabels(['x'], minimal)).toHaveLength(0);
  });
});
