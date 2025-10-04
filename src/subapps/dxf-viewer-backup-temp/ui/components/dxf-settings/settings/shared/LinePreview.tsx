import React from 'react';
import type { LineType } from '../../../../../settings-core/types';
import { getDashArray } from '../../../../../settings-core/defaults';

// Helper για SVG stroke-dasharray (χρησιμοποιεί την κεντρική getDashArray)
const getDashArrayForSvg = (type: LineType | string, scale: number = 1) => {
  return getDashArray(type, scale).join(' ');
};

interface LineSettings {
  lineType: LineType;
  lineWidth: number;
  color: string;
  opacity: number;
  dashScale?: number;
  dashOffset?: number;
  lineCap?: string;
  lineJoin?: string;
  breakAtCenter: boolean;
}

interface TextSettings {
  color: string;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;
}

interface GripSettings {
  enabled: boolean;
  gripSize: number;
  pickBoxSize: number;
  apertureSize: number;
  opacity: number;
  colors: {
    cold: string;
    warm: string;
    hot: string;
    contour: string;
  };
  showAperture: boolean;
  multiGripEdit: boolean;
  snapToGrips: boolean;
  showMidpoints: boolean;
  showCenters: boolean;
  showQuadrants: boolean;
  maxGripsPerEntity: number;
}

interface LinePreviewProps {
  lineSettings: LineSettings;
  textSettings: TextSettings;
  gripSettings: GripSettings;
  activeTab?: string; // Deprecated - δεν χρησιμοποιείται πλέον
  className?: string;
}

export function LinePreview({ lineSettings, textSettings, gripSettings, activeTab, className = '' }: LinePreviewProps) {
  // Μετατροπή των ρυθμίσεων για το SVG
  // ΔΙΟΡΘΩΣΗ: Η προεπισκόπηση πρέπει να δείχνει πάντα τις ρυθμίσεις γραμμής, ανεξάρτητα από την καρτέλα
  const effectiveColor = lineSettings.color;

  // Υπολογισμός συνολικών grips για έλεγχο maxGripsPerEntity
  const totalGrips = [
    2, // Left & Right endpoints (πάντα υπάρχουν)
    gripSettings.showMidpoints ? 1 : 0,
    gripSettings.showCenters ? 1 : 0,
    gripSettings.showQuadrants ? 4 : 0
  ].reduce((sum, count) => sum + count, 0);

  const previewSettings = {
    lineType: lineSettings.lineType,
    lineWidth: lineSettings.lineWidth,
    color: effectiveColor,
    opacity: lineSettings.opacity, // Use decimal directly (0-1)
    dashScale: lineSettings.dashScale || 1.0,
    dashOffset: lineSettings.dashOffset || 0,
    lineCap: lineSettings.lineCap || 'butt',
    lineJoin: lineSettings.lineJoin || 'miter'
  };

  return (
    <div className={`bg-gray-700 rounded p-6 space-y-4 ${className}`}>
      {/* Live Preview με πραγματικές ρυθμίσεις - ΠΛΗΡΗΣ ΠΡΟΕΠΙΣΚΟΠΗΣΗ GRIPS */}
      <div className="relative h-12 flex items-center">
        <svg width="100%" height="100%" className="absolute inset-0">
          {lineSettings.breakAtCenter ? (
            // Σπασμένη γραμμή - δυναμικό κενό βάσει μεγέθους κειμένου
            (() => {
              // Δυναμικός υπολογισμός πλάτους κειμένου βάσει πραγματικών ρυθμίσεων
              const text = "125.50";
              const fontSize = textSettings.fontSize;
              const fontFamily = textSettings.fontFamily;
              const isBold = textSettings.isBold;

              // Πιο ακριβής υπολογισμός πλάτους κειμένου
              const isMonospace = fontFamily.toLowerCase().includes('mono') ||
                                fontFamily.toLowerCase().includes('courier') ||
                                fontFamily.toLowerCase().includes('consolas');

              const charWidthRatio = isMonospace ? 0.6 : 0.55;
              const boldMultiplier = isBold ? 1.15 : 1;

              const hasScript = textSettings.isSuperscript || textSettings.isSubscript;
              const scriptMultiplier = hasScript ? 1.2 : 1;

              const estimatedTextWidth = text.length * fontSize * charWidthRatio * boldMultiplier * scriptMultiplier;
              const padding = Math.max(24, fontSize * 1.0);
              const totalGap = estimatedTextWidth + padding;

              const containerWidth = 100;
              const gapPercentage = Math.min(40, (totalGap / 300) * 100);
              const center = containerWidth / 2;
              const leftEndPercent = center - gapPercentage / 2;
              const rightStartPercent = center + gapPercentage / 2;

              return (
                <>
                  <line
                    x1="0"
                    y1="50%"
                    x2={`${leftEndPercent}%`}
                    y2="50%"
                    stroke={previewSettings.color}
                    strokeWidth={previewSettings.lineWidth}
                    strokeOpacity={previewSettings.opacity}
                    strokeDasharray={getDashArrayForSvg(previewSettings.lineType, previewSettings.dashScale || 1)}
                    strokeDashoffset={previewSettings.dashOffset || 0}
                    strokeLinecap={(previewSettings.lineCap as 'butt' | 'round' | 'square') || 'butt'}
                    strokeLinejoin={(previewSettings.lineJoin as 'miter' | 'round' | 'bevel') || 'miter'}
                  />
                  <line
                    x1={`${rightStartPercent}%`}
                    y1="50%"
                    x2="100%"
                    y2="50%"
                    stroke={previewSettings.color}
                    strokeWidth={previewSettings.lineWidth}
                    strokeOpacity={previewSettings.opacity}
                    strokeDasharray={getDashArrayForSvg(previewSettings.lineType, previewSettings.dashScale || 1)}
                    strokeDashoffset={previewSettings.dashOffset || 0}
                    strokeLinecap={(previewSettings.lineCap as 'butt' | 'round' | 'square') || 'butt'}
                    strokeLinejoin={(previewSettings.lineJoin as 'miter' | 'round' | 'bevel') || 'miter'}
                  />
                </>
              );
            })()
          ) : (
            // Κανονική γραμμή - από άκρη σε άκρη
            <line
              x1="0"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke={previewSettings.color}
              strokeWidth={previewSettings.lineWidth}
              strokeOpacity={previewSettings.opacity}
              strokeDasharray={getDashArrayForSvg(previewSettings.lineType, previewSettings.dashScale || 1)}
              strokeDashoffset={previewSettings.dashOffset || 0}
              strokeLinecap={(previewSettings.lineCap as 'butt' | 'round' | 'square') || 'butt'}
              strokeLinejoin={(previewSettings.lineJoin as 'miter' | 'round' | 'bevel') || 'miter'}
            />
          )}

          {/* Grips Rendering - εάν enabled */}
          {gripSettings.enabled && (
            <>
              {/* Κύκλος για προεπισκόπηση centers και quadrants */}
              <circle
                cx="75%"
                cy="50%"
                r="15"
                fill="none"
                stroke={previewSettings.color}
                strokeWidth="1"
                strokeOpacity="0.3"
                strokeDasharray="2,2"
              />

              {/* Left endpoint grip */}
              <circle
                cx="0"
                cy="50%"
                r={gripSettings.gripSize / 2}
                fill={gripSettings.colors.cold}
                stroke={gripSettings.colors.contour}
                strokeWidth="1"
                opacity={gripSettings.opacity}
              />

              {/* Right endpoint grip */}
              <circle
                cx="100%"
                cy="50%"
                r={gripSettings.gripSize / 2}
                fill={gripSettings.colors.cold}
                stroke={gripSettings.colors.contour}
                strokeWidth="1"
                opacity={gripSettings.opacity}
              />

              {/* Midpoint grip - εάν enabled */}
              {gripSettings.showMidpoints && (
                <circle
                  cx="50%"
                  cy="50%"
                  r={gripSettings.gripSize / 2}
                  fill={gripSettings.colors.cold}
                  stroke={gripSettings.colors.contour}
                  strokeWidth="1"
                  opacity={gripSettings.opacity}
                />
              )}

              {/* Center grip - εάν enabled */}
              {gripSettings.showCenters && (
                <circle
                  cx="75%"
                  cy="50%"
                  r={gripSettings.gripSize / 2}
                  fill={gripSettings.colors.warm}
                  stroke={gripSettings.colors.contour}
                  strokeWidth="1"
                  opacity={gripSettings.opacity}
                />
              )}

              {/* Quadrant grips - εάν enabled */}
              {gripSettings.showQuadrants && (
                <>
                  {/* Top quadrant */}
                  <circle
                    cx="75%"
                    cy="calc(50% - 15px)"
                    r={gripSettings.gripSize / 2}
                    fill={gripSettings.colors.cold}
                    stroke={gripSettings.colors.contour}
                    strokeWidth="1"
                    opacity={gripSettings.opacity}
                  />
                  {/* Right quadrant */}
                  <circle
                    cx="calc(75% + 15px)"
                    cy="50%"
                    r={gripSettings.gripSize / 2}
                    fill={gripSettings.colors.cold}
                    stroke={gripSettings.colors.contour}
                    strokeWidth="1"
                    opacity={gripSettings.opacity}
                  />
                  {/* Bottom quadrant */}
                  <circle
                    cx="75%"
                    cy="calc(50% + 15px)"
                    r={gripSettings.gripSize / 2}
                    fill={gripSettings.colors.cold}
                    stroke={gripSettings.colors.contour}
                    strokeWidth="1"
                    opacity={gripSettings.opacity}
                  />
                  {/* Left quadrant */}
                  <circle
                    cx="calc(75% - 15px)"
                    cy="50%"
                    r={gripSettings.gripSize / 2}
                    fill={gripSettings.colors.cold}
                    stroke={gripSettings.colors.contour}
                    strokeWidth="1"
                    opacity={gripSettings.opacity}
                  />
                </>
              )}

              {/* Pick Box - εμφάνιση ως διαφανές τετράγωνο γύρω από cursor area */}
              {gripSettings.pickBoxSize > 0 && (
                <rect
                  x="calc(25% - 10px)"
                  y="calc(50% - 10px)"
                  width={gripSettings.pickBoxSize}
                  height={gripSettings.pickBoxSize}
                  fill="none"
                  stroke={gripSettings.colors.contour}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  strokeDasharray="1,1"
                />
              )}

              {/* Aperture - εμφάνιση ως διαφανές τετράγωνο για snap */}
              {gripSettings.showAperture && gripSettings.apertureSize > 0 && (
                <rect
                  x="calc(25% - 5px)"
                  y="calc(50% - 5px)"
                  width={gripSettings.apertureSize}
                  height={gripSettings.apertureSize}
                  fill="none"
                  stroke="#00ff00"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                  strokeDasharray="2,1"
                />
              )}

              {/* Περιορισμός grips βάσει maxGripsPerEntity */}
              {(() => {
                const exceedsMax = totalGrips > gripSettings.maxGripsPerEntity;

                return exceedsMax && (
                  <text
                    x="10%"
                    y="20%"
                    fontSize="8"
                    fill="#ff6600"
                    fontFamily="monospace"
                  >
                    Max: {gripSettings.maxGripsPerEntity} ({totalGrips} grips)
                  </text>
                );
              })()}

              {/* Visual indicators για λειτουργικότητες */}
              {gripSettings.multiGripEdit && (
                <text
                  x="85%"
                  y="20%"
                  fontSize="6"
                  fill={gripSettings.colors.hot}
                  fontFamily="monospace"
                >
                  MULTI
                </text>
              )}

              {gripSettings.snapToGrips && (
                <text
                  x="85%"
                  y="85%"
                  fontSize="6"
                  fill="#00ff00"
                  fontFamily="monospace"
                >
                  SNAP
                </text>
              )}
            </>
          )}
        </svg>

        {/* Distance text με θέση ανάλογα με την επιλογή */}
        <div
          className="absolute text-xs font-mono pointer-events-none"
          style={{
            color: textSettings.color,
            fontSize: `${textSettings.fontSize}px`,
            fontFamily: textSettings.fontFamily,
            fontWeight: textSettings.isBold ? 'bold' : 'normal',
            fontStyle: textSettings.isItalic ? 'italic' : 'normal',
            textDecoration: [
              textSettings.isUnderline ? 'underline' : '',
              textSettings.isStrikethrough ? 'line-through' : ''
            ].filter(Boolean).join(' ') || 'none',
            // Θέση ανάλογα με το αν η γραμμή είναι σπασμένη
            ...(lineSettings.breakAtCenter ? {
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            } : {
              top: 'calc(50% - 1.5em)',
              left: '50%',
              transform: 'translateX(-50%)',
            }),
            whiteSpace: 'nowrap'
          }}
        >
          125.50
          {textSettings.isSuperscript && (
            <span style={{ fontSize: '60%', verticalAlign: 'super' }}>²</span>
          )}
          {textSettings.isSubscript && (
            <span style={{ fontSize: '60%', verticalAlign: 'sub' }}>₂</span>
          )}
        </div>
      </div>
    </div>
  );
}