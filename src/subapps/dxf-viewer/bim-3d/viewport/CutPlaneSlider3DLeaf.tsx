'use client';

// ============================================================================
// ✂️ CutPlaneSlider3DLeaf — ADR-452 (3D mount of the cut-plane slider)
// ============================================================================
//
// Mounts the shared <CutPlaneSliderControl> inside BimViewport3D's z-50 wrapper
// (z-[60] to float above the Three.js canvas). No mode gate is needed —
// BimViewport3D itself returns null in 2D. The slider drives the same cut-plane
// SSoT; in 3D the elevation feeds a horizontal clipping plane (SectionSceneController).
// ============================================================================

import React from 'react';
import { CutPlaneSliderControl } from '../../components/dxf-layout/CutPlaneSliderControl';

export function CutPlaneSlider3DLeaf() {
  // top-44 (176px) clears the 160px ViewCube canvas (top:12px → 172px) so the slider's
  // toggle button + readout no longer overlap the cube and its compass rings.
  return <CutPlaneSliderControl className="top-44 z-[60]" />;
}
