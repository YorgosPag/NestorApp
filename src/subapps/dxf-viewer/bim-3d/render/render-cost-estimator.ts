/**
 * render-cost-estimator.ts — ADR-366 §B.4 Phase 6
 *
 * Pure computation: estimates render time + output size before the user starts.
 * Zero React, zero Firestore. GPU calibration via a one-shot timed render.
 */

export interface RenderEstimate {
  seconds: number;
  marginPercent: number;
  outputMB: number;
}

export interface RenderParams {
  presetSPP: 64 | 256 | 1024 | 4096;
  resolutionW: number;
  resolutionH: number;
  format: 'png' | 'jpg' | 'exr';
  samplesPerSecondGpu: number;
}

/** Bytes per pixel per format (approximate for size estimation). */
const BYTES_PER_PIXEL: Record<RenderParams['format'], number> = {
  png: 4,    // RGBA 8bpc lossless
  jpg: 1.5,  // compressed, ~50% of raw
  exr: 12,   // RGBA 16bpc float uncompressed
};

/**
 * Estimates render cost for a single frame.
 * All inputs are numbers, result is deterministic — no side effects.
 */
export function estimateRender(params: RenderParams): RenderEstimate {
  const { presetSPP, resolutionW, resolutionH, format, samplesPerSecondGpu } = params;
  const pixels = resolutionW * resolutionH;
  const totalSamples = pixels * presetSPP;

  // Guard against zero GPU score (calibration not done yet)
  const gpuRate = samplesPerSecondGpu > 0 ? samplesPerSecondGpu : 1_000_000;
  const rawSeconds = totalSamples / gpuRate;

  // Higher SPP = more uncertainty (thermal throttling, scene variance)
  const marginPercent = presetSPP <= 64 ? 15 : presetSPP <= 256 ? 20 : 30;

  const outputMB = (pixels * BYTES_PER_PIXEL[format]) / 1_048_576;

  return { seconds: rawSeconds, marginPercent, outputMB };
}

/**
 * Runs a ~50ms GPU benchmark: renders one path-trace sample and measures elapsed.
 * Returns derived samplesPerSecondGpu.
 *
 * Caller passes a render callback — avoids importing Three.js / pathTracer here.
 */
export async function calibrateGpu(
  renderOneSample: () => void,
  pixels: number,
): Promise<number> {
  const WARMUP_SAMPLES = 4;
  for (let i = 0; i < WARMUP_SAMPLES; i++) renderOneSample();

  const MEASURE_SAMPLES = 8;
  const t0 = performance.now();
  for (let i = 0; i < MEASURE_SAMPLES; i++) renderOneSample();
  const elapsed = performance.now() - t0;

  const msPerSample = elapsed / MEASURE_SAMPLES;
  const samplesPerMs = 1 / msPerSample;
  return samplesPerMs * 1000 * pixels;
}
