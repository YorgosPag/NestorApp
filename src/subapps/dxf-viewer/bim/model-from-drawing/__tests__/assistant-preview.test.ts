/**
 * ADR-911 Φ3β — οι καθαρές συναρτήσεις της προεπισκόπησης του βοηθού.
 *
 * Η ισότητα «προεπισκόπηση ≡ απόδοση» (Α-10) κρίνεται στο
 * `systems/model-from-drawing/__tests__/model-from-drawing-session.test.ts`, πάνω στη γραμμένη
 * σκηνή. Εδώ μένουν όσα ΔΕΝ φαίνονται από εκεί:
 *   · το αποτύπωμα της πρότασης (τι θεωρείται «το ίδιο που ενέκρινα»)·
 *   · τι φωτίζεται για τους τοίχους ανεπιβεβαίωτων ομάδων (ADR-929 Φ5.2ε)·
 *   · οι ανεξήγητες γραμμές.
 */

import type { Entity } from '../../../types/entities';
import type { WallCategory } from '../../types/wall-types';
import { computeWallProposal, type WallProposal, type WallProposalInput } from '../wall-proposal';
import {
  buildAssistantPreview,
  countProposalByStatus,
  wallProposalSignature,
} from '../assistant-preview';
import { decisionAnchorsForKeys } from '../decision-anchors';
import fixture from './fixtures/floor-plan-lines.json';

const ENTITIES = fixture.entities as unknown as readonly Entity[];
const colorOf = (e: Entity): string | null => (e as { color?: string }).color?.toLowerCase() ?? null;

function proposeUnconfirmed(overrides: Partial<WallProposalInput> = {}): WallProposal {
  return computeWallProposal({
    entities: ENTITIES, wallColorHex: '#003fff', colorOf, sceneUnits: 'mm', levelId: 'lvl', ...overrides,
  });
}

/** Κάθε ομάδα επιβεβαιωμένη με την πρόταση της τοπολογίας· οι ρητές επιλογές του test νικούν. */
function propose(overrides: Partial<WallProposalInput> = {}): WallProposal {
  const raw = proposeUnconfirmed(overrides);
  const chosen = new Map(raw.groups.map((g) => [g.thicknessMm, g.suggestedCategory] as const));
  for (const [t, c] of overrides.categoryByThicknessMm ?? []) chosen.set(t, c);
  return proposeUnconfirmed({ ...overrides, categoryByThicknessMm: chosen });
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
    const accepted = propose({ acceptedDecisions: decisionAnchorsForKeys(base.decisions, [undecided.key]) });
    expect(wallProposalSignature(accepted)).not.toBe(wallProposalSignature(base));
  });

  it('αλλάζει όταν αλλάζει ΜΟΝΟ η κατάσταση, χωρίς να αλλάξει κανένας τοίχος', () => {
    // Το προηγούμενο δεν το ξεχωρίζει: εκεί η αποδοχή γεννά ΚΑΙ τοίχο. Εδώ «προς απόφαση» →
    // «απορρίφθηκε»: κανένα από τα δύο δεν γράφει, αλλά ο άνθρωπος είδε άλλο πράγμα.
    const base = propose();
    const index = base.items.findIndex((i) => i.status === 'needs-decision');
    const restated: WallProposal = {
      ...base,
      items: base.items.map((item, k) => (k === index ? { ...item, status: 'rejected' as const } : item)),
    };
    expect(index).toBeGreaterThanOrEqual(0);
    expect(restated.items.map((i) => i.wall)).toEqual(base.items.map((i) => i.wall));
    expect(wallProposalSignature(restated)).not.toBe(wallProposalSignature(base));
  });

  it('αλλάζει όταν αλλάζει ο ΤΥΠΟΣ τοίχου που θα γραφτεί, με ίδια γεωμετρία', () => {
    const typed = (typeId: string): WallProposal => propose({ typeWall: (wall) => ({ ...wall, typeId }) });
    const a = typed('type-a');
    const b = typed('type-b');
    expect(a.walls.map((w) => w.params)).toEqual(b.walls.map((w) => w.params));
    expect(wallProposalSignature(a)).not.toBe(wallProposalSignature(b));
    expect(wallProposalSignature(typed('type-a'))).toBe(wallProposalSignature(a));
  });
});

describe('ADR-929 Φ5.2ε — τοίχοι ανεπιβεβαίωτης ομάδας στην προεπισκόπηση', () => {
  it('φωτίζεται το ανιχνευμένο ορθογώνιο (όχι σώμα τοίχου): δεν θα γραφτεί, άρα δεν έχει σώμα να κοπεί', () => {
    const p = proposeUnconfirmed();
    const zones = buildAssistantPreview(p, ENTITIES).zones.filter((z) => z.status === 'unconfirmed');
    expect(zones).toHaveLength(countProposalByStatus(p).unconfirmed);
    const byKey = new Map(p.items.map((i) => [i.key, i] as const));
    for (const zone of zones) {
      expect(zone.pieces).toEqual([byKey.get(zone.key)?.rect.polygon.map((q) => ({ x: q.x, y: q.y }))]);
    }
  });

  it('η επιβεβαίωση αλλάζει το αποτύπωμα: ο άνθρωπος εγκρίνει ό,τι είδε', () => {
    expect(wallProposalSignature(propose())).not.toBe(wallProposalSignature(proposeUnconfirmed()));
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
    expect(counts).toEqual({ ready: 38, unconfirmed: 0, 'needs-decision': 2, existing: 0, rejected: 0 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(p.items.length);
  });
});
