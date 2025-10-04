/**
 * Shared Angle Icon Base - Common SVG structure for angle icons
 * Eliminates 158-token duplication between AngleIcon and AngleMeasureGeomIcon
 */

import React from 'react';

interface AngleIconBaseProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  showMeasurementSymbol?: boolean;
  showDiagonalLine?: boolean;
  children?: React.ReactNode;
}

export function AngleIconBase({ 
  size = 16, 
  color = "currentColor", 
  strokeWidth = 1.5,
  showMeasurementSymbol = false,
  showDiagonalLine = true,
  children 
}: AngleIconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Κάθετη γραμμή */}
      <line x1="6" y1="18" x2="6" y2="6" />
      
      {/* Διαγώνια γραμμή - conditionally rendered */}
      {showDiagonalLine && <line x1="6" y1="18" x2="18" y2="6" />}
      
      {/* Τόξο γωνίας */}
      <path d="M 6 15 A 3 3 0 0 1 9 12" />
      
      {/* Μετρητής/calculator σύμβολο - conditionally rendered */}
      {showMeasurementSymbol && (
        <>
          <rect x="14" y="14" width="6" height="4" rx="1" />
          <line x1="16" y1="15" x2="18" y2="15" />
          <line x1="16" y1="17" x2="18" y2="17" />
        </>
      )}
      
      {/* Σημεία στα άκρα των γραμμών */}
      <circle cx="6" cy="6" r="1" fill={color} />
      <circle cx="18" cy="6" r="1" fill={color} />
      <circle cx="6" cy="18" r="1" fill={color} />
      
      {/* Additional children for customization */}
      {children}
    </svg>
  );
}

export default AngleIconBase;