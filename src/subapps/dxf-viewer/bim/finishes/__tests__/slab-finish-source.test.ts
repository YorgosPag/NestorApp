/**
 * ADR-534 Φ5 — Η ΠΛΑΚΑ ως finish-member του σοβά (mirror του `wall-finish-source.test.ts`).
 *
 * Επαληθεύει το SSoT predicate «η πλάκα δικαιούται additive σοβά» + τα helpers του:
 *   (1) `slabKindTakesFinish` — floor/ceiling/roof ΝΑΙ· ground/foundation ΟΧΙ (Απόφαση Γ)·
 *   (2) `slabDnaHasPlaster` — roof/floor buildup (Plaster Soffit) → true· ground/foundation/
 *       undefined → false (blinding/μόνωση/υγρομόνωση ΔΕΝ είναι σοβάς)·
 *   (3) `slabIsFinishMember` — ΚΑΙ τα τρία gates (kind + active finish + όχι DNA-plaster)·
 *   (4) `slabFinishZExtent` — top-face convention (ADR-369 §2.1: κρέμεται προς τα κάτω).
 *
 * Dormant phase: κανένας consumer στη σκηνή ακόμη — αυτά τα tests κλειδώνουν το data model
 * predicate ΠΡΙΝ το Φ2 το καταναλώσει.
 */

import {
  slabKindTakesFinish,
  slabDnaHasPlaster,
  slabIsFinishMember,
  slabFinishZExtent,
  type SlabFinishSource,
} from '../slab-finish-source';
import { createDefaultStructuralFinishSpec, type StructuralFinishSpec } from '../structural-finish-types';
import {
  createDefaultFloorBuildup,
  createDefaultRoofBuildup,
  createDefaultGroundBuildup,
  createDefaultFoundationBuildup,
} from '../../types/slab-dna-types';
import type { SlabDna } from '../../types/slab-dna-types';
import type { SlabKind } from '../../types/slab-types';

const src = (kind: SlabKind, finish?: StructuralFinishSpec, dna?: SlabDna): SlabFinishSource => ({
  params: { kind, finish, dna },
});
const activeFinish = createDefaultStructuralFinishSpec();

describe('slabKindTakesFinish (Απόφαση Γ — τεκμηρίωση από κώδικα)', () => {
  it('floor/ceiling/roof (αναρτημένες, εκτεθειμένη κάτω παρειά) → true', () => {
    expect(slabKindTakesFinish('floor')).toBe(true);
    expect(slabKindTakesFinish('ceiling')).toBe(true);
    expect(slabKindTakesFinish('roof')).toBe(true);
  });
  it('ground (blinding+waterproofing, πατά σε μπετόν) → false', () => {
    expect(slabKindTakesFinish('ground')).toBe(false);
  });
  it('foundation (no soffit, bears on soil — slab-dna-types.ts:98) → false', () => {
    expect(slabKindTakesFinish('foundation')).toBe(false);
  });
});

describe('slabDnaHasPlaster (X4 legacy/buildup detection — mirror wallDnaHasPlaster)', () => {
  it('roof buildup (Plaster Soffit 15, zone bottom) → true', () => {
    expect(slabDnaHasPlaster(createDefaultRoofBuildup())).toBe(true);
  });
  it('floor buildup (Plaster Soffit 15) → true', () => {
    expect(slabDnaHasPlaster(createDefaultFloorBuildup())).toBe(true);
  });
  it('ground buildup (blinding concrete στο bottom, όχι σοβάς) → false', () => {
    expect(slabDnaHasPlaster(createDefaultGroundBuildup())).toBe(false);
  });
  it('foundation buildup (core + blinding, no soffit) → false', () => {
    expect(slabDnaHasPlaster(createDefaultFoundationBuildup())).toBe(false);
  });
  it('undefined DNA → false', () => {
    expect(slabDnaHasPlaster(undefined)).toBe(false);
  });
  it('η μόνωση/υγρομόνωση του roof buildup δεν μετράει (μόνο το mat-plaster layer)', () => {
    const dna: SlabDna = {
      layers: [
        { id: 'x-thermal', name: 'XPS', thickness: 80, materialId: 'mat-insulation', zone: 'top' },
        { id: 'x-membrane', name: 'Membrane', thickness: 5, materialId: 'mat-membrane', zone: 'top' },
        { id: 'x-core', name: 'RC', thickness: 200, materialId: 'mat-concrete', zone: 'core' },
      ],
      totalThickness: 285,
    };
    expect(slabDnaHasPlaster(dna)).toBe(false);
  });
});

describe('slabIsFinishMember (SSoT predicate — 3 gates)', () => {
  it('floor + active finish + χωρίς DNA → true', () => {
    expect(slabIsFinishMember(src('floor', activeFinish))).toBe(true);
  });
  it('ground + active finish → false (kind gate, Απόφαση Γ)', () => {
    expect(slabIsFinishMember(src('ground', activeFinish))).toBe(false);
  });
  it('foundation + active finish → false (kind gate)', () => {
    expect(slabIsFinishMember(src('foundation', activeFinish))).toBe(false);
  });
  it('floor χωρίς finish spec (legacy persisted) → false (μηδέν migration)', () => {
    expect(slabIsFinishMember(src('floor', undefined))).toBe(false);
  });
  it('floor + disabled finish → false', () => {
    expect(slabIsFinishMember(src('floor', { ...activeFinish, enabled: false }))).toBe(false);
  });
  it('floor + finish πάχους 0 → false', () => {
    expect(slabIsFinishMember(src('floor', { ...activeFinish, thickness: 0 }))).toBe(false);
  });
  it('roof + active finish ΑΛΛΑ DNA με Plaster Soffit → false (μηδέν διπλό δέρμα)', () => {
    expect(slabIsFinishMember(src('roof', activeFinish, createDefaultRoofBuildup()))).toBe(false);
  });
  it('roof + active finish + DNA ΧΩΡΙΣ σοβά (μόνο core) → true', () => {
    const bareRc: SlabDna = {
      layers: [{ id: 'rc', name: 'RC', thickness: 200, materialId: 'mat-concrete', zone: 'core' }],
      totalThickness: 200,
    };
    expect(slabIsFinishMember(src('roof', activeFinish, bareRc))).toBe(true);
  });
});

describe('slabFinishZExtent (ADR-369 §2.1 — top face κρέμεται προς τα κάτω)', () => {
  it('levelElevation = πάνω παρειά· zBot = zTop − thickness', () => {
    expect(slabFinishZExtent({ levelElevation: 3000, thickness: 200 })).toEqual({
      zBotMm: 2800,
      zTopMm: 3000,
    });
  });
  it('heightOffsetFromLevel μετακινεί ΚΑΙ τις δύο παρειές', () => {
    expect(slabFinishZExtent({ levelElevation: 3000, heightOffsetFromLevel: 50, thickness: 200 })).toEqual({
      zBotMm: 2850,
      zTopMm: 3050,
    });
  });
});
