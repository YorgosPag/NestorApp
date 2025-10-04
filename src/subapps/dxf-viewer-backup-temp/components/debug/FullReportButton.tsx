'use client';

/**
 * FULL DIAGNOSTIC REPORT BUTTON
 * Complete comprehensive diagnostic report with all system information
 *
 * Extracted from DxfViewerContent.tsx (lines 1326-1586, 260+ lines)
 */

import React from 'react';

interface FullReportButtonProps {
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
}

export const FullReportButton: React.FC<FullReportButtonProps> = ({ canvasTransform }) => {
  const handleGenerateReport = async () => {
    console.log('📋 MASTER DIAGNOSTIC REPORT TRIGGERED');

    let fullReport = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    fullReport += `📋 MASTER DIAGNOSTIC REPORT\n`;
    fullReport += `Generated: ${new Date().toLocaleString()}\n`;
    fullReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // ═══════════════════════════════════════
    // 1. CANVAS & VIEWPORT INFO
    // ═══════════════════════════════════════
    fullReport += `╔═══════════════════════════════════════╗\n`;
    fullReport += `║  1️⃣  CANVAS & VIEWPORT INFO           ║\n`;
    fullReport += `╚═══════════════════════════════════════╝\n\n`;

    const canvasEl = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      fullReport += `📐 Canvas Element:\n`;
      fullReport += `  Display Size: ${rect.width.toFixed(0)} × ${rect.height.toFixed(0)} px\n`;
      fullReport += `  Screen Position: (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)})\n`;
      fullReport += `  Internal Resolution: ${canvasEl.width} × ${canvasEl.height} px\n`;
      fullReport += `  Device Pixel Ratio: ${window.devicePixelRatio || 1}\n\n`;
    }

    fullReport += `🖥️ Window:\n`;
    fullReport += `  Size: ${window.innerWidth} × ${window.innerHeight} px\n`;
    fullReport += `  Screen: ${window.screen.width} × ${window.screen.height} px\n\n`;

    // ═══════════════════════════════════════
    // 2. TRANSFORM STATE
    // ═══════════════════════════════════════
    fullReport += `╔═══════════════════════════════════════╗\n`;
    fullReport += `║  2️⃣  TRANSFORM STATE                  ║\n`;
    fullReport += `╚═══════════════════════════════════════╝\n\n`;

    const transform = canvasTransform;
    fullReport += `📊 Current Transform:\n`;
    fullReport += `  Scale: ${transform.scale.toFixed(6)}\n`;
    fullReport += `  Offset X: ${transform.offsetX.toFixed(3)} px\n`;
    fullReport += `  Offset Y: ${transform.offsetY.toFixed(3)} px\n\n`;

    // World (0,0) position
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };
      const canvasX = 80 + transform.offsetX;
      const canvasY = (viewport.height - 30) - transform.offsetY;
      const screenX = rect.left + canvasX;
      const screenY = rect.top + canvasY;

      fullReport += `🎯 World (0,0) Position:\n`;
      fullReport += `  Canvas Coords: (${canvasX.toFixed(2)}, ${canvasY.toFixed(2)})\n`;
      fullReport += `  Screen Coords: (${screenX.toFixed(2)}, ${screenY.toFixed(2)})\n\n`;
    }

    // ═══════════════════════════════════════
    // 3. LIVE MOUSE COORDINATES
    // ═══════════════════════════════════════
    fullReport += `╔═══════════════════════════════════════╗\n`;
    fullReport += `║  3️⃣  LIVE MOUSE COORDINATES           ║\n`;
    fullReport += `╚═══════════════════════════════════════╝\n\n`;

    const mouseEvent = (window as any).lastMouseEvent;
    if (mouseEvent && canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };
      const screenX = mouseEvent.clientX;
      const screenY = mouseEvent.clientY;
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      // Calculate world coordinates
      const worldX = (canvasX - 80 - transform.offsetX) / transform.scale;
      const worldY = ((viewport.height - 30) - canvasY - transform.offsetY) / transform.scale;

      fullReport += `🐭 Mouse Position:\n`;
      fullReport += `  Screen: (${screenX}, ${screenY})\n`;
      fullReport += `  Canvas: (${canvasX.toFixed(0)}, ${canvasY.toFixed(0)})\n`;
      fullReport += `  World: (${worldX.toFixed(2)}, ${worldY.toFixed(2)})\n\n`;
    } else {
      fullReport += `⚠️ No mouse event captured yet\n\n`;
    }

    // ═══════════════════════════════════════
    // 4. RULER-GRID SYNC TEST
    // ═══════════════════════════════════════
    fullReport += `╔═══════════════════════════════════════╗\n`;
    fullReport += `║  4️⃣  RULER-GRID SYNC TEST             ║\n`;
    fullReport += `╚═══════════════════════════════════════╝\n\n`;

    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      const viewport = { width: rect.width, height: rect.height };

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
      while (gridStartX < MARGIN_LEFT) gridStartX += gridSize;

      let gridStartY = gridStartYRaw;
      while (gridStartY < MARGIN_TOP) gridStartY += gridSize;

      const rulerStep = 50;
      const rulerStartXRaw = (screenOrigin.x % rulerStep);
      const rulerStartYRaw = (screenOrigin.y % rulerStep);

      let rulerStartX = rulerStartXRaw;
      while (rulerStartX < MARGIN_LEFT) rulerStartX += rulerStep;

      let rulerStartY = rulerStartYRaw;
      while (rulerStartY < MARGIN_TOP) rulerStartY += rulerStep;

      fullReport += `🟢 Grid (10px spacing):\n`;
      fullReport += `  First X line: ${gridStartX.toFixed(2)} px\n`;
      fullReport += `  First Y line: ${gridStartY.toFixed(2)} px\n`;
      fullReport += `  Next lines: ${gridStartX.toFixed(0)}, ${(gridStartX + gridSize).toFixed(0)}, ${(gridStartX + 2 * gridSize).toFixed(0)}...\n\n`;

      fullReport += `📏 Ruler (50px spacing):\n`;
      fullReport += `  First X tick: ${rulerStartX.toFixed(2)} px\n`;
      fullReport += `  First Y tick: ${rulerStartY.toFixed(2)} px\n`;
      fullReport += `  Next ticks: ${rulerStartX.toFixed(0)}, ${(rulerStartX + rulerStep).toFixed(0)}, ${(rulerStartX + 2 * rulerStep).toFixed(0)}...\n\n`;

      const nearestGridToRuler = Math.round(rulerStartX / gridSize) * gridSize;
      const diffX = Math.abs(rulerStartX - nearestGridToRuler);
      const aligned = diffX < 0.5;

      fullReport += `✅ Alignment Check:\n`;
      fullReport += `  Status: ${aligned ? '✅ ALIGNED' : '❌ MISALIGNED'}\n`;
      fullReport += `  Ruler tick: ${rulerStartX.toFixed(2)} px\n`;
      fullReport += `  Nearest grid: ${nearestGridToRuler.toFixed(2)} px\n`;
      fullReport += `  Difference: ${diffX.toFixed(2)} px\n\n`;
    }

    // ═══════════════════════════════════════
    // 5. MARGINS & LAYOUT
    // ═══════════════════════════════════════
    fullReport += `╔═══════════════════════════════════════╗\n`;
    fullReport += `║  5️⃣  MARGINS & LAYOUT                 ║\n`;
    fullReport += `╚═══════════════════════════════════════╝\n\n`;

    fullReport += `📐 Coordinate Layout:\n`;
    fullReport += `  Left Margin (Vertical Ruler): 80 px\n`;
    fullReport += `  Top Margin (Horizontal Ruler): 30 px\n`;
    fullReport += `  Right Margin: 0 px\n`;
    fullReport += `  Bottom Margin (Status): 30 px\n\n`;

    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      fullReport += `📊 Drawing Area:\n`;
      fullReport += `  Start: (80, 30)\n`;
      fullReport += `  End: (${rect.width.toFixed(0)}, ${rect.height.toFixed(0)})\n`;
      fullReport += `  Size: ${(rect.width - 80).toFixed(0)} × ${(rect.height - 30).toFixed(0)} px\n\n`;
    }

    // ═══════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════
    fullReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    fullReport += `End of Report\n`;
    fullReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Show in modern floating panel with colored sections
    const panel = document.createElement('div');
    panel.id = 'master-diagnostic-panel';
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      max-height: 85vh;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 3px solid #10b981;
      border-radius: 12px;
      padding: 0;
      z-index: 999999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(16, 185, 129, 0.3), 0 0 0 1px rgba(255,255,255,0.1);
    `;

    // Parse and colorize sections
    const colorizeReport = (text: string) => {
      return text
        .replace(/━━━.*━━━/g, (match) => `<div style="color: #10b981; font-weight: bold; margin: 10px 0;">${match}</div>`)
        .replace(/╔═══.*═══╗/g, (match) => `<div style="background: linear-gradient(90deg, #10b981 0%, #059669 100%); color: white; padding: 8px 12px; margin: 15px 0 5px 0; border-radius: 6px; font-weight: bold;">${match.replace(/[╔╚═╗║]/g, '').trim()}</div>`)
        .replace(/╚═══.*═══╝/g, '')
        .replace(/📐 (.*?):/g, '<span style="color: #06b6d4; font-weight: 600;">📐 $1:</span>')
        .replace(/🖥️ (.*?):/g, '<span style="color: #8b5cf6; font-weight: 600;">🖥️ $1:</span>')
        .replace(/📊 (.*?):/g, '<span style="color: #f59e0b; font-weight: 600;">📊 $1:</span>')
        .replace(/🎯 (.*?):/g, '<span style="color: #ef4444; font-weight: 600;">🎯 $1:</span>')
        .replace(/🐭 (.*?):/g, '<span style="color: #ec4899; font-weight: 600;">🐭 $1:</span>')
        .replace(/🟢 (.*?):/g, '<span style="color: #22c55e; font-weight: 600;">🟢 $1:</span>')
        .replace(/📏 (.*?):/g, '<span style="color: #3b82f6; font-weight: 600;">📏 $1:</span>')
        .replace(/✅ (.*?):/g, '<span style="color: #10b981; font-weight: 600;">✅ $1:</span>')
        .replace(/(Status: )(✅ ALIGNED)/g, '$1<span style="color: #10b981; font-weight: bold;">$2</span>')
        .replace(/(Status: )(❌ MISALIGNED)/g, '$1<span style="color: #ef4444; font-weight: bold;">$2</span>');
    };

    panel.innerHTML = `
      <div style="background: linear-gradient(90deg, #10b981 0%, #059669 100%); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: white; font-size: 18px; font-weight: 600;">📋 Master Diagnostic Report</h2>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">✕ Close</button>
      </div>
      <div style="padding: 20px; max-height: calc(85vh - 140px); overflow-y: auto;">
        <pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; line-height: 1.6; color: #e2e8f0; font-size: 13px;">${colorizeReport(fullReport)}</pre>
      </div>
      <div style="background: rgba(15, 23, 42, 0.8); padding: 15px 20px; border-top: 1px solid rgba(16, 185, 129, 0.3);">
        <button onclick="navigator.clipboard.writeText(\`${fullReport.replace(/`/g, '\\`')}\`).then(() => {
          this.innerHTML = '✅ Copied!';
          setTimeout(() => this.innerHTML = '📋 Copy Full Report', 2000);
        })" style="
          width: 100%;
          background: linear-gradient(90deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">📋 Copy Full Report</button>
      </div>
    `;

    document.body.appendChild(panel);

    console.log(fullReport);
  };

  return (
    <button
      onClick={handleGenerateReport}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#059669', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#10B981')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
    >
      📋 Full Report
    </button>
  );
};
