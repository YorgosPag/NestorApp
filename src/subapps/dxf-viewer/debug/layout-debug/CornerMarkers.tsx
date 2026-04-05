'use client';
import React, { useEffect, useState } from 'react';
// Enterprise CSS Module - CLAUDE.md Protocol N.3 compliance
import styles from './DebugOverlay.module.css';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface CornerPosition {
  x: number;
  y: number;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export default function CornerMarkers() {
  const [positions, setPositions] = useState<CornerPosition[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const { t } = useTranslation('dxf-viewer-settings');

  useEffect(() => {
    const updatePositions = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      setViewport({ width: vw, height: vh });

      const corners: CornerPosition[] = [
        { x: 0, y: 0, corner: 'top-left' },
        { x: vw, y: 0, corner: 'top-right' },
        { x: 0, y: vh, corner: 'bottom-left' },
        { x: vw, y: vh, corner: 'bottom-right' }
      ];

      setPositions(corners);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);

    return () => window.removeEventListener('resize', updatePositions);
  }, []);

  return (
    <div className={styles.cornerMarkersContainer}>
      {positions.map(({ x, y, corner }) => (
        <div
          key={corner}
          className={cn(
            styles.cornerMarkerBase,
            corner === 'top-left' && styles.cornerMarkerTopLeft,
            corner === 'top-right' && styles.cornerMarkerTopRight,
            corner === 'bottom-left' && styles.cornerMarkerBottomLeft,
            corner === 'bottom-right' && styles.cornerMarkerBottomRight
          )}
        >
          {/* Corner marker visual representation */}
          <div className={styles.cornerMarkerLines}>
            {/* Dynamic positioning maintained only for runtime calculations */}
            <span className={styles.srOnly}>Corner marker at {corner}: ({x}, {y})</span>
          </div>

          {/* Corner label - positioned via CSS classes */}
          <div className={styles.cornerDebugItem}>
            <span className={styles.srOnly}>
              {corner}: ({x},{y})
            </span>
          </div>
        </div>
      ))}

      {/* Layout debug lines */}
      {/* Top border line */}
      <div className={styles.cornerLineYellow} />

      {/* Bottom border line */}
      <div className={styles.cornerLineRed} />

      {/* Left border line */}
      <div className={styles.cornerLineGreen} />

      {/* Right border line */}
      <div className={styles.cornerLineBlue} />

      {/* Corner markers debug info panel */}
      <div className={styles.cornerDebugInfo}>
        <div className={styles.cornerDebugTitle}>🎯 LAYOUT DEBUGGING</div>
        <div className={styles.cornerDebugItem}>Viewport: {viewport.width}x{viewport.height}</div>
        <div className={styles.cornerDebugLabel}>
          <span className={styles.cornerDebugLabelYellow}>{t('debugCorners.yellowLine')}</span> (top)<br/>
          <span className={styles.cornerDebugValue}>Y = 0px</span>
        </div>
        <div className={styles.cornerDebugLabel}>
          <span className={styles.cornerDebugLabelRed}>{t('debugCorners.redLine')}</span> (bottom)<br/>
          <span className={styles.cornerDebugValue}>Y = {viewport.height}px</span>
        </div>
        <div className={styles.cornerDebugLabel}>
          <span className={styles.cornerDebugLabelGreen}>{t('debugCorners.greenLine')}</span> (left)<br/>
          <span className={styles.cornerDebugValue}>X = 0px</span>
        </div>
        <div className={styles.cornerDebugLabel}>
          <span className={styles.cornerDebugLabelBlue}>{t('debugCorners.blueLine')}</span> (right)<br/>
          <span className={styles.cornerDebugValue}>X = {viewport.width}px</span>
        </div>
        <div className={styles.cornerDebugNote}>{t('debugCorners.allLines')}</div>
      </div>
    </div>
  );
}