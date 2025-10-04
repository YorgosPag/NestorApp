/**
 * Angle Line + Arc Icon - Γραμμή + τόξο/κύκλο
 * Refactored to use AngleIconBase to eliminate duplication
 */

import React from 'react';
import { AngleIconBase } from './shared/AngleIconBase';

interface AngleLineArcIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function AngleLineArcIcon({ size = 16, color = "currentColor", strokeWidth = 1.5 }: AngleLineArcIconProps) {
  return (
    <AngleIconBase 
      size={size} 
      color={color} 
      strokeWidth={strokeWidth}
      showDiagonalLine={false}
    >
      {/* Κύκλος/τόξο - custom για αυτό το icon */}
      <circle cx="14" cy="10" r="4" />
    </AngleIconBase>
  );
}

export default AngleLineArcIcon;