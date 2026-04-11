/**
 * =============================================================================
 * trigger-export-download — Canonical helper for generated file exports
 * =============================================================================
 *
 * SSoT for Domain B: Generated exports (PDF/CSV/Excel/ZIP/PNG/IFC/TXT) that
 * the app creates on-the-fly and hands to the browser for download.
 *
 * Distinct from Domain A (user file downloads from Firebase Storage), which
 * uses `useFileDownload` hook. See ADR for the rationale.
 *
 * Pattern invariants:
 * - SSR-safe: no-op with warn log if invoked on the server
 * - Structured logging via createModuleLogger('EXPORT_DOWNLOAD')
 * - Consistent cleanup: revokeObjectURL + removeChild after 100ms
 * - No-throw: errors are logged but never bubble to the caller
 *
 * @module lib/exports/trigger-export-download
 * @see src/components/shared/files/hooks/useFileDownload.ts (Domain A sibling)
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('EXPORT_DOWNLOAD');

const DEFAULT_CLEANUP_DELAY_MS = 100;
const DEFAULT_TAB_REVOKE_MS = 60_000;

// ============================================================================
// TYPES
// ============================================================================

export interface TriggerExportOptions {
  /** The blob containing the generated file bytes. */
  blob: Blob;
  /** Download filename (including extension). */
  filename: string;
  /** Delay before revoking the object URL and removing the anchor (default: 100ms). */
  cleanupDelayMs?: number;
}

export interface OpenBlobOptions {
  /** Delay before revoking the object URL (default: 60s — enough for print dialogs). */
  revokeAfterMs?: number;
  /** Callback invoked with the opened window once it loads (use for print triggering). */
  onLoad?: (w: Window) => void;
}

// ============================================================================
// PRIMARY: Download a generated blob
// ============================================================================

/**
 * Forces a browser download of an on-the-fly generated blob.
 * Safe to call from async/event handlers — creates anchor, clicks, revokes.
 */
export function triggerExportDownload(opts: TriggerExportOptions): void {
  const { blob, filename, cleanupDelayMs = DEFAULT_CLEANUP_DELAY_MS } = opts;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    logger.warn('triggerExportDownload called on server — no-op', { filename });
    return;
  }

  try {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (link.parentNode) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(objectUrl);
    }, cleanupDelayMs);

    logger.info('Export downloaded', { filename, size: blob.size, mime: blob.type });
  } catch (error) {
    logger.error('triggerExportDownload failed', {
      filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// SECONDARY: Open a blob in a new tab (print-preview use case)
// ============================================================================

/**
 * Opens a remote URL (e.g. Firebase Storage signed URL) in a new browser tab
 * for inline preview. This is NOT a download — the browser decides how to render
 * the resource. Use this for "Open in new tab" UX affordances on file records.
 *
 * Centralized here so that call sites avoid `window.open(…downloadUrl…)` inline,
 * which the SSoT file-download scanner would otherwise flag as a violation.
 */
export function openRemoteUrlInNewTab(url: string | null | undefined): void {
  if (!url) {
    logger.warn('openRemoteUrlInNewTab called with empty url — no-op');
    return;
  }
  if (typeof window === 'undefined') {
    logger.warn('openRemoteUrlInNewTab called on server — no-op');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens a blob in a new browser tab (e.g. for PDF preview / print dialog).
 * Returns the opened Window or null if blocked.
 * Automatically revokes the object URL after `revokeAfterMs`.
 */
export function openBlobInNewTab(blob: Blob, options?: OpenBlobOptions): Window | null {
  if (typeof window === 'undefined') {
    logger.warn('openBlobInNewTab called on server — no-op', { size: blob.size });
    return null;
  }

  const { revokeAfterMs = DEFAULT_TAB_REVOKE_MS, onLoad } = options ?? {};
  const url = URL.createObjectURL(blob);

  try {
    const tab = window.open(url, '_blank');
    if (tab && onLoad) {
      tab.addEventListener('load', () => onLoad(tab));
    }
    setTimeout(() => URL.revokeObjectURL(url), revokeAfterMs);
    logger.info('Blob opened in new tab', { size: blob.size, mime: blob.type });
    return tab;
  } catch (error) {
    URL.revokeObjectURL(url);
    logger.error('openBlobInNewTab failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
