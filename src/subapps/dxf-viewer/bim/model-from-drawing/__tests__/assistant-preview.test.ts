/**
 * ADR-911 Φ3β — οι καθαρές συναρτήσεις της προεπισκόπησης του βοηθού.
 *
 * Η ισότητα «προεπισκόπηση ≡ απόδοση» (Α-10) κρίνεται στο
 * `systems/model-from-drawing/__tests__/model-from-drawing-session.test.ts`, πάνω στη γραμμένη
 * σκηνή. Εδώ μένουν όσα ΔΕΝ φαίνονται από εκεί:
 *   · το αποτύπωμα της πρότασης (τι θεωρείται «το ίδιο που ενέκρινα»)·
 *   · ποιες ομάδες πάχους κλειδώνουν την έγκριση·
 *   · οι ανεξήγητες γραμμές.
 */

import type { Entity } from '../../../types/entities';
import type { WallCategory } from '../../types/wall-types';
import { computeWallProposal, type WallProposal, type WallProposalInput } from '../wall-proposal';
import {
  buildAssistantPreview,
  countProposalByStatus,
  groupsAwaitingConfirmation,
  wallProposalSignature,
} from '../assistant-preview';
import fixture from './fixtures/floor-plan-lines.json';

const ENTITIES = fixture.entities as unknown as readonly Entity[];
const colorOf = (e: Entity): string | null => (e as { color?: string }).color?.toLowerCase() ?? null;

function propose(overrides: Partial<WallProposalInput> = {}): WallProposal {
  return computeWallProposal({
    entities: ENTITIES, wallColorHex: '#003fff', colorOf, sceneUnits: 'mm', levelId: 'lvl', ...overrides,
  });
}

const confirmAll = (p: WallProposal, pick: (suggested: WallCategory) => WallCategory = (s) => s) =>
  new Map(p.groups.map((g) => [g.thicknessMm, pick(g.suggestedCategory)] as const));

describe('wallProposalSignature — «το ίδιο που ενέκρινα»', () => {
  it('δύο υπολογισμοί του ίδιου σχεδίου έχουν ίδιο αποτύπωμα, παρότι τα ids των τοίχων διαφέρουν', () => {
    const a = propose();
    const b = propose();
    expect(a.walls.map((w) => w.id)).not.toEqual(b.walls.map((w) => w.id));
    expect(wallProposalSignature(a)).toBe(wallProposalSignature(b));
  });

  it('αλλάζει όταν αλλάζει ό,τι θα ΓΡΑΦΤΕΙ, ακόμη κι αν κλειδιά και καταστάσεις μένουν ίδια', () => {
    const base = propose();
    const asSuggested = propose({ categoryByThicknessMm: confirmAll(base) });
    const flipped = propose({
      categoryByThicknessMm: confirmAll(base, (s) => (s === 'exterior' ? 'interior' : 'exterior')),
    });
    const shape = (p: WallProposal) => p.items.map((i) => [i.key, i.status]);
    expect(shape(flipped)).toEqual(shape(asSuggested));
    expect(wallProposalSignature(flipped)).not.toBe(wallProposalSignature(asSuggested));
  });

  it('αλλάζει όταν ένα ορθογώνιο αλλάζει κατάσταση', () => {
    const base = propose();
    const undecided = base.items.find((i) => i.status === 'needs-decision')!;
    const accepted = propose({ acceptedKeys: new Set([undecided.key]) });
    expect(wallProposalSignature(accepted)).not.toBe(wallProposalSignature(base));
  });
});

describe('groupsAwaitingConfirmation — τι κλειδώνει την έγκριση (Δ3)', () => {
  it('κάθε ομάδα που θα γράψει τοίχο και δεν έχει επιβεβαιωθεί', () => {
    const base = propose();
    expect(groupsAwaitingConfirmation(base).map((g) => g.thicknessMm)).toEqual(base.groups.map((g) => g.thicknessMm));
  });

  it('η επιβεβαίωση μίας ομάδας αφαιρεί ΜΟΝΟ αυτήν', () => {
    const base = propose();
    const [first, ...rest] = base.groups;
    const one = propose({ categoryByThicknessMm: new Map([[first.thicknessMm, first.suggestedCategory]]) });
    expect(groupsAwaitingConfirmation(one).map((g) => g.thicknessMm)).toEqual(rest.map((g) => g.thicknessMm));
    expect(groupsAwaitingConfirmation(propose({ categoryByThicknessMm: confirmAll(base) }))).toEqual([]);
  });

  it('ομάδα που ΔΕΝ γράφει κανέναν τοίχο δεν ζητά απόφαση', () => {
    const base = propose();
    const group = base.groups[0];
    const keys = new Set(group.keys);
    // Τα ορθογώνια της ομάδας υπάρχουν ήδη στη σκηνή ⇒ καμία λειτουργία δεν θα εφαρμοστεί πουθενά.
    const allExisting: WallProposal = {
      ...base,
      items: base.items.map((i) => (keys.has(i.key) ? { ...i, status: 'existing', wall: undefined } : i)),
    };
    const waiting = groupsAwaitingConfirmation(allExisting).map((g) => g.thicknessMm);
    expect(waiting).not.toContain(group.thicknessMm);
    expect(waiting).toHaveLength(base.groups.length - 1);
  });
});

describe('buildAssistantPreview — ανεξήγητες γραμμές και πλήθη', () => {
  it('γραμμή με τον ρόλο που δεν ανήκει σε κανένα ορθογώνιο φωτίζεται με τα άκρα της', () => {
    const orphan = { id: 'orphan', type: 'line', color: '#003FFF', start: { x: -50000, y: -50000 }, end: { x: -48000, y: -50000 } };
    const scene = [...ENTITIES, orphan as unknown as Entity];
    const proposal = propose({ entities: scene });
    expect(proposal.coverage.unexplainedIds).toEqual(['orphan']);
    expect(buildAssistantPreview(proposal, scene).unexplained).toEqual([{ start: orphan.start, end: orphan.end }]);
  });

  it('στο σχέδιο δοκιμής καμία γραμμή τοίχου δεν μένει ανεξήγητη', () => {
    expect(buildAssistantPreview(propose(), ENTITIES).unexplained).toEqual([]);
  });

  it('τα πλήθη ανά κατάσταση αθροίζουν σε όλα τα ορθογώνια, με παρούσες και τις μηδενικές', () => {
    const p = propose();
    const counts = countProposalByStatus(p);
    expect(counts).toEqual({ ready: 38, 'needs-decision': 2, existing: 0, rejected: 0 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(p.items.length);
  });
});
