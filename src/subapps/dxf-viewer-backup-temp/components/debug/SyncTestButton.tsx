'use client';

import React from 'react';

interface SyncTestButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
}

export const SyncTestButton: React.FC<SyncTestButtonProps> = ({ onNotify, canvasTransform }) => {
  const handleTest = () => {
    console.log('🔍 RULER-GRID SYNC TEST TRIGGERED');

    const canvasEl = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    if (!canvasEl) {
      onNotify('Canvas not found', 'error');
      return;
    }

    const rect = canvasEl.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };
    const transform = canvasTransform;

    const worldOrigin = { x: 0, y: 0 };
    const screenOrigin = {
      x: 80 + worldOrigin.x * transform.scale + transform.offsetX,
      y: (viewport.height - 30) - worldOrigin.y * transform.scale - transform.offsetY
    };

    const gridSize = 10;
    const gridStartXRaw = (screenOrigin.x % gridSize);
    const gridStartYRaw = (screenOrigin.y % gridSize);

    const MARGIN_LEFT = 80;
    const MARGIN_TOP = 30;

    let gridStartX = gridStartXRaw;
    while (gridStartX < MARGIN_LEFT) {
      gridStartX += gridSize;
    }

    let gridStartY = gridStartYRaw;
    while (gridStartY < MARGIN_TOP) {
      gridStartY += gridSize;
    }

    const rulerStep = 50;
    const rulerStartXRaw = (screenOrigin.x % rulerStep);
    const rulerStartYRaw = (screenOrigin.y % rulerStep);

    let rulerStartX = rulerStartXRaw;
    while (rulerStartX < MARGIN_LEFT) {
      rulerStartX += rulerStep;
    }

    let rulerStartY = rulerStartYRaw;
    while (rulerStartY < MARGIN_TOP) {
      rulerStartY += rulerStep;
    }

    let report = `🔍 RULER-GRID SYNC TEST\n\n`;
    report += `📊 TRANSFORM:\n`;
    report += `  Scale: ${transform.scale.toFixed(3)}\n`;
    report += `  Offset: (${transform.offsetX.toFixed(1)}, ${transform.offsetY.toFixed(1)})\n\n`;

    report += `📐 VIEWPORT:\n`;
    report += `  Size: ${viewport.width.toFixed(0)} × ${viewport.height.toFixed(0)} px\n\n`;

    report += `🎯 WORLD (0,0) SCREEN POSITION:\n`;
    report += `  X: ${screenOrigin.x.toFixed(2)} px\n`;
    report += `  Y: ${screenOrigin.y.toFixed(2)} px\n\n`;

    report += `🟢 GRID (10px spacing):\n`;
    report += `  First vertical line at X: ${gridStartX.toFixed(2)} px\n`;
    report += `  First horizontal line at Y: ${gridStartY.toFixed(2)} px\n`;
    report += `  Lines at: ${gridStartX.toFixed(0)}, ${(gridStartX + gridSize).toFixed(0)}, ${(gridStartX + 2 * gridSize).toFixed(0)}...\n\n`;

    report += `📏 RULER (50px spacing):\n`;
    report += `  First X tick at: ${rulerStartX.toFixed(2)} px\n`;
    report += `  First Y tick at: ${rulerStartY.toFixed(2)} px\n`;
    report += `  X ticks at: ${rulerStartX.toFixed(0)}, ${(rulerStartX + rulerStep).toFixed(0)}, ${(rulerStartX + 2 * rulerStep).toFixed(0)}...\n\n`;

    report += `✅ ALIGNMENT CHECK:\n`;
    const tickToGridDiff = (rulerStartX - gridStartX) % gridSize;
    const aligned = tickToGridDiff < 0.5 || tickToGridDiff > (gridSize - 0.5);

    const gridLinesFromMargin = Math.round((rulerStartX - gridStartX) / gridSize);

    report += `  Status: ${aligned ? '✅ PERFECTLY ALIGNED' : '❌ MISALIGNED'}\n`;
    report += `  Grid first line: ${gridStartX.toFixed(2)} px\n`;
    report += `  Ruler first tick: ${rulerStartX.toFixed(2)} px\n`;
    report += `  Ruler tick on grid line #${gridLinesFromMargin + 1}: ${(gridStartX + gridLinesFromMargin * gridSize).toFixed(2)} px\n`;
    report += `  Alignment error: ${Math.min(tickToGridDiff, gridSize - tickToGridDiff).toFixed(3)} px\n`;
    report += `  Tolerance: 0.5 px\n`;

    onNotify(report, aligned ? 'success' : 'warning');
    console.log(report);
  };

  return (
    <button
      onClick={handleTest}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#0891B2', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#06B6D4')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0891B2')}
    >
      🔍 Sync Test
    </button>
  );
};
