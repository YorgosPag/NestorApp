/**
 * ADR-911 Φ4-2 — άγκυρες του γραφέα ανοιγμάτων (`addOpeningsToScene`), πάνω στο σχέδιο δοκιμής
 * και σε συνθετικές αλυσίδες που το σχέδιο δεν έχει.
 *
 *   Α-10  σχέδιο ≡ εγγραφή: ό,τι λέει το καθαρό `planOpeningWrite` είναι ΑΚΡΙΒΩΣ ό,τι βρίσκεται
 *         στη σκηνή μετά — και κάθε άνοιγμα κάθεται εκεί που το έδειξε η πρόταση.
 *   +     ΜΙΑ εγγραφή ιστορικού· ένα undo επιστρέφει τη σκηνή ΑΥΤΟΥΣΙΑ, ένα redo την ξαναγράφει.
 *   +     κανένα ορφανό άνοιγμα, κανένας καθρέφτης που δείχνει στο κενό.
 *   +     ιδεμποτία με τον πραγματικό γραφέα: δεύτερη έγκριση = καμία εγγραφή.
 *   +     άρνηση = καμία εγγραφή (σκηνή και ιστορικό ανέγγιχτα).
 *   +     αλυσίδες: δύο πόρτες στον ίδιο τοίχο ⇒ ΕΝΑΣ τοίχος, δύο ανοίγματα.
 */

import type { Entity } from '../../../types/entities';
import { isOpeningEntity, isWallEntity } from '../../../types/entities';
import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { EventBus } from '../../../systems/events/EventBus';
import type { EntityCreatedOrigin } from '../../../systems/events/drawing-event-map';
import type { OpeningEntity } from '../../types/opening-types';
import type { WallEntity } from '../../types/wall-types';
import { computeOpeningGeometry } from '../../geometry/opening-geometry';
import { retrimWallEntities } from '../../walls/wall-retrim';
import { addOpeningsToScene } from '../add-openings-to-scene';
import { countOpeningsByStatus, type OpeningProposalItem } from '../opening-proposal';
import { frameCoords, isInsideFrameBand, wallHostFrame } from '../wall-host-frame';
import { NO_TRIMS, liveScene, propose, rebuilt, sceneOf, writtenWalls, type LiveScene } from './opening-fixture';

const history = getGlobalCommandHistory();
const UNDO = { undoName: 'test' } as const;
const flushMicrotasks = (): Promise<void> => Promise.resolve();

const wallsOf = (entities: readonly Entity[]): WallEntity[] => entities.filter(isWallEntity);
const openingsOf = (entities: readonly Entity[]): OpeningEntity[] => entities.filter(isOpeningEntity);
const writable = (items: readonly OpeningProposalItem[]) => items.filter((i) => i.status === 'door' || i.status === 'window');
/**
 * Η τιμή όπως ΑΠΟΘΗΚΕΥΕΤΑΙ: οι εντολές παρτίδας κρατούν αντίγραφο (`deepClone`), άρα το
 * `Timestamp` της επικύρωσης φτάνει στη σκηνή ως απλό αντικείμενο. Η σύγκριση είναι τιμών.
 */
const stored = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Το σχέδιο δοκιμής με τους 40 τοίχους της Φ3 γραμμένους, και η πρότασή του. */
function fixtureScene(): { live: LiveScene; items: readonly OpeningProposalItem[]; before: readonly Entity[] } {
  const before = sceneOf(writtenWalls(true));
  return { live: liveScene(before), items: propose(before).items, before };
}

beforeEach(() => {
  history.clear();
});

describe('ADR-911 Α-10 — σχέδιο ≡ εγγραφή, πάνω στο σχέδιο δοκιμής', () => {
  it('γράφονται 12 ανοίγματα· 4 τοίχοι γίνονται 2 ενωμένοι και προστίθενται 2 νέα κομμάτια', () => {
    const { live, items } = fixtureScene();

    const { plan, refusal } = addOpeningsToScene(items, live.accessor, UNDO);

    expect(refusal).toBeUndefined();
    expect(plan!.openings).toHaveLength(12);
    expect(plan!.removedWalls).toHaveLength(4);
    expect(plan!.addedWalls).toHaveLength(4);
    expect(wallsOf(live.entities())).toHaveLength(40);
  });

  it('κάθε τοίχος και κάθε άνοιγμα του σχεδίου βρίσκεται ΑΥΤΟΥΣΙΟ στη σκηνή', () => {
    const { live, items } = fixtureScene();
    const { plan } = addOpeningsToScene(items, live.accessor, UNDO);
    const byId = new Map(live.entities().map((e) => [e.id, e] as const));

    for (const wall of plan!.addedWalls) expect(byId.get(wall.id)).toEqual(stored(wall));
    for (const opening of plan!.openings) expect(byId.get(opening.id)).toEqual(stored(opening));
    for (const wall of plan!.removedWalls) expect(byId.has(wall.id)).toBe(false);
    for (const patch of plan!.wallPatches) expect((byId.get(patch.entityId) as WallEntity).params).toEqual(patch.next);
    for (const patch of plan!.mirrorPatches) {
      expect((byId.get(patch.entityId) as WallEntity).hostedOpeningIds).toEqual(patch.next);
    }
  });

  it('κάθε άνοιγμα έχει το πλάτος της πρότασης και κάθεται στο μέσο του `span` της', () => {
    const { live, items } = fixtureScene();
    const { plan } = addOpeningsToScene(items, live.accessor, UNDO);
    const walls = new Map(wallsOf(live.entities()).map((w) => [w.id, w] as const));

    writable(items).forEach((item, n) => {
      const opening = plan!.openings[n];
      const frame = wallHostFrame(walls.get(opening.params.wallId!)!, 1)!;
      const centre = frameCoords(frame, mid(item.span!.start, item.span!.end)).along;
      expect(opening.params.kind).toBe(item.symbol);
      expect(opening.params.width).toBeCloseTo(item.widthMm!, 6);
      expect(opening.params.offsetFromStart + opening.params.width / 2).toBeCloseTo(centre, 3);
    });
  });

  it('ο ξενιστής είναι ΣΥΝΕΧΗΣ κάτω από κάθε άνοιγμα: και τα δύο άκρα του μέσα στο σώμα του', () => {
    const { live, items } = fixtureScene();
    addOpeningsToScene(items, live.accessor, UNDO);
    const walls = new Map(wallsOf(live.entities()).map((w) => [w.id, w] as const));
    const openings = openingsOf(live.entities());

    writable(items).forEach((item, n) => {
      const frame = wallHostFrame(walls.get(openings[n].params.wallId!)!, 1)!;
      expect(isInsideFrameBand(frame, item.span!.start, 1e-3)).toBe(true);
      expect(isInsideFrameBand(frame, item.span!.end, 1e-3)).toBe(true);
    });
  });

  it('η κάσα της πόρτας είναι η μετρημένη, όχι η προεπιλογή', () => {
    const { live, items } = fixtureScene();
    const { plan } = addOpeningsToScene(items, live.accessor, UNDO);

    writable(items).forEach((item, n) => {
      if (item.symbol !== 'door') return;
      expect(plan!.openings[n].params.frameWidth).toBe(item.frameWidthMm);
      expect(plan!.openings[n].params.frameWidth).not.toBe(50);
    });
  });
});

describe('ADR-911 Φ4-2 — ό,τι δεν φαίνεται στο πλάτος και τη θέση', () => {
  it('κάθε πόρτα έχει τον μεντεσέ στο `span.start` και ανοίγει προς το `swing` της πρότασης', () => {
    const { live, items } = fixtureScene();
    const { plan } = addOpeningsToScene(items, live.accessor, UNDO);
    const walls = new Map(wallsOf(live.entities()).map((w) => [w.id, w] as const));
    const doors = writable(items).map((item, n) => ({ item, opening: plan!.openings[n] })).filter((d) => d.item.symbol === 'door');

    expect(doors).toHaveLength(6);
    for (const { item, opening } of doors) {
      const geometry = computeOpeningGeometry(opening.params, walls.get(opening.params.wallId!)!, 'mm');
      const hinge = geometry.hingeAnchor!;
      expect(Math.hypot(hinge.x - item.span!.start.x, hinge.y - item.span!.start.y)).toBeLessThan(1e-3);
      const open = geometry.hingeArc!.points[geometry.hingeArc!.points.length - 1];
      expect((open.x - hinge.x) * item.swing!.x + (open.y - hinge.y) * item.swing!.y).toBeGreaterThan(0);
    }
  });

  it('οι ενώσεις της σκηνής είναι ΗΔΗ οι τελικές: ένα ακόμη πέρασμα ενώσεων δεν αλλάζει κανέναν τοίχο', () => {
    const { live, items } = fixtureScene();
    addOpeningsToScene(items, live.accessor, UNDO);
    const written = wallsOf(live.entities());

    const again = wallsOf(retrimWallEntities(live.entities()) as readonly Entity[]);

    expect(stored(again.map((w) => [w.id, w.params]))).toEqual(stored(written.map((w) => [w.id, w.params])));
  });

  it('νέο κομμάτι πάνω σε υπάρχουσα δομική ⇒ `overlap`, σκηνή και ιστορικό ανέγγιχτα (ADR-567)', () => {
    const { items, before } = fixtureScene();
    const host = items.find((i) => i.host?.kind === 'new-piece')!.host!;
    if (host.kind !== 'new-piece') throw new Error('fixture');
    const like = wallsOf(before).find((w) => w.id === host.likeWallId)!;
    const squatter = rebuilt(like, { ...like.params, ...NO_TRIMS, start: { ...like.params.start, ...host.start }, end: { ...like.params.end, ...host.end }, thickness: host.thicknessMm });
    const live = liveScene([...before, squatter as unknown as Entity]);
    const start = live.entities();

    expect(addOpeningsToScene(items, live.accessor, UNDO)).toEqual({ refusal: 'overlap' });
    expect(live.entities()).toBe(start);
    expect(history.getUndoStack()).toHaveLength(0);
  });

  it('το νέο κομμάτι παίρνει από τη λαμπάδα ΜΟΝΟ ύψος/λειτουργία/δεσίματα — όχι τις ρυθμίσεις ένωσής της', () => {
    const { items, before } = fixtureScene();
    const index = writable(items).findIndex((i) => i.host?.kind === 'new-piece');
    const host = writable(items)[index].host!;
    if (host.kind !== 'new-piece') throw new Error('fixture');
    const scene = before.map((e) => (e.id === host.likeWallId
      ? { ...e, params: { ...(e as unknown as WallEntity).params, startJoin: 'disallow', endJoin: 'disallow' } } as unknown as Entity
      : e));
    const live = liveScene(scene);

    const { plan } = addOpeningsToScene(items, live.accessor, UNDO);

    const like = wallsOf(scene).find((w) => w.id === host.likeWallId)!;
    const piece = plan!.addedWalls.find((w) => w.id === plan!.openings[index].params.wallId)!;
    expect(piece.params.height).toBe(like.params.height);
    expect(piece.params.category).toBe(like.params.category);
    expect(piece.params.startJoin).toBeUndefined();
    expect(piece.params.endJoin).toBeUndefined();
  });
});

describe('ADR-911 Φ4-2 — μία έγκριση = ένα undo', () => {
  it('γεφυρώσεις, επεκτάσεις, νέα κομμάτια, ενώσεις και ανοίγματα είναι ΜΙΑ εγγραφή ιστορικού', () => {
    const { live, items } = fixtureScene();
    addOpeningsToScene(items, live.accessor, UNDO);
    expect(history.getUndoStack()).toHaveLength(1);
  });

  it('ένα undo επιστρέφει τη σκηνή αυτούσια· ένα redo την ξαναγράφει ίδια', () => {
    const { live, items, before } = fixtureScene();
    addOpeningsToScene(items, live.accessor, UNDO);
    const afterWrite = [...live.entities()];
    const sorted = (list: readonly Entity[]) => stored([...list]).sort((a, b) => a.id.localeCompare(b.id));

    expect(history.undo()).toBe(true);
    expect(sorted(live.entities())).toEqual(sorted(before));
    expect(history.canUndo()).toBe(false);

    expect(history.redo()).toBe(true);
    expect(sorted(live.entities())).toEqual(sorted(afterWrite));
  });
});

describe('ADR-911 Φ4-2 — κανένα ορφανό άνοιγμα', () => {
  it('κάθε άνοιγμα δείχνει σε τοίχο της σκηνής, και ο καθρέφτης του τοίχου δείχνει πίσω', () => {
    const { live, items } = fixtureScene();
    addOpeningsToScene(items, live.accessor, UNDO);
    const walls = new Map(wallsOf(live.entities()).map((w) => [w.id, w] as const));
    const openings = openingsOf(live.entities());

    expect(openings).toHaveLength(12);
    for (const opening of openings) {
      expect(walls.get(opening.params.wallId!)?.hostedOpeningIds).toContain(opening.id);
    }
    const mirrored = [...walls.values()].flatMap((w) => w.hostedOpeningIds ?? []);
    expect([...mirrored].sort()).toEqual(openings.map((o) => o.id).sort());
  });
});

describe('ADR-911 Φ4-2 — ιδεμποτία με τον πραγματικό γραφέα', () => {
  it('η δεύτερη πρόταση είναι 12 «υπάρχει ήδη» και η δεύτερη έγκριση δεν γράφει τίποτα', () => {
    const { live, items } = fixtureScene();
    addOpeningsToScene(items, live.accessor, UNDO);
    const afterFirst = live.entities();

    const second = propose(afterFirst);
    // Τα 2 «προς απόφαση» είναι τα κενά χωρίς σύμβολο (Φ4-3α): ερώτηση που μένει, δεν γράφεται ποτέ μόνη της.
    expect(countOpeningsByStatus(second)).toEqual({ door: 0, window: 0, 'needs-decision': 2, existing: 12 });

    expect(addOpeningsToScene(second.items, live.accessor, UNDO).refusal).toBe('nothing-to-write');
    expect(live.entities()).toBe(afterFirst);
    expect(history.getUndoStack()).toHaveLength(1);
  });
});

describe('ADR-911 Φ4-2 — άρνηση = καμία εγγραφή', () => {
  it('σχέδιο που δείχνει τοίχο ο οποίος δεν υπάρχει πια ⇒ ονομασμένη άρνηση, σκηνή ανέγγιχτη', () => {
    const { live, items } = fixtureScene();
    const start = live.entities();
    const stale = items.map((item) => (item.host?.kind === 'existing-wall'
      ? { ...item, host: { ...item.host, wallId: 'gone' } }
      : item));

    expect(addOpeningsToScene(stale, live.accessor, UNDO)).toEqual({ refusal: 'missing-host-wall' });
    expect(live.entities()).toBe(start);
    expect(history.getUndoStack()).toHaveLength(0);
  });

  it('χωρίς ενεργή σκηνή ⇒ `no-active-scene`', () => {
    const { live, items } = fixtureScene();
    expect(addOpeningsToScene(items, { ...live.accessor, currentLevelId: null }, UNDO)).toEqual({ refusal: 'no-active-scene' });
  });

  it('τα «προς απόφαση» δεν γράφονται ΠΟΤΕ, ούτε όταν έχουν ξενιστή και πλάτος', () => {
    const { live, items } = fixtureScene();
    const undecided = items.map((item) => ({ ...item, status: 'needs-decision' as const }));
    expect(addOpeningsToScene(undecided, live.accessor, UNDO)).toEqual({ refusal: 'nothing-to-write' });
  });
});

describe('ADR-911 Φ4-2 — εκπομπές αποθήκευσης, συμμετρικές στο undo', () => {
  interface Created { readonly id: string; readonly tool: string; readonly origin?: EntityCreatedOrigin }

  it('δημιουργίες με `origin: bulk`, διαγραφή των απορροφημένων τοίχων· στο undo τα αντίστροφα', async () => {
    const { live, items } = fixtureScene();
    const created: Created[] = [];
    const deletedWalls: string[] = [];
    const deletedOpenings: string[] = [];
    const restored: string[] = [];
    const offs = [
      EventBus.on('drawing:entity-created', (p) => created.push({ id: p.entity.id, tool: p.tool, origin: p.origin })),
      EventBus.on('bim:wall-delete-requested', (p) => deletedWalls.push(p.wallId)),
      EventBus.on('bim:opening-delete-requested', (p) => deletedOpenings.push(p.openingId)),
      EventBus.on('bim:entity-restore-requested', (p) => restored.push(p.entitySnapshot.id)),
    ];

    const { plan } = addOpeningsToScene(items, live.accessor, UNDO);
    await flushMicrotasks();

    const openingIds = plan!.openings.map((o) => o.id).sort();
    const removedIds = plan!.removedWalls.map((w) => w.id).sort();
    expect(created.filter((c) => c.tool === 'opening' && c.origin === 'bulk').map((c) => c.id).sort()).toEqual(openingIds);
    expect(created.filter((c) => c.tool === 'wall' && c.origin === 'bulk').map((c) => c.id).sort())
      .toEqual(plan!.addedWalls.map((w) => w.id).sort());
    expect(created.filter((c) => c.origin === undefined || c.origin === 'create')).toEqual([]);
    expect([...deletedWalls].sort()).toEqual(removedIds);

    deletedWalls.length = 0;
    history.undo();
    await flushMicrotasks();

    expect([...deletedOpenings].sort()).toEqual(openingIds);
    expect([...deletedWalls].sort()).toEqual(plan!.addedWalls.map((w) => w.id).sort());
    expect([...restored].sort()).toEqual(removedIds);
    offs.forEach((off) => off());
  });
});

// ── Συνθετικές αλυσίδες — ό,τι δεν έχει το σχέδιο δοκιμής ─────────────────────────────────────

describe('ADR-911 Φ4-2 — αλυσίδες: δύο πόρτες στον ίδιο τοίχο', () => {
  const template = writtenWalls(true)[0];
  const wallAt = (x1: number, y1: number, x2: number, y2: number, thickness: number): WallEntity =>
    rebuilt(template, {
      ...template.params, ...NO_TRIMS, thickness,
      start: { ...template.params.start, x: x1, y: y1 }, end: { ...template.params.end, x: x2, y: y2 },
    });
  /** Φύλλο 800 με μεντεσέ στο (x, 50): κλειστό κατά +x, ανοίγει προς +y. Κενό λαμπά–λαμπά 900. */
  const door = (id: string, x: number): Entity =>
    ({ id, type: 'arc', color: '#00CCCC', center: { x, y: 50 }, radius: 800, startAngle: 0, endAngle: 90 }) as unknown as Entity;
  const asEntities = (walls: readonly WallEntity[]): Entity[] => walls as unknown as Entity[];

  it('Α–πόρτα–Β–πόρτα–Γ ⇒ ΕΝΑΣ τοίχος Α…Γ με δύο ανοίγματα στις θέσεις τους', () => {
    const [a, b, c] = [wallAt(100000, 0, 101000, 0, 100), wallAt(101900, 0, 103000, 0, 100), wallAt(103900, 0, 105000, 0, 100)];
    const scene = [...asEntities([a, b, c]), door('d1', 101050), door('d2', 103050)];
    const items = propose(scene).items;
    expect(items.map((i) => [i.status, i.host?.kind])).toEqual([['door', 'bridge'], ['door', 'bridge']]);

    const live = liveScene(scene);
    const { plan, refusal } = addOpeningsToScene(items, live.accessor, UNDO);

    expect(refusal).toBeUndefined();
    expect(plan!.removedWalls.map((w) => w.id).sort()).toEqual([a.id, b.id, c.id].sort());
    const [merged, ...others] = wallsOf(live.entities());
    expect(others).toEqual([]);
    expect([merged.params.start.x, merged.params.end.x].sort()).toEqual([100000, 105000]);
    const openings = openingsOf(live.entities());
    expect(openings.map((o) => o.params.wallId)).toEqual([merged.id, merged.id]);
    const startsAt = openings.map((o) => Math.min(merged.params.start.x, merged.params.end.x)
      + (merged.params.start.x < merged.params.end.x ? o.params.offsetFromStart : merged.geometry.length * 1000 - o.params.offsetFromStart - o.params.width));
    expect(startsAt.map(Math.round).sort()).toEqual([101000, 103000]);
    expect(openings.map((o) => Math.round(o.params.width))).toEqual([900, 900]);
    expect(history.getUndoStack()).toHaveLength(1);
  });

  it('γεφύρωση ΚΑΙ επέκταση του ίδιου τοίχου ⇒ ένας τοίχος ως την παρειά του κάθετου', () => {
    const [a, b] = [wallAt(100000, 0, 101000, 0, 100), wallAt(101900, 0, 103000, 0, 100)];
    const cross = wallAt(104000, -1500, 104000, 1500, 200);
    const scene = [...asEntities([a, b, cross]), door('d1', 101050), door('d2', 103050)];
    const items = propose(scene).items;
    expect(items.map((i) => [i.status, i.host?.kind]).sort()).toEqual([['door', 'bridge'], ['door', 'extend']]);

    const live = liveScene(scene);
    const { plan } = addOpeningsToScene(items, live.accessor, UNDO);

    expect(plan!.removedWalls).toHaveLength(2);
    expect(plan!.addedWalls).toHaveLength(1);
    const merged = wallsOf(live.entities()).find((w) => w.id === plan!.addedWalls[0].id)!;
    expect([merged.params.start.x, merged.params.end.x].sort()).toEqual([100000, 103900]);
    expect(openingsOf(live.entities()).map((o) => o.params.wallId)).toEqual([merged.id, merged.id]);
  });

  it('άνοιγμα που ΥΠΗΡΧΕ στον Γ ακολουθεί τον ενωμένο τοίχο στην ίδια θέση κόσμου', () => {
    const [a, b, c] = [wallAt(100000, 0, 101000, 0, 100), wallAt(101900, 0, 103000, 0, 100), wallAt(105000, 0, 103900, 0, 100)];
    const old = {
      id: 'old', type: 'opening', kind: 'window',
      params: { kind: 'window', wallId: c.id, offsetFromStart: 200, width: 400, height: 1200, sillHeight: 900 },
    } as unknown as Entity;
    const scene = [...asEntities([a, b, { ...c, hostedOpeningIds: ['old'] }]), old, door('d1', 101050), door('d2', 103050)];
    const live = liveScene(scene);

    const { plan } = addOpeningsToScene(propose(scene).items, live.accessor, UNDO);

    // Ο Γ είναι ζωγραφισμένος ΑΝΑΠΟΔΑ (105000 → 103900): το άνοιγμα καταλαμβάνει x ∈ [104400, 104800].
    const merged = plan!.addedWalls[0];
    const moved = openingsOf(live.entities()).find((o) => o.id === 'old')!;
    expect(moved.params.wallId).toBe(merged.id);
    const originX = merged.params.start.x;
    const direction = Math.sign(merged.params.end.x - merged.params.start.x);
    const ends = [moved.params.offsetFromStart, moved.params.offsetFromStart + moved.params.width].map((o) => originX + direction * o);
    expect(ends.map(Math.round).sort()).toEqual([104400, 104800]);
    expect(merged.hostedOpeningIds).toContain('old');

    history.undo();
    expect(openingsOf(live.entities()).find((o) => o.id === 'old')!.params).toEqual((old as unknown as OpeningEntity).params);
  });
});
