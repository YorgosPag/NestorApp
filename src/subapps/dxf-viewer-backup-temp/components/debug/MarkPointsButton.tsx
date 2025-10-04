'use client';

/**
 * MARK POINTS DEBUG BUTTON
 * Interactive point marking tool for coordinate debugging
 */

import React from 'react';

interface MarkPointsButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
}

export const MarkPointsButton: React.FC<MarkPointsButtonProps> = ({ onNotify, canvasTransform }) => {
  const handleMarkPoints = () => {
    console.log('📍 MARK POINTS MODE ACTIVATED');

    // Create overlay for marking points
    let markingActive = true;
    let markedPoints: Array<{ screen: { x: number; y: number }; canvas: { x: number; y: number }; world: { x: number; y: number }; index: number }> = [];
    let markerIndex = 0;

    const overlay = document.createElement('div');
    overlay.id = 'mark-points-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999998;
      cursor: crosshair;
      background: rgba(0, 0, 0, 0.1);
    `;

    // Instructions panel
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 3px solid #EF4444;
      border-radius: 12px;
      padding: 15px 25px;
      z-index: 999999;
      color: white;
      font-family: 'Segoe UI', sans-serif;
      font-size: 14px;
      box-shadow: 0 10px 30px rgba(239, 68, 68, 0.5);
    `;
    instructions.innerHTML = `
      <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">📍 Mark Points Mode</div>
      <div>Click anywhere to mark points • ESC or Right-click to finish</div>
      <div style="margin-top: 8px; font-size: 12px; color: #FBBF24;">Marked: <span id="point-counter">0</span> points</div>
    `;

    overlay.appendChild(instructions);

    // Click handler
    const handleClick = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left click

      const screenX = e.clientX;
      const screenY = e.clientY;

      // Get canvas element
      const canvasEl = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
      if (!canvasEl) return;

      const rect = canvasEl.getBoundingClientRect();
      const canvasX = screenX - rect.left;
      const canvasY = screenY - rect.top;

      // Calculate world coordinates
      const transform = canvasTransform;
      const viewport = { width: rect.width, height: rect.height };
      const worldX = (canvasX - 80 - transform.offsetX) / transform.scale;
      const worldY = ((viewport.height - 30) - canvasY - transform.offsetY) / transform.scale;

      // Add marker
      markerIndex++;
      const marker = document.createElement('div');
      marker.style.cssText = `
        position: fixed;
        left: ${screenX}px;
        top: ${screenY}px;
        width: 24px;
        height: 24px;
        background: #EF4444;
        border: 3px solid white;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 11px;
        font-family: Arial;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      `;
      marker.textContent = markerIndex.toString();
      overlay.appendChild(marker);

      // Store point
      markedPoints.push({
        screen: { x: screenX, y: screenY },
        canvas: { x: canvasX, y: canvasY },
        world: { x: worldX, y: worldY },
        index: markerIndex
      });

      // Update counter
      const counter = document.getElementById('point-counter');
      if (counter) counter.textContent = markerIndex.toString();

      console.log('📍 Point ' + markerIndex + ' marked:', {
        screen: { x: screenX, y: screenY },
        canvas: { x: canvasX, y: canvasY },
        world: { x: worldX.toFixed(2), y: worldY.toFixed(2) }
      });
    };

    // Finish handler
    const finishMarking = () => {
      if (!markingActive) return;
      markingActive = false;

      // Remove overlay
      document.body.removeChild(overlay);

      // Generate report
      let report = '📍 MARKED POINTS REPORT\n\n';
      report += 'Total Points: ' + markedPoints.length + '\n\n';

      markedPoints.forEach(point => {
        report += '━━━ Point #' + point.index + ' ━━━\n';
        report += 'Screen: (' + point.screen.x + ', ' + point.screen.y + ')\n';
        report += 'Canvas: (' + point.canvas.x.toFixed(2) + ', ' + point.canvas.y.toFixed(2) + ')\n';
        report += 'World: (' + point.world.x.toFixed(2) + ', ' + point.world.y.toFixed(2) + ')\n\n';
      });

      // Show report in notification
      onNotify(report, 'info');
      console.log(report);

      // Also save to clipboard
      navigator.clipboard.writeText(report).then(() => {
        console.log('📋 Points report copied to clipboard');
      });
    };

    // Key handler for ESC
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishMarking();
      }
    };

    // Right-click handler
    const handleRightClick = (e: MouseEvent) => {
      e.preventDefault();
      finishMarking();
    };

    overlay.addEventListener('click', handleClick);
    overlay.addEventListener('contextmenu', handleRightClick);
    document.addEventListener('keydown', handleKey);

    document.body.appendChild(overlay);
  };

  return (
    <button
      onClick={handleMarkPoints}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#EF4444', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#DC2626')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#EF4444')}
    >
      📍 Mark Points
    </button>
  );
};
