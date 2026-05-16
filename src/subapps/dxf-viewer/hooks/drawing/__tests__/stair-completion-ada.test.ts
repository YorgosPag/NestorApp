/**
 * ADR-358 Phase 6.5 — ADA auto-default pacchetto coherent (Q26).
 *
 * `buildDefaultStairParams` must auto-apply the ADA accessibility pacchetto
 * when `codeProfile === 'ada'`: handrails on both sides, height ∈ [864, 965],
 * topExtension ≥ 305mm, bottomExtension === 'one-tread', adaContrastStrip on.
 * Caller overrides must always win over the auto-default.
 *
 * @see ../stair-completion.ts
 */

import { buildDefaultStairParams } from '../stair-completion';

const BASE = { x: 100, y: 200 };

describe('buildDefaultStairParams — ADA auto-default (Q26)', () => {
  test('codeProfile=ada sets handrails.topExtension to 305', () => {
    const p = buildDefaultStairParams(BASE, 0, { codeProfile: 'ada' });
    expect(p.handrails.topExtension).toBe(305);
  });

  test('codeProfile=ada sets handrails.bottomExtension to "one-tread"', () => {
    const p = buildDefaultStairParams(BASE, 0, { codeProfile: 'ada' });
    expect(p.handrails.bottomExtension).toBe('one-tread');
  });

  test('codeProfile=ada sets adaContrastStrip to true', () => {
    const p = buildDefaultStairParams(BASE, 0, { codeProfile: 'ada' });
    expect(p.adaContrastStrip).toBe(true);
  });

  test('codeProfile=ada enables both inner and outer handrails', () => {
    const p = buildDefaultStairParams(BASE, 0, { codeProfile: 'ada' });
    expect(p.handrails.inner).toBe(true);
    expect(p.handrails.outer).toBe(true);
  });

  test('codeProfile=ada handrail height within ADA [864, 965] range', () => {
    const p = buildDefaultStairParams(BASE, 0, { codeProfile: 'ada' });
    expect(p.handrails.height).toBeGreaterThanOrEqual(864);
    expect(p.handrails.height).toBeLessThanOrEqual(965);
  });

  test('explicit handrails.topExtension override preserved over ADA default', () => {
    const p = buildDefaultStairParams(BASE, 0, {
      codeProfile: 'ada',
      handrails: { topExtension: 500 },
    });
    expect(p.handrails.topExtension).toBe(500);
    expect(p.handrails.bottomExtension).toBe('one-tread');
  });

  test('explicit adaContrastStrip=false override preserved over ADA default', () => {
    const p = buildDefaultStairParams(BASE, 0, {
      codeProfile: 'ada',
      adaContrastStrip: false,
    });
    expect(p.adaContrastStrip).toBe(false);
  });

  test('codeProfile=nok (default) does NOT inject ADA fields', () => {
    const p = buildDefaultStairParams(BASE, 0);
    expect(p.handrails.topExtension).toBeUndefined();
    expect(p.handrails.bottomExtension).toBeUndefined();
    expect(p.adaContrastStrip).toBe(false);
  });

  test('codeProfile=ibc does NOT inject ADA fields', () => {
    const p = buildDefaultStairParams(BASE, 0, { codeProfile: 'ibc' });
    expect(p.handrails.topExtension).toBeUndefined();
    expect(p.handrails.bottomExtension).toBeUndefined();
    expect(p.adaContrastStrip).toBe(false);
  });

  test('codeProfile=ada propagates to params.codeProfile', () => {
    const p = buildDefaultStairParams(BASE, 0, { codeProfile: 'ada' });
    expect(p.codeProfile).toBe('ada');
    expect(p.nokSubType).toBeUndefined();
  });

  test('occupancyLoad override flows into params', () => {
    const p = buildDefaultStairParams(BASE, 0, { occupancyLoad: 150 });
    expect(p.occupancyLoad).toBe(150);
  });
});
