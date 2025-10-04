'use client';

import React from 'react';
import type { ViewTransform } from '../../rendering/types/Types';

interface PanToOriginButtonProps {
  onNotify: (message: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  onTransformChange: (transform: ViewTransform) => void;
}

export const PanToOriginButton: React.FC<PanToOriginButtonProps> = ({ onNotify, onTransformChange }) => {
  const handlePanToOrigin = () => {
    console.log('🏠 PAN TO ORIGIN (0,0) TRIGGERED');

    const canvasElement = document.querySelector('[data-canvas-type="dxf"]') as HTMLCanvasElement;
    if (!canvasElement) {
      console.error('❌ Canvas element not found');
      onNotify('Canvas not found', 'error');
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const viewport = {
      width: rect.width,
      height: rect.height
    };

    const MARGIN_LEFT = 80;
    const MARGIN_TOP = 30;

    const screenCenterX = viewport.width / 2;
    const screenCenterY = viewport.height / 2;

    const newOffsetX = screenCenterX - MARGIN_LEFT;
    const newOffsetY = (viewport.height - MARGIN_TOP) - screenCenterY;

    const newTransform: ViewTransform = {
      scale: 1,
      offsetX: newOffsetX,
      offsetY: newOffsetY
    };

    onTransformChange(newTransform);

    const canvasX = MARGIN_LEFT + newOffsetX;
    const canvasY = (viewport.height - MARGIN_TOP) - newOffsetY;

    const finalScreenX = rect.left + canvasX;
    const finalScreenY = rect.top + canvasY;

    const overlay = document.createElement('div');
    overlay.id = 'origin-indicator-overlay';
    overlay.style.cssText = `
      position: fixed;
      left: ${finalScreenX}px;
      top: ${finalScreenY}px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 10000;
    `;

    overlay.innerHTML = `
      <svg width="200" height="200" style="overflow: visible;">
        <circle cx="100" cy="100" r="60" fill="none" stroke="#ff00ff" stroke-width="3" opacity="0.8">
          <animate attributeName="r" values="60;80;60" dur="2s" repeatCount="3" />
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="3" />
        </circle>
        <circle cx="100" cy="100" r="30" fill="none" stroke="#00ffff" stroke-width="2" opacity="0.9">
          <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="3" />
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="3" />
        </circle>
        <line x1="100" y1="50" x2="100" y2="150" stroke="#ff0000" stroke-width="2" opacity="0.9" />
        <line x1="50" y1="100" x2="150" y2="100" stroke="#ff0000" stroke-width="2" opacity="0.9" />
        <circle cx="100" cy="100" r="5" fill="#ffff00" stroke="#ff0000" stroke-width="1">
          <animate attributeName="r" values="5;8;5" dur="1s" repeatCount="6" />
        </circle>
        <path d="M 100 20 L 95 35 L 105 35 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="6" />
        </path>
        <path d="M 100 180 L 95 165 L 105 165 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="6" />
        </path>
        <path d="M 20 100 L 35 95 L 35 105 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="6" />
        </path>
        <path d="M 180 100 L 165 95 L 165 105 Z" fill="#00ff00" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="6" />
        </path>
        <text x="100" y="195" text-anchor="middle" fill="#ffff00" font-size="12" font-weight="bold">
          ORIGIN
        </text>
        <text x="100" y="210" text-anchor="middle" fill="#00ffff" font-size="14" font-weight="bold">
          WORLD (0,0)
        </text>
      </svg>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {
      const elem = document.getElementById('origin-indicator-overlay');
      if (elem) {
        elem.style.transition = 'opacity 0.5s';
        elem.style.opacity = '0';
        setTimeout(() => elem.remove(), 500);
      }
    }, 6000);

    onNotify(
      `Panned to World Origin (0,0)\n\n` +
      `🎯 World (0,0) is now at screen center\n` +
      `📐 Screen Position: (${finalScreenX.toFixed(1)}, ${finalScreenY.toFixed(1)})\n` +
      `🔍 Transform: offset=(${newOffsetX.toFixed(1)}, ${newOffsetY.toFixed(1)})`,
      'success'
    );
  };

  return (
    <button
      onClick={handlePanToOrigin}
      className="px-3 py-1 text-xs font-bold rounded shadow-lg transition-all"
      style={{ backgroundColor: '#DB2777', color: '#FFFFFF' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EC4899')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#DB2777')}
    >
      🏠 Pan to (0,0)
    </button>
  );
};
