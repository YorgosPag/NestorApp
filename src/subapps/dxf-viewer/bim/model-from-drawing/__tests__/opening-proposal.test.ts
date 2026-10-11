/**
 * ADR-911 Φ4-1 — ο πυρήνας της πρότασης ανοιγμάτων πάνω στο σχέδιο δοκιμής.
 *
 * Η σκηνή του test είναι ό,τι αφήνει η Φ3: οι γραμμές του DXF ΚΑΙ οι τοίχοι BIM γραμμένοι (με τα
 * trims τους). Οι αριθμοί είναι οι μετρημένοι του ADR-911 §4.7.
 */

import type { AnySceneEntity, Entity } from '../../../types/entities';
import type { WallEntity } from '../../types/wall-types';
import { buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { projectPointToWallOffsetMm } from '../../geometry/opening-geometry';
import { applyTrimPatches, computeWallTrims } from '../../walls/wall-trims';
import { buildMergedWallParams } from '../../walls/wall-merge';
import { computeWallProposal } from '../wall-proposal';
import {
  computeOpeningProposal, countOpeningsByStatus, type OpeningProposal, type OpeningProposalItem,
} from '../opening-proposal';
import fixture from './fixtures/floor-plan-lines.json';

const ENTITIES = fixture.entities as unknown as readonly Entity[];
const colorOf = (e: Entity): string | null => (e as { color?: string }).color?.toLowerCase() ?? null;
const WALL = '#003fff';
const OPENING = '#00cccc';
/** Μετρημένο (ADR-911 §4.7): γραμμές κουφωμάτων που δεν εξηγεί ούτε πόρτα ούτε παράθυρο. */
const UNEXPLAINED_IN_FIXTURE = 0;

/** Οι τοίχοι όπως τους γράφει η Φ3. `acceptAll` = εγκρίθηκαν και τα 2 «προς απόφαση». */
function writtenWalls(acceptAll: boolean): WallEntity[] {
  const input = { entities: ENTITIES, wallColorHex: WALL, colorOf, sceneUnits: 'mm' as const, levelId: 'lvl' };
  const base = computeWallProposal(input);
  const undecided = new Set(base.items.filter((i) => i.status === 'needs-decision').map((i) => i.key));
  const walls = acceptAll ? computeWallProposal({ ...input, acceptedKeys: undecided }).walls : base.walls;
  const trimmed = applyTrimPatches(walls as readonly AnySceneEntity[], computeWallTrims(walls, []));
  return trimmed as unknown as WallEntity[];
}

const sceneOf = (walls: readonly WallEntity[], extra: readonly Entity[] = []): Entity[] =>
  [...ENTITIES, ...(walls as unknown as Entity[]), ...extra];

const propose = (entities: readonly Entity[]): OpeningProposal =>
  computeOpeningProposal({ entities, openingColorHex: OPENING, colorOf, sceneUnits: 'mm' });

const byStatus = (p: OpeningProposal, status: OpeningProposalItem['status']) => p.items.filter((i) => i.status === status);
const doorOf = (p: OpeningProposal, arcId: string) => p.items.find((i) => i.sourceIds.includes(arcId))!;

// ── Εγγραφή της πρότασης (μόνο για το test· ο πραγματικός γραφέας είναι η Φ4-2) ─────────────────

/** Νέο κομμάτι = καθαρός τοίχος: δεν κληρονομεί τα κοψίματα άκρων του τοίχου-προτύπου. */
const NO_TRIMS = { startMiter: undefined, endMiter: undefined, startBevel: undefined, endBevel: undefined };

function rebuilt(wall: WallEntity, params: WallEntity['params']): WallEntity {
  const built = buildWallEntity(params, wall.layerId ?? 'layer', 'straight', 'mm');
  if (!built.ok) throw new Error(`host: ${built.hardErrors.join(',')}`);
  return built.entity;
}

function hostFor(item: OpeningProposalItem, walls: Map<string, WallEntity>): WallEntity {
  const plan = item.host!;
  if (plan.kind === 'existing-wall') return walls.get(plan.wallId)!;
  if (plan.kind === 'bridge') {
    const [a, b] = plan.wallIds.map((id) => walls.get(id)!);
    const merged = rebuilt(a, buildMergedWallParams(a, b));
    plan.wallIds.forEach((id) => walls.delete(id));
    walls.set(merged.id, merged);
    return merged;
  }
  if (plan.kind === 'extend') {
    const wall = walls.get(plan.wallId)!;
    const extended = rebuilt(wall, { ...wall.params, [plan.end]: { ...wall.params[plan.end], x: plan.to.x, y: plan.to.y } });
    walls.delete(wall.id);
    walls.set(extended.id, extended);
    return extended;
  }
  const template = [...walls.values()][0];
  const piece = rebuilt(template, {
    ...template.params, ...NO_TRIMS, thickness: plan.thicknessMm,
    start: { ...template.params.start, ...plan.start }, end: { ...template.params.end, ...plan.end },
  });
  walls.set(piece.id, piece);
  return piece;
}

function writeProposal(walls: readonly WallEntity[], proposal: OpeningProposal): Entity[] {
  const map = new Map(walls.map((w) => [w.id, w] as const));
  const openings = proposal.items.filter((i) => i.status === 'door' || i.status === 'window').map((item, n) => {
    const host = hostFor(item, map);
    const offsets = [item.span!.start, item.span!.end].map((p) => projectPointToWallOffsetMm(p, host));
    return {
      id: `op-${n}`, type: 'opening',
      params: { kind: item.symbol, wallId: host.id, offsetFromStart: Math.min(...offsets), width: item.widthMm! },
    } as unknown as Entity;
  });
  return sceneOf([...map.values()], openings);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────

describe('πόρτες — η πόρτα ορίζει τον άξονά της (§4.6)', () => {
  const proposal = propose(sceneOf(writtenWalls(true)));

  it('και τα 6 τόξα γίνονται πόρτες, με κενό λαμπά–λαμπά = πλάτος (Δ6)', () => {
    const widths = ['arc_959', 'arc_1076', 'arc_1089', 'arc_1102', 'arc_1115', 'arc_1128']
      .map((id) => [doorOf(proposal, id).status, Math.round(doorOf(proposal, id).widthMm!)]);
    expect(widths).toEqual([['door', 1000], ['door', 800], ['door', 800], ['door', 800], ['door', 700], ['door', 700]]);
  });

  it('η κάσα βγαίνει (κενό − φύλλο)/2 ≈ 49 mm σε όλες', () => {
    for (const item of byStatus(proposal, 'door')) {
      expect(item.frameWidthMm!).toBeGreaterThan(48.5);
      expect(item.frameWidthMm!).toBeLessThan(49.5);
      expect(item.widthMm! - item.leafMm!).toBeCloseTo(2 * item.frameWidthMm!, 6);
    }
  });

  it('ο ξενιστής: 2 γεφυρώσεις, 2 επεκτάσεις, 2 νέα κομμάτια πάχους 100', () => {
    const kinds = (id: string) => doorOf(proposal, id).host!.kind;
    expect(['arc_1076', 'arc_1128'].map(kinds)).toEqual(['bridge', 'bridge']);
    expect(['arc_959', 'arc_1102'].map(kinds)).toEqual(['extend', 'extend']);
    for (const id of ['arc_1089', 'arc_1115']) {
      const host = doorOf(proposal, id).host!;
      expect(host.kind === 'new-piece' && Math.round(host.thicknessMm)).toBe(100);
    }
  });

  it('το άνοιγμα πάνω στον ξενιστή έχει μήκος ίσο με το πλάτος', () => {
    for (const item of byStatus(proposal, 'door')) {
      const { start, end } = item.span!;
      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeCloseTo(item.widthMm!, 3);
    }
  });

  it('χωρίς τα 2 «προς απόφαση» ορθογώνια, η πόρτα που στηρίζεται πάνω τους ΔΕΝ γράφεται', () => {
    const partial = propose(sceneOf(writtenWalls(false)));
    const orphan = doorOf(partial, 'arc_1115');
    expect([orphan.status, orphan.reason]).toEqual(['needs-decision', 'frame-implausible']);
    expect(Math.round(orphan.widthMm!)).toBe(900);
    expect(byStatus(partial, 'door')).toHaveLength(5);
  });
});

describe('παράθυρα — συστάδες μέσα στο σώμα συνεχών τοίχων', () => {
  const walls = writtenWalls(true);
  const proposal = propose(sceneOf(walls));
  const windows = byStatus(proposal, 'window');

  it('τα πλάτη είναι η έκταση της συστάδας πάνω στον άξονα του τοίχου', () => {
    expect(windows.map((w) => Math.round(w.widthMm!)).sort((a, b) => a - b)).toEqual([900, 1283, 1400, 1400, 1400, 2600]);
  });

  it('ξενιστής είναι υπάρχων τοίχος και κανένα παράθυρο δεν μοιράζεται γραμμή με άλλο κούφωμα', () => {
    const ids = new Set(walls.map((w) => w.id));
    for (const w of windows) expect(w.host!.kind === 'existing-wall' && ids.has(w.host!.wallId)).toBe(true);
    const all = proposal.items.flatMap((i) => i.sourceIds);
    expect(new Set(all).size).toBe(all.length);
  });

  it('τα πλήθη ανά κατάσταση', () => {
    expect(countOpeningsByStatus(proposal)).toEqual({ door: 6, window: 6, 'needs-decision': 0, existing: 0 });
  });
});

describe('Α-7 — ο αναγνωριστής δεν λαμβάνει ποτέ οντότητα άλλου ρόλου', () => {
  const walls = writtenWalls(true);
  const cyanIds = new Set(ENTITIES.filter((e) => colorOf(e) === OPENING).map((e) => e.id));

  it('κάθε πηγή κάθε πρότασης έχει τον ρόλο «κούφωμα»', () => {
    const sources = propose(sceneOf(walls)).items.flatMap((i) => i.sourceIds);
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((id) => !cyanIds.has(id))).toEqual([]);
  });

  it('το ίδιο σύμβολο με χρώμα τοίχου δεν προτείνεται', () => {
    const recolored = ENTITIES.map((e) => (cyanIds.has(e.id) ? ({ ...e, color: '#003FFF' } as unknown as Entity) : e));
    expect(propose([...recolored, ...(walls as unknown as Entity[])]).items).toEqual([]);
  });

  it('τόξο τοίχου δίπλα σε πραγματική πόρτα δεν γίνεται δεύτερη πόρτα', () => {
    const arc = ENTITIES.find((e) => e.id === 'arc_959')!;
    const impostor = { ...arc, id: 'impostor', color: '#003FFF' } as unknown as Entity;
    const items = propose(sceneOf(walls, [impostor])).items;
    expect(items.some((i) => i.sourceIds.includes('impostor'))).toBe(false);
    expect(items).toHaveLength(12);
  });
});

describe('Α-8 — ένα τόξο ⇒ το πολύ ένα κούφωμα', () => {
  it('κάθε τόξο εμφανίζεται σε ακριβώς ένα στοιχείο, και κάθε πόρτα έχει ακριβώς ένα τόξο', () => {
    const proposal = propose(sceneOf(writtenWalls(true)));
    const arcs = ENTITIES.filter((e) => e.type === 'arc' && colorOf(e) === OPENING).map((e) => e.id);
    for (const id of arcs) expect(proposal.items.filter((i) => i.sourceIds.includes(id))).toHaveLength(1);
    for (const door of proposal.items.filter((i) => i.symbol === 'door')) expect(door.sourceIds).toHaveLength(1);
  });

  it('τα κλειδιά είναι μοναδικά και ίδια σε κάθε υπολογισμό', () => {
    const keys = (p: OpeningProposal) => p.items.map((i) => i.key);
    const a = keys(propose(sceneOf(writtenWalls(true))));
    expect(new Set(a).size).toBe(a.length);
    expect(keys(propose(sceneOf(writtenWalls(true))))).toEqual(a);
  });
});

describe('ιδεμποτία — δεύτερη εκτέλεση πάνω στη γραμμένη σκηνή', () => {
  const walls = writtenWalls(true);
  const first = propose(sceneOf(walls));
  const written = writeProposal(walls, first);
  const second = propose(written);

  it('μηδέν νέα: και τα 12 είναι «υπάρχει ήδη»', () => {
    expect(countOpeningsByStatus(second)).toEqual({ door: 0, window: 0, 'needs-decision': 0, existing: 12 });
  });

  it('με τα ίδια κλειδιά, το καθένα δεμένο σε άνοιγμα με τον ξενιστή του', () => {
    expect(second.items.map((i) => i.key)).toEqual(first.items.map((i) => i.key));
    const openings = new Map(written.filter((e) => e.type === 'opening')
      .map((e) => [e.id, (e as unknown as { params: { wallId: string } }).params.wallId] as const));
    for (const item of second.items) {
      expect(item.host!.kind === 'existing-wall' && item.host!.wallId).toBe(openings.get(item.existingOpeningId!));
    }
  });

  it('κριτής είναι ο ξενιστής: το ίδιο άνοιγμα δεμένο σε ΑΛΛΟΝ τοίχο δεν μετρά ως «υπάρχει»', () => {
    const elsewhere = written.map((e) => (e.type === 'opening'
      ? ({ ...e, params: { ...(e as unknown as { params: object }).params, wallId: 'someone-else' } } as unknown as Entity)
      : e));
    expect(countOpeningsByStatus(propose(elsewhere)).existing).toBe(0);
  });

  it('κριτής είναι και η θέση: άνοιγμα στον σωστό τοίχο αλλά αλλού στον άξονα δεν μετρά', () => {
    const shifted = written.map((e) => (e.type === 'opening'
      ? ({ ...e, params: { ...(e as unknown as { params: object }).params, offsetFromStart: -50000 } } as unknown as Entity)
      : e));
    expect(countOpeningsByStatus(propose(shifted)).existing).toBe(0);
  });
});

describe('ανεξήγητες γραμμές — δεν κρύβονται, και δεν αλλάζουν με την εγγραφή', () => {
  const walls = writtenWalls(true);
  const first = propose(sceneOf(walls));
  const second = propose(writeProposal(walls, first));

  it('κάθε γραμμή του ρόλου είναι ή πηγή κουφώματος, ή σύμβολο πόρτας, ή ανεξήγητη', () => {
    const sources = new Set(first.items.flatMap((i) => i.sourceIds));
    expect(first.unexplainedIds.filter((id) => sources.has(id))).toEqual([]);
    expect(first.unexplainedIds).toHaveLength(UNEXPLAINED_IN_FIXTURE);
  });

  it('η δεύτερη εκτέλεση αφήνει ανεξήγητες ΤΙΣ ΙΔΙΕΣ γραμμές', () => {
    expect([...second.unexplainedIds].sort()).toEqual([...first.unexplainedIds].sort());
  });
});

describe('τοίχος συνεχής πίσω από το σύμβολο, χωρίς άνοιγμα', () => {
  const walls = writtenWalls(true);
  const bridged = writeProposal(walls, propose(sceneOf(walls))).filter((e) => e.type !== 'opening');
  const proposal = propose(bridged);

  it('η πόρτα δεν έχει λαμπάδες να μετρήσει ⇒ «προς απόφαση», με ξενιστή τον τοίχο που την περιέχει', () => {
    const doors = proposal.items.filter((i) => i.symbol === 'door');
    expect(doors.map((d) => [d.status, d.reason, d.host?.kind])).toEqual(
      Array.from({ length: 6 }, () => ['needs-decision', 'jambs-not-drawn', 'existing-wall']),
    );
    for (const d of doors) expect(d.widthMm! - d.leafMm!).toBe(100);
  });

  it('τα σύμβολα της κάσας μέσα στον τοίχο δεν γίνονται παράθυρα', () => {
    expect(countOpeningsByStatus(proposal)).toEqual({ door: 0, window: 6, 'needs-decision': 6, existing: 0 });
  });
});

describe('παράθυρα — τι ΔΕΝ είναι σύμβολο παραθύρου', () => {
  const template = writtenWalls(true)[0];
  const wall = rebuilt(template, {
    ...template.params, ...NO_TRIMS, thickness: 200,
    start: { ...template.params.start, x: 100000, y: 0 }, end: { ...template.params.end, x: 104000, y: 0 },
  });
  const line = (id: string, x1: number, y1: number, x2: number, y2: number): Entity =>
    ({ id, type: 'line', color: '#00CCCC', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as Entity;
  const proposeOn = (lines: Entity[]) => propose([wall as unknown as Entity, ...lines]);

  it('τρεις γραμμές μέσα στο σώμα είναι παράθυρο με πλάτος την έκτασή τους', () => {
    const p = proposeOn([line('a', 101000, 80, 102000, 80), line('b', 101000, -80, 102000, -80), line('c', 101000, -80, 101000, 80)]);
    expect(p.items.map((i) => [i.status, i.widthMm])).toEqual([['window', 1000]]);
  });

  it('γραμμές που ΔΙΑΣΧΙΖΟΥΝ τον τοίχο δεν είναι παράθυρο', () => {
    const xs = [101000, 101090, 101180, 101270];
    const p = proposeOn(xs.map((x, i) => line('l' + i, x, 0, x, 900)));
    expect(p.items).toEqual([]);
    expect(p.unexplainedIds).toEqual(['l0', 'l1', 'l2', 'l3']);
  });

  it('δύο γραμμές δεν αρκούν ⇒ «προς απόφαση», όχι παράθυρο', () => {
    const p = proposeOn([line('a', 101000, 80, 101800, 80), line('b', 101000, -80, 101800, -80)]);
    expect(p.items.map((i) => [i.status, i.reason, i.widthMm])).toEqual([['needs-decision', 'sparse-symbol', 800]]);
  });

  it('συστάδα στενότερη από το ελάχιστο άνοιγμα δεν είναι κούφωμα', () => {
    const p = proposeOn([line('a', 101000, 80, 101050, 80), line('b', 101000, -80, 101050, -80), line('c', 101000, -80, 101000, 80)]);
    expect(p.items).toEqual([]);
    expect(p.unexplainedIds).toHaveLength(3);
  });
});

describe('συνθετικές περιπτώσεις — ό,τι δεν ξεχωρίζει το σχέδιο δοκιμής', () => {
  const template = writtenWalls(true)[0];
  const wallAt = (x1: number, y1: number, x2: number, y2: number, thickness: number): Entity =>
    rebuilt(template, {
      ...template.params, ...NO_TRIMS, thickness,
      start: { ...template.params.start, x: x1, y: y1 }, end: { ...template.params.end, x: x2, y: y2 },
    }) as unknown as Entity;
  const cyan = (id: string, x1: number, y1: number, x2: number, y2: number): Entity =>
    ({ id, type: 'line', color: '#00CCCC', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as Entity;
  /** Φύλλο 800, κλειστό κατά +x, ανοίγει προς +y. */
  const door = (x: number, y: number): Entity =>
    ({ id: 'arc', type: 'arc', color: '#00CCCC', center: { x, y }, radius: 800, startAngle: 0, endAngle: 90 }) as unknown as Entity;

  it('δύο ομοαξονικοί τοίχοι ΔΙΑΦΟΡΕΤΙΚΟΥ πάχους δεν γεφυρώνονται ⇒ «προς απόφαση»', () => {
    const scene = [wallAt(100000, 0, 101000, 0, 200), wallAt(101900, 0, 103000, 0, 100), door(101050, 50)];
    const [item] = propose(scene).items;
    expect([item.status, item.reason, item.host, Math.round(item.widthMm!)]).toEqual(['needs-decision', 'host-undetermined', undefined, 900]);
  });

  it('πόρτα ανάμεσα σε παρειές δύο μακριών κάθετων τοίχων: η παρειά δεν δίνει πάχος ⇒ «προς απόφαση»', () => {
    const scene = [wallAt(100000, 0, 100000, 3000, 200), wallAt(101100, 0, 101100, 3000, 200), door(100150, 500)];
    const [item] = propose(scene).items;
    expect([item.status, item.reason, item.host, Math.round(item.widthMm!)]).toEqual(['needs-decision', 'host-undetermined', undefined, 900]);
  });

  it('γραμμή παραθύρου που ΞΕΚΙΝΑ δίπλα σε πόρτα αλλά συνεχίζει πέρα από το φύλλο της μένει παράθυρο', () => {
    const scene = [
      wallAt(100000, 0, 104000, 0, 200), door(100900, 100),
      cyan('a', 101000, 80, 102500, 80), cyan('b', 101000, -80, 102500, -80), cyan('c', 102500, -80, 102500, 80),
    ];
    const items = propose(scene).items;
    expect(items.map((i) => [i.symbol, i.status, Math.round(i.widthMm!)])).toEqual([
      ['door', 'needs-decision', 900], ['window', 'window', 1500],
    ]);
  });

  it('σύμβολο πάνω σε θέση που έχει ήδη άνοιγμα — οποιουδήποτε είδους — δεν προτείνεται ξανά', () => {
    const wall = wallAt(100000, 0, 104000, 0, 200);
    const opening = { id: 'op', type: 'opening', params: { kind: 'door', wallId: wall.id, offsetFromStart: 1000, width: 1000 } } as unknown as Entity;
    const lines = [cyan('a', 101000, 80, 102000, 80), cyan('b', 101000, -80, 102000, -80), cyan('c', 101000, -80, 101000, 80)];
    expect(propose([wall, opening, ...lines]).items.map((i) => [i.status, i.existingOpeningId])).toEqual([['existing', 'op']]);
  });
});
