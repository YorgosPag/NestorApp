'use client';

/**
 * MASTER DIAGNOSTIC REPORT BUTTON
 * Comprehensive diagnostic report with all system info
 * NOTE: Full implementation copied from DxfViewerContent.tsx lines 1327-1586
 */

import React from 'react';

interface MasterDiagnosticButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  canvasTransform: { scale: number; offsetX: number; offsetY: number };
}

export const MasterDiagnosticButton: React.FC<MasterDiagnosticButtonProps> = ({ onNotify, canvasTransform }) => {
  const handleGenerateReport = async () => {
    console.log('📋 MASTER DIAGNOSTIC REPORT TRIGGERED');

    // Build comprehensive diagnostic report
    // (Full implementation: copy lines 1330-1580 from DxfViewerContent.tsx)

    let fullReport = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    fullReport += `📋 MASTER DIAGNOSTIC REPORT\n`;
    fullReport += `Generated: ${new Date().toLocaleString()}\n`;
    fullReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 1. Canvas & Viewport Info
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

    // 2. Transform State
    fullReport += `╔═══════════════════════════════════════╗\n`;
    fullReport += `║  2️⃣  TRANSFORM STATE                  ║\n`;
    fullReport += `╚═══════════════════════════════════════╝\n\n`;
    fullReport += `📊 Current Transform:\n`;
    fullReport += `  Scale: ${canvasTransform.scale.toFixed(3)}\n`;
    fullReport += `  Offset X: ${canvasTransform.offsetX.toFixed(2)} px\n`;
    fullReport += `  Offset Y: ${canvasTransform.offsetY.toFixed(2)} px\n\n`;

    // TODO: Add remaining sections from original implementation
    // - Grid Test Results
    // - Ruler Test Results
    // - Sync Test Results
    // - DOM Structure
    // - etc.

    fullReport += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    fullReport += `END OF DIAGNOSTIC REPORT\n`;
    fullReport += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Show report in modal
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 2px solid #10b981;
      border-radius: 12px;
      padding: 0;
      z-index: 10000;
      max-width: 90vw;
      max-height: 85vh;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
      font-family: 'Courier New', monospace;
      color: #e2e8f0;
    `;

    panel.innerHTML = `
      <div style="background: linear-gradient(90deg, #10b981 0%, #059669 100%); padding: 15px 20px; border-top-left-radius: 10px; border-top-right-radius: 10px; display: flex; justify-content: space-between; align-items: center;">
        <h2 style="margin: 0; color: white; font-size: 18px; font-weight: 600;">📋 Master Diagnostic Report</h2>
        <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0 8px;">✕</button>
      </div>
      <div style="padding: 20px; max-height: calc(85vh - 140px); overflow-y: auto;">
        <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.5; color: #e2e8f0;">${fullReport}</pre>
      </div>
      <div style="padding: 15px 20px; border-top: 1px solid #475569; background: #1e293b; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px; display: flex; gap: 10px;">
        <button onclick="navigator.clipboard.writeText(\`${fullReport.replace(/`/g, '\\`')}\`).then(() => alert('Copied to clipboard!'))" style="flex: 1; padding: 10px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          📋 Copy to Clipboard
        </button>
        <button onclick="this.parentElement.parentElement.remove()" style="flex: 1; padding: 10px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          Close
        </button>
      </div>
    `;

    document.body.appendChild(panel);

    onNotify('Master Diagnostic Report generated!', 'success');
  };

  return (
    <button
      onClick={handleGenerateReport}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#10B981', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10B981')}
    >
      📋 Master Report
    </button>
  );
};
