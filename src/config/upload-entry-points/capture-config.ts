/**
 * =============================================================================
 * Upload Entry Points — Capture Capabilities Configuration
 * =============================================================================
 *
 * @module config/upload-entry-points/capture-config
 * @enterprise ADR-031 Extension
 */

import type { FileCategory } from '../domain-constants';
import type { CaptureSource, CaptureMode, CaptureMetadata, UploadEntryPoint } from './types';

// ============================================================================
// Category Capture Capabilities
// ============================================================================

/**
 * Defines which capture sources are allowed per file category.
 */
export const CATEGORY_CAPTURE_CAPABILITIES: Record<FileCategory, CaptureSource[]> = {
  photos: ['upload', 'camera'],
  videos: ['upload', 'video'],
  documents: ['upload', 'text', 'microphone'], // Documents can include text notes and voice notes
  contracts: ['upload', 'camera'], // Can photograph contracts with phone camera
  permits: ['upload'],
  floorplans: ['upload'],
  invoices: ['upload', 'camera'], // Can photograph receipts
  audio: ['upload', 'microphone'], // Voice recordings
  drawings: ['upload', 'camera'], // Can photograph drawings
} as const;

// ============================================================================
// Capture Utilities
// ============================================================================

/**
 * Get allowed capture sources for a specific file category.
 * Uses entry point override if available, otherwise falls back to category defaults.
 */
export function getCaptureSourcesForCategory(
  category: FileCategory,
  entryPoint?: UploadEntryPoint
): CaptureSource[] {
  if (entryPoint?.allowedSources) {
    return entryPoint.allowedSources;
  }
  return CATEGORY_CAPTURE_CAPABILITIES[category] || ['upload'];
}

/**
 * Check if a specific capture source is allowed for a category.
 */
export function isCaptureSourceAllowed(
  category: FileCategory,
  source: CaptureSource,
  entryPoint?: UploadEntryPoint
): boolean {
  const allowedSources = getCaptureSourcesForCategory(category, entryPoint);
  return allowedSources.includes(source);
}

/**
 * Create capture metadata for a file.
 */
export function createCaptureMetadata(
  source: CaptureSource,
  captureMode: CaptureMode,
  options?: {
    durationMs?: number;
    mimeType?: string;
    originalFilename?: string;
  }
): CaptureMetadata {
  return {
    source,
    captureMode,
    durationMs: options?.durationMs,
    mimeType: options?.mimeType,
    originalFilename: options?.originalFilename,
    capturedAt: new Date().toISOString(),
  };
}
