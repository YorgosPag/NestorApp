/**
 * ⚓ ADR-929 Φ5.3γ — ο ελεγκτής της κάρτας κλίμακας. Κλειδώνει:
 * - «Εφαρμογή» γράφει **μόνο** από τη μία πόρτα (`commit`), **με τη λύση της κάρτας**·
 * - μπαγιάτικη βάση (άλλη σύντηξη ή άλλη θέση εικόνας) ⇒ `stale`, **καμία** εγγραφή·
 * - μετά την εγγραφή η σύντηξη ακολουθεί τη νέα κλίμακα (η κάρτα γίνεται «επιβεβαιωμένη»)·
 * - `syncKnownScale` ιδεμποτικό: ίδια κλίμακα ⇒ τίποτα·
 * - αποτυχία εγγραφής ⇒ καμία νέα πηγή γραμμών.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fusePlan } from '../../../bim/plan-recognition/fusion/plan-fusion';
import type { PlanFusionResult } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReadingOutcome } from '../../../bim/plan-recognition/plan-recognition-types';
import type { BackgroundTransform, CalibrationData, FloorplanBackground } from '../../../floorplan-background/providers/types';
import type { CalibrationCommitResult } from '../../../floorplan-background/services/commit-calibration';
import { planRecognitionStore, type PlanRecognitionRun } from '../plan-recognition-store';
import { createPlanScaleController, type PlanScaleControllerDeps } from '../plan-scale-controller';
import { fusionInput, houseDimensions, houseSegments, reading } from '../../../bim/plan-recognition/fusion/__tests__/fusion-fixture';

const FLOOR = 'flr_1';
const { texts, dimensions } = houseDimensions();
const READ: PlanReadingOutcome = { status: 'read', reading: reading({ texts, dimensions }) };
const BASE = fusionInput({ segments: houseSegments(), reading: READ });

const RUN: PlanRecognitionRun = {
  id: 'rec1', floorId: FLOOR, backgroundId: 'bg_1', kind: 'scan', alignment: BASE.alignment, segments: BASE.segments, knownScale: null,
};

function backgroundOf(transform: BackgroundTransform, calibration: CalibrationData | null): FloorplanBackground {
  return {
    id: 'bg_1', companyId: 'cmp', floorId: FLOOR, fileId: 'file_1', providerId: 'image', providerMetadata: {},
    naturalBounds: { width: 500, height: 400 }, transform, calibration,
    opacity: 1, visible: true, locked: false, createdAt: 0, updatedAt: 0, createdBy: 'u', updatedBy: 'u',
  };
}

const START: BackgroundTransform = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 };

function harness(commitResult: CalibrationCommitResult['status'] = 'saved') {
  let background = backgroundOf(START, null);
  const adopted: PlanFusionResult[] = [];
  const commit = jest.fn(async (_floorId: string, transform: BackgroundTransform, data: CalibrationData): Promise<CalibrationCommitResult> => {
    if (commitResult !== 'failed') background = backgroundOf(transform, data);
    return { status: commitResult, overlaysSkipped: 0 };
  });
  const deps: PlanScaleControllerDeps<string> = {
    fuse: (run, r) => fusePlan({ ...BASE, reading: r, knownScale: run.knownScale }),
    adoptFusion: (run, fusion) => {
      planRecognitionStore.patch({ run, fusion });
      adopted.push(fusion);
      return `source-${adopted.length}`;
    },
    background: () => background,
    commit,
    now: () => 42,
  };
  const controller = createPlanScaleController(() => deps);
  return { controller, commit, adopted, moveImage: (t: BackgroundTransform) => { background = backgroundOf(t, background.calibration); } };
}

beforeEach(() => {
  planRecognitionStore.patch({ phase: 'ready', run: RUN, reading: READ, fusion: fusePlan(BASE), failure: null, scaleHoverTextId: null });
});
afterEach(() => planRecognitionStore.reset());

const proposalOf = (h: ReturnType<typeof harness>) => {
  const card = h.controller.card(backgroundOf(START, null), 'mm');
  if (card?.kind !== 'proposal') throw new Error('expected a proposal');
  return card;
};

describe('planScaleController.apply', () => {
  it('γράφει τη λύση της κάρτας από τη μία πόρτα, και η σύντηξη ακολουθεί τη νέα κλίμακα', async () => {
    const h = harness();
    const proposal = proposalOf(h);
    const result = await h.controller.apply(proposal);
    expect(h.commit).toHaveBeenCalledTimes(1);
    const [floorId, transform, data] = h.commit.mock.calls[0];
    expect(floorId).toBe(FLOOR);
    expect(transform).toBe(proposal.solution.transform);
    expect(data.origin).toBe('plan-dimensions');
    expect(result).toEqual({ status: 'saved', overlaysSkipped: 0, source: 'source-1' });
    expect(planRecognitionStore.get().run?.knownScale).not.toBeNull();
    expect(h.controller.card(backgroundOf(transform, data), 'mm')?.kind).toBe('confirmed');
  });

  it('🔴 η θέση της εικόνας άλλαξε μετά την κάρτα ⇒ stale, καμία εγγραφή', async () => {
    const h = harness();
    const proposal = proposalOf(h);
    h.moveImage({ ...START, translateX: 3 });
    await expect(h.controller.apply(proposal)).resolves.toEqual({ status: 'stale', overlaysSkipped: 0, source: null });
    expect(h.commit).not.toHaveBeenCalled();
  });

  it('🔴 νέα σύντηξη μετά την κάρτα ⇒ stale, καμία εγγραφή', async () => {
    const h = harness();
    const proposal = proposalOf(h);
    planRecognitionStore.patch({ fusion: fusePlan(BASE) });
    await expect(h.controller.apply(proposal)).resolves.toMatchObject({ status: 'stale' });
    expect(h.commit).not.toHaveBeenCalled();
  });

  it('αποτυχία εγγραφής ⇒ καμία νέα πηγή γραμμών, η σύντηξη μένει ως είχε', async () => {
    const h = harness('failed');
    const before = planRecognitionStore.get().fusion;
    await expect(h.controller.apply(proposalOf(h))).resolves.toEqual({ status: 'failed', overlaysSkipped: 0, source: null });
    expect(planRecognitionStore.get().fusion).toBe(before);
  });
});

describe('planScaleController.syncKnownScale', () => {
  it('ιδεμποτικό: ίδια κλίμακα ⇒ τίποτα· άλλος όροφος ⇒ τίποτα', async () => {
    const h = harness();
    expect(h.controller.syncKnownScale(FLOOR)).toBeNull();
    expect(h.controller.syncKnownScale('flr_other')).toBeNull();
    await h.controller.apply(proposalOf(h));
    expect(h.controller.syncKnownScale(FLOOR)).toBeNull();
    expect(h.adopted).toHaveLength(1);
  });
});

describe('planScaleController — κάρτα και καμβάς λένε το ίδιο', () => {
  it('οι αναφορές του καμβά είναι οι αναφορές της κάρτας', () => {
    const h = harness();
    expect(h.controller.references()).toEqual(proposalOf(h).references);
  });

  it('hover: γράφει μόνο όταν αλλάζει', () => {
    const h = harness();
    const listener = jest.fn();
    const unsubscribe = planRecognitionStore.subscribe(listener);
    h.controller.hover('t-west');
    h.controller.hover('t-west');
    expect(planRecognitionStore.get().scaleHoverTextId).toBe('t-west');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
