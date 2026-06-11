/**
 * ADR-441 Slice 0 — Guide binding hosting types tests.
 *
 * Verifies τις pure helpers (`extractBoundGuideIds`, `hasGuideBindings`) +
 * το Zod `GuideBindingSchema` + backward-compatibility (entity χωρίς bindings).
 * Pure functions — μηδέν mocks.
 */

import {
  extractBoundGuideIds,
  hasGuideBindings,
  type GuideBinding,
  type HostedEntityMixin,
} from '../guide-binding-types';
import {
  GuideBindingSchema,
  GuideBindingsSchema,
} from '../../types/guide-binding.schemas';

const bindings: readonly GuideBinding[] = [
  { guideId: 'guide_X_A', slot: 'start-x' },
  { guideId: 'guide_X_A', slot: 'end-x' },
  { guideId: 'guide_Y_1', slot: 'start-y' },
  { guideId: 'guide_Y_2', slot: 'end-y' },
];

describe('extractBoundGuideIds', () => {
  it('returns unique guide ids (de-dups repeated guideId across slots)', () => {
    expect(extractBoundGuideIds(bindings)).toEqual([
      'guide_X_A',
      'guide_Y_1',
      'guide_Y_2',
    ]);
  });

  it('returns empty array for no bindings', () => {
    expect(extractBoundGuideIds([])).toEqual([]);
  });
});

describe('hasGuideBindings', () => {
  it('is true when entity has at least one binding', () => {
    const entity: HostedEntityMixin = { guideBindings: bindings };
    expect(hasGuideBindings(entity)).toBe(true);
  });

  it('is false when guideBindings is undefined (unhosted entity)', () => {
    expect(hasGuideBindings({})).toBe(false);
  });

  it('is false when guideBindings is an empty array', () => {
    expect(hasGuideBindings({ guideBindings: [] })).toBe(false);
  });
});

describe('GuideBindingSchema', () => {
  it('accepts a valid binding', () => {
    expect(GuideBindingSchema.safeParse(bindings[0]).success).toBe(true);
  });

  it('rejects an unknown slot', () => {
    expect(
      GuideBindingSchema.safeParse({ guideId: 'g1', slot: 'top-z' }).success,
    ).toBe(false);
  });

  it('rejects an empty guideId', () => {
    expect(
      GuideBindingSchema.safeParse({ guideId: '', slot: 'start-x' }).success,
    ).toBe(false);
  });

  it('rejects extra keys (strict)', () => {
    expect(
      GuideBindingSchema.safeParse({
        guideId: 'g1',
        slot: 'start-x',
        extra: 1,
      }).success,
    ).toBe(false);
  });
});

describe('GuideBindingsSchema (optional array — backward-compat)', () => {
  it('accepts undefined (entity persisted before hosting existed)', () => {
    expect(GuideBindingsSchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts a populated array', () => {
    expect(GuideBindingsSchema.safeParse(bindings).success).toBe(true);
  });
});
