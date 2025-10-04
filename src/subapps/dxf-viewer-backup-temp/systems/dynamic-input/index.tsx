'use client';
import React from 'react';
import type { Point2D } from '../../rendering/types/Types';

interface DynamicInputSystemProps {
  isActive: boolean;
  cursorPosition: Point2D | null;
  viewport: { width: number; height: number };
  activeTool: string;
  canvasRect: DOMRect | null;
  mouseWorldPosition: Point2D | null;
  tempPoints?: Point2D[] | null;
  className?: string;
}

export function DynamicInputSystem({
  isActive,
  cursorPosition,
  viewport,
  activeTool,
  canvasRect,
  mouseWorldPosition,
  tempPoints,
  className = ''
}: DynamicInputSystemProps) {
  // Stub implementation - το πλήρες DynamicInputSystem θα μεταφερθεί αργότερα
  return null;
}