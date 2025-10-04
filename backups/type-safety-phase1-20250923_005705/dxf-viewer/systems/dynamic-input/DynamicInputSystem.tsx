'use client';

import React from 'react';
import DynamicInputOverlay from './components/DynamicInputOverlay';

export interface DynamicInputSystemProps {
  className?: string;
  isActive?: boolean;
  cursorPosition?: { x: number; y: number } | null;
  viewport?: { width: number; height: number };
  activeTool?: string;
  canvasRect?: DOMRect | null;
  mouseWorldPosition?: { x: number; y: number } | null;
  tempPoints?: { x: number; y: number }[] | null;
}

/**
 * Unified Dynamic Input System Component
 * Centralizes all dynamic input functionality in a single system
 */
export default function DynamicInputSystem(props: DynamicInputSystemProps) {
  return <DynamicInputOverlay {...props} />;
}