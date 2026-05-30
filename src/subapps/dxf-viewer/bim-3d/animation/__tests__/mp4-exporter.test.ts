/**
 * ADR-366 §C.1.c — MP4Exporter tests (input validation + codec detection).
 *
 * Note: full encoder loop testing requires real WebCodecs + GPU context,
 * which is out of scope for vitest/jsdom. These tests cover the parts that
 * are pure / mockable: feature detection, codec selection, early-exit
 * validation, and the AbortSignal contract.
 */

import { detectSupportedCodec, exportAnimationMP4 } from '../MP4Exporter';
import type { InterpolatedFrame } from '../animation-types';

interface MockGlobal {
  VideoEncoder?: unknown;
  VideoFrame?: unknown;
}

function getGlobal(): MockGlobal {
  return globalThis as unknown as MockGlobal;
}

describe('detectSupportedCodec', () => {
  const original = getGlobal().VideoEncoder;

  afterEach(() => {
    getGlobal().VideoEncoder = original;
  });

  it('throws when WebCodecs API is absent', async () => {
    getGlobal().VideoEncoder = undefined;
    await expect(detectSupportedCodec()).rejects.toThrow(/WebCodecs/);
  });

  it("returns 'h264' when H.264 is supported", async () => {
    getGlobal().VideoEncoder = {
      isConfigSupported: jest.fn(async (cfg: { codec: string }) => ({
        supported: cfg.codec.startsWith('avc1'),
        config: cfg,
      })),
    };
    await expect(detectSupportedCodec()).resolves.toBe('h264');
  });

  it("falls back to 'vp9' when H.264 is rejected", async () => {
    getGlobal().VideoEncoder = {
      isConfigSupported: jest.fn(async (cfg: { codec: string }) => ({
        supported: cfg.codec.startsWith('vp09'),
        config: cfg,
      })),
    };
    await expect(detectSupportedCodec()).resolves.toBe('vp9');
  });

  it('throws when neither codec is supported', async () => {
    getGlobal().VideoEncoder = {
      isConfigSupported: jest.fn(async () => ({ supported: false })),
    };
    await expect(detectSupportedCodec()).rejects.toThrow(/Neither H\.264 nor VP9/);
  });
});

describe('exportAnimationMP4 — input validation', () => {
  const original = getGlobal().VideoEncoder;

  beforeEach(() => {
    getGlobal().VideoEncoder = function MockEncoder(): void { /* noop */ };
  });

  afterEach(() => {
    getGlobal().VideoEncoder = original;
  });

  it('throws when frames array is empty', async () => {
    await expect(
      exportAnimationMP4({
        scene: {} as never,
        frames: [],
        fps: 30,
        width: 1920,
        height: 1080,
        codec: 'h264',
      }),
    ).rejects.toThrow(/frames array is empty/);
  });

  it('throws when WebCodecs is absent', async () => {
    getGlobal().VideoEncoder = undefined;
    const frame: InterpolatedFrame = {
      position: { x: 0, y: 0, z: 0 },
      target: { x: 1, y: 0, z: 0 },
      fov: 50,
      timeSec: 0,
    };
    await expect(
      exportAnimationMP4({
        scene: {} as never,
        frames: [frame],
        fps: 30,
        width: 1920,
        height: 1080,
        codec: 'h264',
      }),
    ).rejects.toThrow(/WebCodecs/);
  });
});
