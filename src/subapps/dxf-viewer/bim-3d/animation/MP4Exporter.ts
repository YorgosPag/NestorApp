'use client';

/**
 * ADR-366 Phase 9 / C.1.c — MP4Exporter.
 *
 * Renders a frame-by-frame animation pass to a single MP4 file using the
 * WebCodecs `VideoEncoder` API + `mp4-muxer` (MIT, N.5 compliant).
 *
 * ADR drift resolution (see §C.1.c plan): C.1.c uses the **standard
 * rasterizer per frame** (`renderer.render(scene, camera)`), NOT path
 * tracing. Reasons:
 *  - PathTracerRenderer.samplesContinueFrom never landed (§C.1.Q9 ADR text).
 *  - Path-tracing 240 frames @ 256 samples = ~4h per animation — unusable.
 *  - Industry standard (D5/Twinmotion/Lumion) rasterizes animation, path-
 *    traces only stills.
 *
 * Codec strategy (ADR §C.1.Q6):
 *  - Primary  : H.264 Main L3.1 (`avc1.4D401F`) → MP4 container
 *  - Fallback : VP9 Profile 0   (`vp09.00.10.08`) → MP4 container
 *      (Chrome/Edge play VP9-in-MP4; Firefox<137 without WebCodecs is the
 *       residual gap — full WebM fallback DEFERRED to a follow-up phase if
 *       Firefox usage requires it.)
 *
 * Encoder lifecycle:
 *   detectSupportedCodec() → exportAnimationMP4(opts) → Blob
 *
 * Cancellation: optional AbortSignal aborts mid-loop; encoder is closed
 * silently. Caller decides what to do with partial state (RenderQueueStore
 * + render-checkpoint persist the last completed frame index).
 */

import * as THREE from 'three';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { createOffscreenCaptureRenderer } from '../scene/scene-setup';
import type { AnimationCodec, AnimationFps, InterpolatedFrame } from './animation-types';

// ---------------------------------------------------------------------------
// Codec config
// ---------------------------------------------------------------------------

const H264_CODEC_STRING = 'avc1.4D401F'; // Main profile L3.1 (broad compat)
const VP9_CODEC_STRING = 'vp09.00.10.08'; // Profile 0, Level 1.0, 8-bit

interface CodecResolution {
  readonly animationCodec: AnimationCodec;
  readonly encoderCodecString: string;
  readonly muxerCodec: 'avc' | 'vp9';
}

const CODEC_RESOLUTIONS: Record<AnimationCodec, CodecResolution> = {
  h264: {
    animationCodec: 'h264',
    encoderCodecString: H264_CODEC_STRING,
    muxerCodec: 'avc',
  },
  vp9: {
    animationCodec: 'vp9',
    encoderCodecString: VP9_CODEC_STRING,
    muxerCodec: 'vp9',
  },
};

function isWebCodecsAvailable(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.VideoEncoder !== 'undefined';
}

/**
 * Detect which codec the current browser can encode. Tries H.264 first;
 * falls back to VP9. Throws if neither works (WebCodecs absent or both
 * codecs rejected — e.g. Firefox<137).
 */
export async function detectSupportedCodec(): Promise<AnimationCodec> {
  if (!isWebCodecsAvailable()) {
    throw new Error('WebCodecs API is not available in this browser');
  }
  const baseConfig = { width: 1920, height: 1080, bitrate: 5_000_000 };
  const h264 = await VideoEncoder.isConfigSupported({ ...baseConfig, codec: H264_CODEC_STRING });
  if (h264.supported) return 'h264';
  const vp9 = await VideoEncoder.isConfigSupported({ ...baseConfig, codec: VP9_CODEC_STRING });
  if (vp9.supported) return 'vp9';
  throw new Error('Neither H.264 nor VP9 is supported by this browser');
}

// ---------------------------------------------------------------------------
// Exporter
// ---------------------------------------------------------------------------

export interface MP4ExporterOptions {
  readonly scene: THREE.Scene;
  readonly frames: ReadonlyArray<InterpolatedFrame>;
  readonly fps: AnimationFps;
  readonly width: number;
  readonly height: number;
  readonly codec: AnimationCodec;
  readonly startFrameIndex?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (frameIndex: number, total: number) => void;
}

/**
 * Encode the supplied frames to an MP4 Blob.
 *
 * Per-frame loop:
 *  1. Apply position/target/fov to the camera
 *  2. `renderer.render(scene, camera)`
 *  3. `new VideoFrame(canvas, …)` → `encoder.encode(...)`
 *  4. `requestAnimationFrame` yield (keep UI responsive + GPU breathing room)
 *  5. Abort check
 *  6. Progress callback
 *
 * Returns the finalized MP4 as a Blob.
 */
export async function exportAnimationMP4(opts: MP4ExporterOptions): Promise<Blob> {
  if (opts.frames.length === 0) {
    throw new Error('exportAnimationMP4: frames array is empty');
  }
  if (!isWebCodecsAvailable()) {
    throw new Error('WebCodecs API is not available in this browser');
  }
  const resolution = CODEC_RESOLUTIONS[opts.codec];
  if (!resolution) {
    throw new Error(`Unsupported codec: ${opts.codec}`);
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: resolution.muxerCodec,
      width: opts.width,
      height: opts.height,
      frameRate: opts.fps,
    },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
    error: (err) => { throw err; },
  });

  encoder.configure({
    codec: resolution.encoderCodecString,
    width: opts.width,
    height: opts.height,
    bitrate: 5_000_000,
    framerate: opts.fps,
  });

  const microsecondsPerFrame = Math.round(1_000_000 / opts.fps);
  const start = Math.max(0, opts.startFrameIndex ?? 0);
  const total = opts.frames.length;

  const { renderer, camera } = createOffscreenRenderTarget(opts.width, opts.height, opts.frames[0]!);

  try {
    for (let i = start; i < total; i++) {
      if (opts.signal?.aborted) {
        encoder.close();
        throw new DOMException('Render cancelled', 'AbortError');
      }
      const frame = opts.frames[i]!;
      applyFrameToCamera(frame, camera);
      renderer.render(opts.scene, camera);

      const videoFrame = new VideoFrame(renderer.domElement, {
        timestamp: i * microsecondsPerFrame,
        duration: microsecondsPerFrame,
      });
      const isKeyFrame = i === start || i % opts.fps === 0;
      encoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      opts.onProgress?.(i + 1, total);

      // Yield to the event loop so the UI stays responsive AND the encoder
      // queue does not grow without bound.
      await yieldToBrowser();
    }

    await encoder.flush();
    encoder.close();
  } catch (err) {
    try { encoder.close(); } catch { /* ignore */ }
    throw err;
  } finally {
    renderer.dispose();
  }

  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyFrameToCamera(frame: InterpolatedFrame, camera: THREE.PerspectiveCamera): void {
  camera.position.set(frame.position.x, frame.position.y, frame.position.z);
  camera.lookAt(frame.target.x, frame.target.y, frame.target.z);
  if (camera.fov !== frame.fov) {
    camera.fov = frame.fov;
    camera.updateProjectionMatrix();
  }
}

/**
 * Create a detached WebGLRenderer + PerspectiveCamera sized for the export.
 * Keeps the live viewport canvas untouched during the MP4 encode loop.
 */
function createOffscreenRenderTarget(
  width: number,
  height: number,
  firstFrame: InterpolatedFrame,
): { renderer: THREE.WebGLRenderer; camera: THREE.PerspectiveCamera } {
  // ADR-366 §B.5 — shared offscreen-capture renderer SSoT (same config as the print/PDF capture).
  const renderer = createOffscreenCaptureRenderer(width, height);

  const camera = new THREE.PerspectiveCamera(firstFrame.fov, width / height, 0.1, 5000);
  return { renderer, camera };
}

function yieldToBrowser(): Promise<void> {
  if (typeof requestAnimationFrame === 'undefined') {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
