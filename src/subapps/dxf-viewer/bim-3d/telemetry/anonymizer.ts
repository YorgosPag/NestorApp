/**
 * anonymizer — ADR-366 §C.7.Q3
 *
 * Pure (no DOM, no React). Maps a PerformanceMetricsSnapshot + context →
 * GDPR-anonymized payload ready for upload.
 *
 *   strips   projectId, userId, companyId, sceneInfo, email, IP, raw UA strings
 *   keeps    anonymous_session_id, browser+version (coarse), OS (coarse),
 *            gpuTier (0-3), renderMode, 10 metrics snapshot, timestamp
 *
 * Browser & OS detection is intentionally coarse (family + major version).
 * Full UA strings are PII (they are unique enough to fingerprint).
 *
 * GPU tier is bucketed 0-3 from a heuristic mapping (we don't ship
 * `detect-gpu` v1 — Phase 4 deferred). For now `tier = null` when unknown.
 */

import type { PerformanceMetricsSnapshot } from '../performance/PerformanceHUDStore';
import type { Bim3dRenderMode } from '../performance/per-mode-promotion';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AnonymizedTelemetrySample {
  sessionId: string;
  timestamp: number;
  renderMode: Bim3dRenderMode;
  browser: { family: string; major: number | null };
  os: { family: string };
  gpuTier: number | null;
  metrics: {
    fps: number;
    frameTimeMs: number;
    triangles: number;
    vertices: number;
    drawCalls: number;
    objectsVisible: number;
    objectsTotal: number;
    gpuMemoryMb: number;
    cpuMemoryMb: number | null;
    samplesPerSec: number | null;
  };
}

export interface AnonymizerInput {
  sessionId: string;
  snapshot: PerformanceMetricsSnapshot;
  renderMode: Bim3dRenderMode;
  now: number;
  userAgent: string;
  gpuTier: number | null;
}

// ─── Coarse UA parsing ────────────────────────────────────────────────────────

function detectBrowser(ua: string): { family: string; major: number | null } {
  const lower = ua.toLowerCase();
  let family = 'other';
  let versionMatch: RegExpMatchArray | null = null;

  if (lower.includes('edg/')) {
    family = 'edge';
    versionMatch = ua.match(/Edg\/(\d+)/);
  } else if (lower.includes('chrome/')) {
    family = 'chrome';
    versionMatch = ua.match(/Chrome\/(\d+)/);
  } else if (lower.includes('firefox/')) {
    family = 'firefox';
    versionMatch = ua.match(/Firefox\/(\d+)/);
  } else if (lower.includes('safari/') && !lower.includes('chrome/')) {
    family = 'safari';
    versionMatch = ua.match(/Version\/(\d+)/);
  }

  const major = versionMatch ? Number(versionMatch[1]) : null;
  return { family, major: Number.isFinite(major) ? major : null };
}

function detectOs(ua: string): { family: string } {
  const lower = ua.toLowerCase();
  if (lower.includes('windows')) return { family: 'windows' };
  if (lower.includes('mac os')) return { family: 'macos' };
  if (lower.includes('android')) return { family: 'android' };
  if (lower.includes('iphone') || lower.includes('ipad')) return { family: 'ios' };
  if (lower.includes('linux')) return { family: 'linux' };
  return { family: 'other' };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export function anonymizeSample(input: AnonymizerInput): AnonymizedTelemetrySample {
  return {
    sessionId: input.sessionId,
    timestamp: input.now,
    renderMode: input.renderMode,
    browser: detectBrowser(input.userAgent),
    os: detectOs(input.userAgent),
    gpuTier: input.gpuTier,
    metrics: {
      fps: input.snapshot.fps,
      frameTimeMs: input.snapshot.frameTimeMs,
      triangles: input.snapshot.triangles,
      vertices: input.snapshot.vertices,
      drawCalls: input.snapshot.drawCalls,
      objectsVisible: input.snapshot.objectsVisible,
      objectsTotal: input.snapshot.objectsTotal,
      gpuMemoryMb: input.snapshot.gpuMemoryMb,
      cpuMemoryMb: input.snapshot.cpuMemoryMb,
      samplesPerSec: input.snapshot.samplesPerSec,
    },
  };
}
