/**
 * ADR-911 Φ4-3α — κενά ομοαξονικής διαδρομής χωρίς σύμβολο (Δ6) και οι αποφάσεις του ανθρώπου.
 *
 * Δύο ερωτήσεις, καθεμία με τον δικό της κριτή:
 *   · ΤΙ είναι κενό χωρίς σύμβολο — κριτής η πρόταση, πάνω στο σχέδιο δοκιμής και σε συνθετικά.
 *   · ΤΙ γράφεται όταν ο άνθρωπος αποφασίσει — κριτής ο ΠΡΑΓΜΑΤΙΚΟΣ γραφέας (`addOpeningsToScene`)
 *     και η σκηνή που αφήνει, όχι το πεδίο `status` της ίδιας της πρότασης.
 */

import type { Entity } from '../../../types/entities';
import { isOpeningEntity, isWallEntity } from '../../../types/entities';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { addOpeningsToScene } from '../add-openings-to-scene';
import type { OpeningDecision, OpeningProposal } from '../opening-proposal';
import { isDecidableOpening } from '../opening-proposal';
import {
  ENTITIES, NO_TRIMS, OPENING, colorOf, liveScene, propose, rebuilt, sceneOf, writtenWalls,
} from './opening-fixture';

const history = getGlobalCommandHistory();
const UNDO = { undoName: 'test' } as const;
const gapsOf = (p: OpeningProposal) => p.items.filter((i) => i.symbol === 'none');
const decide = (key: string, decision: OpeningDecision) => new Map([[key, decision]]);

const template = writtenWalls(true)[0];
const wallAt = (x1: number, y1: number, x2: number, y2: number, thickness = 200): Entity =>
  rebuilt(template, {
    ...template.params, ...NO_TRIMS, thickness,
    start: { ...template.params.start, x: x1, y: y1 }, end: { ...template.params.end, x: x2, y: y2 },
  }) as unknown as Entity;
/** Δύο ομοαξονικοί τοίχοι πάνω στον άξονα x, με κενό `gap` mm που αρχίζει στο x = 101000. */
const pair = (gap: number, thicknessB = 200): Entity[] =>
  [wallAt(100000, 0, 101000, 0), wallAt(101000 + gap, 0, 104000 + gap, 0, thicknessB)];
const line = (id: string, color: string, x1: number, y1: number, x2: number, y2: number): Entity =>
  ({ id, type: 'line', color, start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as Entity;
const column = (x1: number, x2: number): Entity => ({
  id: 'col', type: 'column',
  geometry: { footprint: { vertices: [{ x: x1, y: -100 }, { x: x2, y: -100 }, { x: x2, y: 100 }, { x: x1, y: 100 }] } },
}) as unknown as Entity;

/** Γράφει την πρόταση με τον πραγματικό γραφέα και επιστρέφει τη σκηνή που άφησε. */
function written(scene: readonly Entity[], proposal: OpeningProposal): readonly Entity[] {
  const live = liveScene(scene);
  const result = addOpeningsToScene(proposal.items, live.accessor, UNDO);
  if (result.refusal) throw new Error(`ο γραφέας αρνήθηκε: ${result.refusal}`);
  return live.entities();
}

beforeEach(() => {
  history.clear();
});

describe('Φ4-3α — κενά χωρίς σύμβολο στο σχέδιο δοκιμής', () => {
  const proposal = propose(sceneOf(writtenWalls(true)));
  const gaps = gapsOf(proposal);

  it('δύο κενά, 500 και 1900 mm: «προς απόφαση», γεφύρωση, καμία πηγή συμβόλου', () => {
    expect(gaps.map((g) => [g.status, g.reason, Math.round(g.widthMm!), g.host?.kind, g.sourceIds])).toEqual([
      ['needs-decision', 'no-symbol', 500, 'bridge', []],
      ['needs-decision', 'no-symbol', 1900, 'bridge', []],
    ]);
  });

  it('το άνοιγμα πάνω στον άξονα έχει μήκος ίσο με το πλάτος', () => {
    for (const g of gaps) {
      expect(Math.hypot(g.span!.end.x - g.span!.start.x, g.span!.end.y - g.span!.start.y)).toBeCloseTo(g.widthMm!, 6);
    }
  });

  it('κενό που έχει πόρτα ΔΕΝ είναι και κενό χωρίς σύμβολο', () => {
    const pairOf = (ids: readonly string[]) => [...ids].sort().join('|');
    const doorPairs = proposal.items.flatMap((i) => (i.symbol === 'door' && i.host?.kind === 'bridge' ? [pairOf(i.host.wallIds)] : []));
    expect(doorPairs).toHaveLength(2);
    for (const g of gaps) expect(doorPairs).not.toContain(pairOf(g.host!.kind === 'bridge' ? g.host!.wallIds : []));
  });

  it('και τα δύο κρατούν ζωγραφισμένες γραμμές ΑΛΛΟΥ ρόλου — ο άνθρωπος το βλέπει, ο βοηθός δεν κρίνει', () => {
    const byId = new Map(ENTITIES.map((e) => [e.id, e] as const));
    for (const g of gaps) {
      expect(g.occupantIds!.length).toBeGreaterThan(0);
      for (const id of g.occupantIds!) expect(colorOf(byId.get(id)!)).not.toBe(OPENING);
    }
  });

  it('χωρίς απόφαση δεν γράφεται κανένα: 12 ανοίγματα, όσα και τα σύμβολα', () => {
    const scene = sceneOf(writtenWalls(true));
    expect(written(scene, propose(scene)).filter(isOpeningEntity)).toHaveLength(12);
  });
});

describe('Φ4-3α — τι είναι κενό χωρίς σύμβολο', () => {
  it('δύο ομοαξονικοί τοίχοι ίδιου πάχους με κενό 900 ⇒ ένα στοιχείο, από άκρο σε άκρο', () => {
    const [item, ...rest] = propose(pair(900)).items;
    expect(rest).toEqual([]);
    expect([item.status, item.reason, item.symbol, item.widthMm, item.occupantIds]).toEqual(['needs-decision', 'no-symbol', 'none', 900, []]);
    expect(item.span).toEqual({ start: { x: 101000, y: 0 }, end: { x: 101900, y: 0 } });
    expect(isDecidableOpening(item)).toBe(true);
  });

  it('τα όρια πλάτους: από το κατώφλι περάσματος (400) ως το μέγιστο κενό γείτονα (2500)', () => {
    const count = (gap: number) => propose(pair(gap)).items.length;
    expect([count(399), count(400), count(2500), count(2501)]).toEqual([0, 1, 1, 0]);
  });

  it('τοίχοι διαφορετικού πάχους δεν είναι διαδρομή ⇒ κανένα κενό', () => {
    expect(propose(pair(900, 100)).items).toEqual([]);
  });

  it('τρίτος τοίχος που διασχίζει το κενό το φράζει', () => {
    expect(propose([...pair(900), wallAt(101450, -1000, 101450, 1000)]).items).toEqual([]);
  });

  it('κολώνα μέσα στο κενό το φράζει — και όταν το γεμίζει ΑΚΡΙΒΩΣ', () => {
    expect(propose([...pair(900), column(101300, 101600)]).items).toEqual([]);
    expect(propose([...pair(900), column(101000, 101900)]).items).toEqual([]);
  });

  it('γραμμή άλλου ρόλου μέσα στο κενό καταγράφεται ως ένοικος, ΔΕΝ το φράζει', () => {
    const inside = line('in', '#ff0000', 101300, -50, 101600, -50);
    const outside = line('out', '#ff0000', 100200, -50, 100500, -50);
    expect(propose([...pair(900), inside, outside]).items.map((i) => [i.reason, i.occupantIds])).toEqual([['no-symbol', ['in']]]);
  });

  it('γραμμή του ρόλου «κούφωμα» μέσα στο κενό δεν είναι ένοικος — είναι σύμβολο', () => {
    const items = propose([...pair(900), line('sym', '#00CCCC', 101300, -50, 101600, -50)]).items;
    expect(gapsOf({ items, unexplainedIds: [] }).flatMap((g) => g.occupantIds ?? [])).toEqual([]);
  });

  it('κενό με σύμβολο πόρτας δίνει ΜΙΑ πόρτα, όχι πόρτα και κενό', () => {
    const arc = { id: 'arc', type: 'arc', color: '#00CCCC', center: { x: 101050, y: 100 }, radius: 800, startAngle: 0, endAngle: 90 } as unknown as Entity;
    expect(propose([...pair(900), arc]).items.map((i) => [i.symbol, i.status, i.host?.kind])).toEqual([['door', 'door', 'bridge']]);
  });
});

describe('Φ4-3α — η απόφαση του ανθρώπου αποφασίζει τι γράφεται', () => {
  const scene = pair(900);
  const key = propose(scene).items[0].key;

  it('χωρίς απόφαση ο γραφέας δεν έχει τι να γράψει', () => {
    const live = liveScene(scene);
    expect(addOpeningsToScene(propose(scene).items, live.accessor, UNDO).refusal).toBe('nothing-to-write');
  });

  it('«πόρτα» ⇒ ΕΝΑΣ τοίχος από άκρο σε άκρο με ΜΙΑ πόρτα 900 στη θέση του κενού', () => {
    const proposal = propose(scene, decide(key, 'door'));
    expect(proposal.items.map((i) => [i.status, i.decided, i.reason, i.symbol])).toEqual([['door', true, 'no-symbol', 'none']]);

    const after = written(scene, proposal);
    const [wall, ...otherWalls] = after.filter(isWallEntity);
    const [opening, ...otherOpenings] = after.filter(isOpeningEntity);
    expect([otherWalls, otherOpenings]).toEqual([[], []]);
    expect([wall.params.start.x, wall.params.end.x].sort()).toEqual([100000, 104900]);
    expect([opening.params.kind, opening.params.width, opening.params.offsetFromStart, opening.params.wallId])
      .toEqual(['door', 900, 1000, wall.id]);
  });

  it('«παράθυρο» ⇒ το ίδιο κενό γράφεται ως παράθυρο, χωρίς φορά φύλλου', () => {
    const [opening] = written(scene, propose(scene, decide(key, 'window'))).filter(isOpeningEntity);
    expect([opening.params.kind, opening.params.width, opening.params.handing]).toEqual(['window', 900, undefined]);
  });

  it('μετά την εγγραφή το κενό δεν υπάρχει πια ⇒ η επόμενη πρόταση δεν ξαναρωτά', () => {
    expect(propose(written(scene, propose(scene, decide(key, 'door')))).items).toEqual([]);
  });

  it('αραιό σύμβολο παραθύρου που ο άνθρωπος λέει «πόρτα» γράφεται ΠΟΡΤΑ — το είδος είναι η απόφαση, όχι το σύμβολο', () => {
    const sparse = [wallAt(100000, 0, 104000, 0), line('a', '#00CCCC', 101000, 80, 101800, 80), line('b', '#00CCCC', 101000, -80, 101800, -80)];
    const item = propose(sparse).items[0];
    expect([item.symbol, item.reason]).toEqual(['window', 'sparse-symbol']);
    const [opening] = written(sparse, propose(sparse, decide(item.key, 'door'))).filter(isOpeningEntity);
    expect([opening.params.kind, opening.params.width]).toEqual(['door', 800]);
  });

  it('σύμβολο πόρτας με απίθανη κάσα που ο άνθρωπος λέει «παράθυρο» δεν κρατά τη φορά του φύλλου', () => {
    // Φύλλο 800 σε κενό 1100 ⇒ κάσα 150 mm, εκτός εύρους ⇒ «προς απόφαση», αλλά με ξενιστή και θέση.
    const arc = { id: 'arc', type: 'arc', color: '#00CCCC', center: { x: 101050, y: 100 }, radius: 800, startAngle: 0, endAngle: 90 } as unknown as Entity;
    const wide = [...pair(1100), arc];
    const item = propose(wide).items[0];
    expect([item.symbol, item.reason, item.swing !== undefined, isDecidableOpening(item)]).toEqual(['door', 'frame-implausible', true, true]);

    const [asWindow] = written(wide, propose(wide, decide(item.key, 'window'))).filter(isOpeningEntity);
    expect([asWindow.params.kind, asWindow.params.handing, asWindow.params.openDirection]).toEqual(['window', undefined, undefined]);
    history.clear();
    const [asDoor] = written(wide, propose(wide, decide(item.key, 'door'))).filter(isOpeningEntity);
    expect([asDoor.params.kind, asDoor.params.width, asDoor.params.handing !== undefined]).toEqual(['door', 1100, true]);
  });

  it('απόφαση για στοιχείο χωρίς ξενιστή αγνοείται: δεν υπάρχει τι να γραφτεί', () => {
    const arc = { id: 'arc', type: 'arc', color: '#00CCCC', center: { x: 101050, y: 50 }, radius: 800, startAngle: 0, endAngle: 90 } as unknown as Entity;
    const undetermined = [wallAt(100000, 0, 101000, 0, 200), wallAt(101900, 0, 103000, 0, 100), arc];
    const item = propose(undetermined).items[0];
    expect([item.reason, isDecidableOpening(item)]).toEqual(['host-undetermined', false]);
    const [after] = propose(undetermined, decide(item.key, 'door')).items;
    expect([after.status, after.decided]).toEqual(['needs-decision', undefined]);
  });

  it('απόφαση για στοιχείο που το σχέδιο ήδη διάβασε δεν το αλλάζει', () => {
    const fixture = sceneOf(writtenWalls(true));
    const door = propose(fixture).items.find((i) => i.status === 'door')!;
    const same = propose(fixture, decide(door.key, 'window')).items.find((i) => i.key === door.key)!;
    expect([same.status, same.decided]).toEqual(['door', undefined]);
  });
});
