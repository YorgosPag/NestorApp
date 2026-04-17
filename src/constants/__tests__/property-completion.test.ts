/**
 * Unit tests — property-completion (ADR-287 Batch 28 Completion Meter)
 *
 * Covers:
 *   - Empty residential creation scenarios → low score
 *   - Fully-populated types → 100%
 *   - operationalStatus gating (draft hide, under-construction reduce)
 *   - Per-type exemptions (storage skip finishes/systems)
 *   - Media scoring curve (photos threshold, floorplan multi-level)
 *   - Bucket color boundaries (39/40/70/71)
 *   - missingCritical ordering
 *   - Diminishing returns on photos > bonusCap
 */

import {
  assessPropertyCompleteness,
  type CompletionFormSlice,
  type CompletionMediaCounts,
} from '../property-completion';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const EMPTY_MEDIA: CompletionMediaCounts = { photos: 0, floorplan: 0 };

function emptyForm(type: string, overrides: Partial<CompletionFormSlice> = {}): CompletionFormSlice {
  return {
    type,
    operationalStatus: 'ready',
    areaGross: 0,
    areaNet: 0,
    bedrooms: 0,
    bathrooms: 0,
    orientations: [],
    condition: '',
    energyClass: '',
    heatingType: '',
    coolingType: '',
    windowFrames: '',
    glazing: '',
    flooring: [],
    interiorFeatures: [],
    securityFeatures: [],
    ...overrides,
  };
}

function fullApartment(): CompletionFormSlice {
  return {
    type: 'apartment',
    operationalStatus: 'ready',
    areaGross: 85,
    areaNet: 75,
    bedrooms: 2,
    bathrooms: 1,
    orientations: ['south'],
    condition: 'new',
    energyClass: 'B',
    heatingType: 'central',
    coolingType: 'split',
    windowFrames: 'aluminum',
    glazing: 'double',
    flooring: ['tiles'],
    interiorFeatures: ['fireplace'],
    securityFeatures: ['alarm'],
  };
}

// ─── 1. Empty creation scenarios ─────────────────────────────────────────

describe('assessPropertyCompleteness — empty creation', () => {
  it('empty residential apartment → low score (< 15%)', () => {
    const r = assessPropertyCompleteness({ formData: emptyForm('apartment'), mediaCounts: EMPTY_MEDIA });
    expect(r.percentage).toBeLessThan(15);
    expect(r.bucketColor).toBe('red');
    expect(r.shouldHide).toBe(false);
  });

  it('empty villa → very low score with orientation critical missing', () => {
    const r = assessPropertyCompleteness({ formData: emptyForm('villa'), mediaCounts: EMPTY_MEDIA });
    expect(r.percentage).toBeLessThan(10);
    expect(r.missingCritical).toContain('orientations');
    expect(r.missingCritical).toContain('bedrooms');
  });

  it('empty storage → below 40% (type-only credit), most fields exempt', () => {
    const r = assessPropertyCompleteness({ formData: emptyForm('storage'), mediaCounts: EMPTY_MEDIA });
    // Storage denominator is minimal — only type credit (2/~9) lands, so still red bucket.
    expect(r.bucketColor).toBe('red');
    expect(r.percentage).toBeLessThan(40);
    // storage exempts orientations, bedrooms, bathrooms, finishes, ΠΕΑ, systems
    expect(r.exemptFields).toEqual(
      expect.arrayContaining([
        'orientations', 'bedrooms', 'bathrooms', 'energyClass',
        'heatingType', 'coolingType', 'windowFrames', 'glazing',
        'flooring', 'interiorFeatures',
      ]),
    );
  });
});

// ─── 2. Full happy path ─────────────────────────────────────────────────

describe('assessPropertyCompleteness — fully populated', () => {
  it('fully-completed apartment with optimal media → 100%', () => {
    const media: CompletionMediaCounts = { photos: 8, floorplan: 1 };
    const r = assessPropertyCompleteness({ formData: fullApartment(), mediaCounts: media });
    expect(r.percentage).toBe(100);
    expect(r.bucketColor).toBe('green');
    expect(r.missingCritical).toHaveLength(0);
  });

  it('fully-completed apartment with min photos → slightly below 100%', () => {
    const media: CompletionMediaCounts = { photos: 5, floorplan: 1 };
    const r = assessPropertyCompleteness({ formData: fullApartment(), mediaCounts: media });
    // Photos at minimum threshold → 0.5 credit of 2 weight = 1.0 earned vs 2.0 expected
    expect(r.percentage).toBeLessThan(100);
    expect(r.percentage).toBeGreaterThanOrEqual(90);
  });

  it('fully-completed storage with 2 photos + 1 floorplan → 100%', () => {
    const form = emptyForm('storage', {
      type: 'storage',
      areaGross: 8,
      areaNet: 7,
      condition: 'new',
      securityFeatures: ['alarm'],
    });
    const media: CompletionMediaCounts = { photos: 2, floorplan: 1 };
    const r = assessPropertyCompleteness({ formData: form, mediaCounts: media });
    expect(r.percentage).toBe(100);
  });
});

// ─── 3. operationalStatus gating ─────────────────────────────────────────

describe('assessPropertyCompleteness — operationalStatus gating', () => {
  it('draft status → shouldHide = true', () => {
    const r = assessPropertyCompleteness({
      formData: emptyForm('apartment', { operationalStatus: 'draft' }),
      mediaCounts: EMPTY_MEDIA,
    });
    expect(r.shouldHide).toBe(true);
  });

  it('ready status → shouldHide = false', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 8, floorplan: 1 },
    });
    expect(r.shouldHide).toBe(false);
  });

  it('under-construction → finishes/systems/ΠΕΑ exempt', () => {
    const form = emptyForm('apartment', {
      operationalStatus: 'under-construction',
      areaGross: 85,
      areaNet: 75,
      bedrooms: 2,
      bathrooms: 1,
      orientations: ['south'],
      condition: 'new',
    });
    const r = assessPropertyCompleteness({ formData: form, mediaCounts: { photos: 0, floorplan: 1 } });
    expect(r.exemptFields).toEqual(
      expect.arrayContaining([
        'energyClass', 'heatingType', 'coolingType', 'windowFrames',
        'glazing', 'flooring', 'interiorFeatures',
      ]),
    );
  });

  it('under-construction → photos weight halved', () => {
    const form = emptyForm('apartment', {
      operationalStatus: 'under-construction',
      type: 'apartment',
      areaGross: 85,
      areaNet: 75,
      bedrooms: 2,
      bathrooms: 1,
      orientations: ['south'],
      condition: 'new',
    });
    // 0 photos → earned 0, but denominator photo weight is 1 (halved from 2)
    const noPhotos = assessPropertyCompleteness({ formData: form, mediaCounts: { photos: 0, floorplan: 1 } });
    const photoEntry = noPhotos.breakdown.find((b) => b.fieldKey === 'photos');
    expect(photoEntry?.weight).toBe(1);
  });

  it('inspection status → full scoring (no exemptions)', () => {
    const form = { ...fullApartment(), operationalStatus: 'inspection' };
    const r = assessPropertyCompleteness({ formData: form, mediaCounts: { photos: 8, floorplan: 1 } });
    expect(r.exemptFields).toHaveLength(0);
    expect(r.percentage).toBe(100);
  });
});

// ─── 4. Media scoring curve ─────────────────────────────────────────────

describe('assessPropertyCompleteness — media scoring', () => {
  it('photos = 0 → photos status missing', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 0, floorplan: 1 },
    });
    const photos = r.breakdown.find((b) => b.fieldKey === 'photos');
    expect(photos?.status).toBe('missing');
    expect(photos?.earned).toBe(0);
  });

  it('photos in [min, optimal) → partial status', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 6, floorplan: 1 },
    });
    const photos = r.breakdown.find((b) => b.fieldKey === 'photos');
    expect(photos?.status).toBe('partial');
    expect(photos?.earned).toBeGreaterThan(0);
    expect(photos?.earned).toBeLessThan(photos?.weight ?? 0);
  });

  it('photos ≥ optimal → complete status, full earned', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 8, floorplan: 1 },
    });
    const photos = r.breakdown.find((b) => b.fieldKey === 'photos');
    expect(photos?.status).toBe('complete');
    expect(photos?.earned).toBe(photos?.weight ?? 0);
  });

  it('diminishing returns — photos >> bonusCap identical to optimal', () => {
    const atOptimal = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 8, floorplan: 1 },
    });
    const wayBeyond = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 100, floorplan: 1 },
    });
    expect(atOptimal.percentage).toBe(wayBeyond.percentage);
  });

  it('floorplan multi-level — 1 of 2 levels → partial', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 8, floorplan: 1 },
      levelCount: 2,
    });
    const fp = r.breakdown.find((b) => b.fieldKey === 'floorplan');
    expect(fp?.status).toBe('partial');
    expect(fp?.earned).toBeCloseTo((fp?.weight ?? 0) * 0.5, 5);
  });

  it('floorplan multi-level — N of N levels → complete', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 8, floorplan: 3 },
      levelCount: 3,
    });
    const fp = r.breakdown.find((b) => b.fieldKey === 'floorplan');
    expect(fp?.status).toBe('complete');
  });
});

// ─── 5. Bucket color boundaries ─────────────────────────────────────────

describe('assessPropertyCompleteness — bucket colors', () => {
  it('percentage < 40 → red', () => {
    const r = assessPropertyCompleteness({ formData: emptyForm('apartment'), mediaCounts: EMPTY_MEDIA });
    expect(r.bucketColor).toBe('red');
    expect(r.percentage).toBeLessThan(40);
  });

  it('percentage in [40, 70] → amber', () => {
    const form = emptyForm('apartment', {
      type: 'apartment',
      areaGross: 85,
      areaNet: 75,
      bedrooms: 2,
      bathrooms: 1,
      orientations: ['south'],
      condition: 'new',
      energyClass: 'B',
    });
    const r = assessPropertyCompleteness({ formData: form, mediaCounts: { photos: 3, floorplan: 1 } });
    expect(r.bucketColor).toBe('amber');
    expect(r.percentage).toBeGreaterThanOrEqual(40);
    expect(r.percentage).toBeLessThanOrEqual(70);
  });

  it('percentage > 70 → green', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: 8, floorplan: 1 },
    });
    expect(r.bucketColor).toBe('green');
    expect(r.percentage).toBeGreaterThan(70);
  });
});

// ─── 6. missingCritical ordering ────────────────────────────────────────

describe('assessPropertyCompleteness — missing ordering', () => {
  it('missingCritical sorted by weight desc', () => {
    const r = assessPropertyCompleteness({
      formData: emptyForm('apartment'),
      mediaCounts: EMPTY_MEDIA,
    });
    // All weights should be descending
    const weights = r.missingCritical.map((key) => {
      return r.breakdown.find((b) => b.fieldKey === key)?.weight ?? 0;
    });
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThanOrEqual(weights[i - 1]);
    }
  });

  it('missingCritical contains only critical fields', () => {
    const r = assessPropertyCompleteness({
      formData: emptyForm('apartment'),
      mediaCounts: EMPTY_MEDIA,
    });
    for (const key of r.missingCritical) {
      const entry = r.breakdown.find((b) => b.fieldKey === key);
      expect(entry?.critical).toBe(true);
    }
  });

  it('missing includes non-critical fields too', () => {
    const r = assessPropertyCompleteness({
      formData: emptyForm('apartment'),
      mediaCounts: EMPTY_MEDIA,
    });
    // apartment has bathrooms weight=1 non-critical, should appear in missing
    expect(r.missing).toContain('bathrooms');
    expect(r.missingCritical).not.toContain('bathrooms');
  });
});

// ─── 7. Per-type exemption integrity ────────────────────────────────────

describe('assessPropertyCompleteness — per-type exemptions', () => {
  it('shop skips orientations + bedrooms from denominator', () => {
    const r = assessPropertyCompleteness({ formData: emptyForm('shop'), mediaCounts: EMPTY_MEDIA });
    expect(r.exemptFields).toContain('orientations');
    expect(r.exemptFields).toContain('bedrooms');
  });

  it('hall has minimal denominator — no heating/cooling/finishes/features', () => {
    const r = assessPropertyCompleteness({ formData: emptyForm('hall'), mediaCounts: EMPTY_MEDIA });
    expect(r.exemptFields).toEqual(
      expect.arrayContaining([
        'heatingType', 'coolingType', 'windowFrames', 'glazing',
        'flooring', 'interiorFeatures', 'bedrooms',
      ]),
    );
  });

  it('villa requires orientations as critical (standalone)', () => {
    const form = emptyForm('villa', { operationalStatus: 'ready' });
    const r = assessPropertyCompleteness({ formData: form, mediaCounts: EMPTY_MEDIA });
    expect(r.missingCritical).toContain('orientations');
    // Find the weight for orientations in villa — should be 2 (critical)
    const orient = r.breakdown.find((b) => b.fieldKey === 'orientations');
    expect(orient?.weight).toBe(2);
    expect(orient?.critical).toBe(true);
  });
});

// ─── 8. Edge cases ──────────────────────────────────────────────────────

describe('assessPropertyCompleteness — edge cases', () => {
  it('unknown property type → falls back to apartment matrix', () => {
    const form = emptyForm('unknown-type-xyz');
    const r = assessPropertyCompleteness({ formData: form, mediaCounts: EMPTY_MEDIA });
    // apartment denominator has ~14 active fields, so denominator > 10
    expect(r.weightTotal).toBeGreaterThan(10);
  });

  it('empty type string → falls back to apartment matrix', () => {
    const form = emptyForm('');
    const r = assessPropertyCompleteness({ formData: form, mediaCounts: EMPTY_MEDIA });
    expect(r.weightTotal).toBeGreaterThan(0);
  });

  it('score is deterministic across repeated calls', () => {
    const form = fullApartment();
    const media = { photos: 7, floorplan: 1 };
    const a = assessPropertyCompleteness({ formData: form, mediaCounts: media });
    const b = assessPropertyCompleteness({ formData: form, mediaCounts: media });
    expect(a).toEqual(b);
  });

  it('negative photo count is clamped to 0', () => {
    const r = assessPropertyCompleteness({
      formData: fullApartment(),
      mediaCounts: { photos: -5, floorplan: 1 },
    });
    const photos = r.breakdown.find((b) => b.fieldKey === 'photos');
    expect(photos?.earned).toBe(0);
  });
});
