#!/usr/bin/env node

/**
 * Canvas Architecture Verification Script
 * Ελέγχει ότι οι αλλαγές PHASE 1-4 είναι σωστές
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = path.join(__dirname, '..');

function checkFile(filePath, expectedContent) {
  const fullPath = path.join(BASE_PATH, filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');

  for (const expected of expectedContent) {
    if (!content.includes(expected)) {
      console.error(`❌ Missing content in ${filePath}: ${expected}`);
      return false;
    }
  }
  return true;
}
// PHASE 1: Canvas Binding
const phase1OK = checkFile('canvas-v2/dxf-canvas/DxfCanvas.tsx', [
  "import { useCanvasContext } from '../contexts/CanvasContext'",
  "const context = useCanvasContext()",
  "context?.canvasRef || React.useRef"
]);

// PHASE 2: Zoom Events
const phase2OK = checkFile('canvas-v2/dxf-canvas/DxfCanvas.tsx', [
  "new CustomEvent('dxf-zoom-changed'",
  "detail: { scale: newTransform.scale, transform: newTransform }",
  "document.dispatchEvent(zoomEvent)"
]);

// PHASE 3: Union Bounds
const phase3OK = checkFile('utils/bounds-utils.ts', [
  "export function unionBounds",
  "export function getOverlayBounds",
  "export function calculateUnifiedBounds"
]) && checkFile('canvas-v2/dxf-canvas/DxfRenderer.ts', [
  "calculateUnifiedBounds(scene?.bounds || null, overlayEntities)",
  "overlayEntities: any[] = []"
]);

// PHASE 4: Feature Flags
const phase4OK = checkFile('config/experimental-features.ts', [
  "COLLABORATION_OVERLAY: false",
  "DXF_CANVAS_OVERLAY_INTEGRATION: false"
]) && checkFile('collaboration/CollaborationOverlay.tsx', [
  "if (!isFeatureEnabled('COLLABORATION_OVERLAY'))"
]);
const allOK = phase1OK && phase2OK && phase3OK && phase4OK;
process.exit(allOK ? 0 : 1);