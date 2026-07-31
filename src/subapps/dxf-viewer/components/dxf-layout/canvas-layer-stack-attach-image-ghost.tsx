/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-736 §6 — AttachImageGhostPreviewMount: micro-leaf για το φάντασμα της εντολής «Εικόνα».
 * Mirror του `MatchHoverGhostPreviewMount`: ο κέρσορας διαβάζεται ΜΕΣΑ στο hook
 * (`useAttachImageGhostPreview` → RAF harness), οπότε ο CanvasSection ΔΕΝ ξαναρεντάρει σε
 * mousemove. Το μόνο payload που έρχεται απ' έξω είναι το `isAwaitingPosition` (React state
 * του tool, low-frequency) — το «ποια εικόνα» ζει σε vanilla store.
 */

'use client';

import React from 'react';
import {
  useAttachImageGhostPreview,
  type AttachImageGhostPreviewProps,
} from '../../hooks/tools/useAttachImageGhostPreview';

export type AttachImageGhostPreviewMountProps = AttachImageGhostPreviewProps;

export const AttachImageGhostPreviewMount = React.memo(function AttachImageGhostPreviewMount(
  props: AttachImageGhostPreviewMountProps,
) {
  useAttachImageGhostPreview(props);
  return null;
});
