/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΠΡΟΤΑΣΕΙΣ ΧΩΡΩΝ** (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ8.1 · Δ8.2 · Δ9.2) — ποια σημεία θέλουν πρόταση, ένας ενιαίος
 * χώρος = μία πρόταση, τι ρωτιέται ο ανιχνευτής, τι στέλνεται στην έγκριση.
 */

import {
  penProposal,
  proposalAsk,
  proposalKeyOfNode,
  proposalKeyOfSeed,
  seedsStillNeeded,
  spaceDraftOf,
  type SpaceProposal,
} from '../space-edit/tour-space-proposals';

const LIVING = { nodeId: 'living', point: { x: 2, y: 2 } };
const KITCHEN = { nodeId: 'kitchen', point: { x: 7, y: 2 } };
const HALL = { nodeId: 'hall', point: { x: 12, y: 2 } };

/** Η πρόταση του σαλονιού έπιασε ΟΛΟ τον ενιαίο χώρο σαλόνι–κουζίνα (0..9 × 0..4). */
const OPEN_PLAN: SpaceProposal = {
  key: proposalKeyOfNode('living'), spaceId: 'tspc_11111111-1111-4111-8111-111111111111',
  seed: LIVING.point, seedNodeId: 'living', source: 'detected', orthogonal: true, areaM2: 36,
  outline: [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 4 }, { x: 0, y: 4 }],
  separation: { segment: { a: { x: 6, y: 0 }, b: { x: 6, y: 4 } }, widthM: 4, otherStopIndex: 0 },
};

describe('seedsStillNeeded — Δ8.2: ένας ενιαίος χώρος = ΜΙΑ πρόταση', () => {
  it('χωρίς προτάσεις ⇒ όλα τα ακάλυπτα σημεία, με τη σειρά τους', () => {
    expect(seedsStillNeeded([LIVING, KITCHEN, HALL], [])).toEqual([LIVING, KITCHEN, HALL]);
  });

  it('η κουζίνα μέσα στην πρόταση του σαλονιού ⇒ ΔΕΝ παίρνει δική της · ο διάδρομος ναι', () => {
    expect(seedsStillNeeded([LIVING, KITCHEN, HALL], [OPEN_PLAN])).toEqual([HALL]);
  });
});

describe('proposalAsk — τι ρωτιέται ο ανιχνευτής', () => {
  it('όλα τα ΑΛΛΑ σημεία (για την πρόταση διαχωρισμού) + οι γραμμές + η πόρτα — ποτέ ο ίδιος ο σπόρος', () => {
    const line = { a: { x: 6, y: 0 }, b: { x: 6, y: 4 } };
    expect(proposalAsk(LIVING.point, 'living', [LIVING, KITCHEN], [line], 1.2)).toEqual({
      seed: { x: 2, y: 2 }, otherStops: [{ x: 7, y: 2 }], separations: [line], doorWidthM: 1.2,
    });
  });

  it('κλικ χωρίς σημείο (η αποθήκη) ⇒ όλα τα σημεία είναι «άλλα»', () => {
    expect(proposalAsk({ x: 1, y: 5 }, null, [LIVING, KITCHEN], [], 1).otherStops).toHaveLength(2);
  });
});

describe('κλειδιά προτάσεων', () => {
  it('ίδιο κλικ (±χιλιοστό) ⇒ ίδιο κλειδί · άλλο εκατοστό ⇒ άλλο', () => {
    expect(proposalKeyOfSeed({ x: 1.2341, y: -3.0004 })).toBe(proposalKeyOfSeed({ x: 1.2338, y: -2.9996 }));
    expect(proposalKeyOfSeed({ x: 1.23, y: 0 })).not.toBe(proposalKeyOfSeed({ x: 1.24, y: 0 }));
    expect(proposalKeyOfNode('a')).not.toBe(proposalKeyOfSeed({ x: 0, y: 0 }));
  });
});

describe('spaceDraftOf — τι στέλνεται στην έγκριση', () => {
  it('κορυφές όπως τις άφησε ο άνθρωπος (αντίγραφο) + πηγή + όνομα + δήλωση', () => {
    const points = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }];
    const declared = { areaM2: 6.1, source: 'engineer-study' as const };
    const draft = spaceDraftOf(points, 'manual', { room: { types: ['storage'], label: null }, declaredArea: declared });
    expect(draft).toEqual({ points, source: 'manual', room: { types: ['storage'], label: null }, declaredArea: declared });
    expect(draft.points[0]).not.toBe(points[0]);
  });
});

describe('penProposal — Δ9.5: η πένα γεννά ΠΡΟΤΑΣΗ, όχι χώρο', () => {
  it('πηγή `manual`, εμβαδόν από τις κορυφές, κλειδί από το οριστικό id, χωρίς διαχωρισμό', () => {
    const id = 'tspc_22222222-2222-4222-8222-222222222222';
    const proposal = penProposal([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: -3 }, { x: 0, y: -3 }], id);
    expect(proposal).toMatchObject({ key: `pen:${id}`, spaceId: id, source: 'manual', areaM2: 6, separation: null, seedNodeId: null });
  });
});
