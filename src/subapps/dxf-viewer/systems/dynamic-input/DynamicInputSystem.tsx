'use client';

import React from 'react';
import DynamicInputOverlay from './components/DynamicInputOverlay';
import type { Point2D, Viewport } from '../../rendering/types/Types';

export interface DynamicInputSystemProps {
  className?: string;
  isActive?: boolean;
  cursorPosition?: Point2D | null;
  viewport?: Viewport;
  activeTool?: string;
  canvasRect?: DOMRect | null;
  mouseWorldPosition?: Point2D | null;
  tempPoints?: Point2D[] | null;
}

/**
 * Unified Dynamic Input System Component
 * Centralizes all dynamic input functionality in a single system
 */
export default function DynamicInputSystem(props: DynamicInputSystemProps) {
  return <DynamicInputOverlay {...props} />;
}