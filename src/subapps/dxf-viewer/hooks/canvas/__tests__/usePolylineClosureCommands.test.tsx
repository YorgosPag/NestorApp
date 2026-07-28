/**
 * ADR-718 §Β — τι δείχνει το μενού δεξιού κλικ της **οντότητας** για μια πολυγραμμή.
 *
 * Ελέγχει τη **μία γραμμή** του AutoCAD `PEDIT`: *Κλείσιμο* σε ανοιχτή, *Άνοιγμα* σε κλειστή,
 * **τίποτα** σε οτιδήποτε άλλο — και ότι το πάτημα φτάνει πράγματι σε εκτελεσμένη εντολή.
 *
 * ⚠️ Το «τίποτα σε πολλαπλή επιλογή» δεν είναι λεπτομέρεια: το `PEDIT` είναι εντολή **μίας**
 * οντότητας. Ένα «κλείσε τα όλα» θα ήταν άλλη εντολή με άλλο undo — και κανείς δεν τη ζήτησε.
 *
 * @see ../usePolylineClosureCommands
 * @see ../../../systems/polyline/polyline-closure-ops — τα κατηγορήματα (δικό τους αρχείο)
 */

import { renderHook } from '@testing-library/react';
import { usePolylineClosureCommands } from '../usePolylineClosureCommands';
import type { Entity } from '../../../types/entities';
import type { ICommand } from '../../../core/commands/interfaces';
import type { SceneModel } from '../../../types/scene';

const ID = 'ent-poly';
const SQUARE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

function entity(over: Partial<{ type: string; closed: boolean }> = {}): Entity {
  return {
    id: ID,
    type: over.type ?? 'polyline',
    layerId: 'lyr',
    vertices: SQUARE.map((v) => ({ ...v })),
    closed: over.closed ?? false,
  } as unknown as Entity;
}

/** Ο ελάχιστος γράφων σκηνής ορόφου — ό,τι χρειάζεται ο adapter της εντολής. */
function levelManager(entities: readonly Entity[]) {
  const scene = { entities: [...entities] } as unknown as SceneModel;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: () => scene,
    setLevelScene: (_id: string, next: SceneModel) => { scene.entities = next.entities; },
  };
}

function render(entities: readonly Entity[], selected: readonly string[]) {
  const executed: ICommand[] = [];
  const lm = levelManager(entities);
  const { result } = renderHook(() =>
    usePolylineClosureCommands(selected, entities, lm, (cmd) => { executed.push(cmd); cmd.execute(); }),
  );
  return { result, executed, lm };
}

describe('usePolylineClosureCommands — η μία γραμμή του μενού', () => {
  it('ανοιχτή πολυγραμμή ⇒ «Κλείσιμο»', () => {
    const { result } = render([entity({ closed: false })], [ID]);

    expect(result.current.polylineClosure?.action).toBe('close');
  });

  it('κλειστή πολυγραμμή ⇒ «Άνοιγμα»', () => {
    const { result } = render([entity({ closed: true })], [ID]);

    expect(result.current.polylineClosure?.action).toBe('open');
  });

  it.each([
    ['καμία επιλογή', [] as string[]],
    ['δύο επιλεγμένες (το PEDIT είναι εντολή ΜΙΑΣ οντότητας)', [ID, 'ent-other']],
  ])('%s ⇒ καμία γραμμή', (_label, selected) => {
    const { result } = render([entity({ closed: true })], selected);

    expect(result.current.polylineClosure).toBeUndefined();
  });

  it('άλλος τύπος οντότητας ⇒ καμία γραμμή', () => {
    const { result } = render([entity({ type: 'line', closed: true })], [ID]);

    expect(result.current.polylineClosure).toBeUndefined();
  });

  it('το πάτημα εκτελεί την εντολή και η πολυγραμμή ΚΛΕΙΝΕΙ στ΄ αλήθεια', () => {
    const { result, executed, lm } = render([entity({ closed: false })], [ID]);

    result.current.polylineClosure!.run();

    expect(executed).toHaveLength(1);
    const after = lm.getLevelScene().entities.find((e) => e.id === ID) as unknown as { closed?: boolean };
    expect(after.closed).toBe(true);
  });
});
