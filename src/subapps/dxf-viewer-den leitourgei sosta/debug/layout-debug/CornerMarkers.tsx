'use client';
import React, { useEffect, useState } from 'react';

interface CornerPosition {
  x: number;
  y: number;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export default function CornerMarkers() {
  const [positions, setPositions] = useState<CornerPosition[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

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

      // 🎯 DEBUG: Εκτύπωση ακριβών συντεταγμένων
      console.log('🔧 CORNER MARKERS POSITIONS:');
      console.log('  - Viewport:', vw, 'x', vh);
      corners.forEach(corner => {
        console.log(`  - ${corner.corner}: (${corner.x}, ${corner.y})`);
      });
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);

    return () => window.removeEventListener('resize', updatePositions);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2147483646 }}>
      {positions.map(({ x, y, corner }) => (
        <div
          key={corner}
          className="absolute"
          style={{
            left: corner.includes('right') ? x - 40 : x,
            top: corner.includes('bottom') ? y - 40 : y,
            width: 40,
            height: 40,
            pointerEvents: 'none'
          }}
        >
          {/* Κόκκινες γραμμές που σχηματίζουν γωνία - ΣΩΣΤΗ ΛΟΓΙΚΗ */}

          {/* Οριζόντια γραμμή */}
          <div
            className="absolute bg-red-500"
            style={{
              width: '30px',
              height: '4px',
              top: corner.includes('bottom') ? '36px' : '0px',
              left: corner.includes('right') ? '10px' : '0px' // δεξιά: 10px μέσα, αριστερά: από άκρο
            }}
          />

          {/* Κάθετη γραμμή */}
          <div
            className="absolute bg-red-500"
            style={{
              width: '4px',
              height: '30px',
              top: corner.includes('bottom') ? '10px' : '0px', // κάτω: 10px μέσα, πάνω: από άκρο
              left: corner.includes('right') ? '36px' : '2px'  // ✅ SAFE: 2px offset για αριστερές γωνίες
            }}
          />

          {/* Ετικέτα με συντεταγμένες */}
          <div
            className="absolute text-xs font-mono text-red-500 bg-black bg-opacity-80 px-1 rounded whitespace-nowrap"
            style={{
              top: corner.includes('bottom') ? '-20px' : '45px',
              left: corner.includes('right') ? '-80px' : '0px'
            }}
          >
            {corner}<br/>
            ({x},{y})
          </div>
        </div>
      ))}

      {/* 🎯 ΝΟΗΤΕΣ ΓΡΑΜΜΕΣ DEBUG - Horizontal lines connecting corners */}

      {/* Πάνω νοητή γραμμή - 2px ΑΚΡΙΒΩΣ */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: '100vw',
          height: '2px',
          backgroundColor: '#FFFF00',
          pointerEvents: 'none',
          zIndex: 2147483645
        }}
      />

      {/* Κάτω νοητή γραμμή - 2px ΑΚΡΙΒΩΣ */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: viewport.height - 2,
          width: '100vw',
          height: '2px',
          backgroundColor: '#FF0000',
          pointerEvents: 'none',
          zIndex: 2147483645
        }}
      />

      {/* Αριστερή νοητή γραμμή - 2px ΑΚΡΙΒΩΣ */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: '2px',
          height: '100vh',
          backgroundColor: '#00FF00', // ΠΡΑΣΙΝΗ για αριστερή
          pointerEvents: 'none',
          zIndex: 2147483645
        }}
      />

      {/* Δεξιά νοητή γραμμή - 2px ΑΚΡΙΒΩΣ */}
      <div
        className="absolute"
        style={{
          left: viewport.width - 2,
          top: 0,
          width: '2px',
          height: '100vh',
          backgroundColor: '#0000FF', // ΜΠΛΕ για δεξιά
          pointerEvents: 'none',
          zIndex: 2147483645
        }}
      />

      {/* 🎯 INFO PANEL - ΚΑΤΩ ΑΡΙΣΤΕΡΗ ΓΩΝΙΑ ΑΚΡΙΒΩΣ ΣΤΟ (0, 1080) */}
      <div
        style={{
          position: 'fixed', // FIXED για ακριβή θέση
          left: '0px', // X = 0 ΑΚΡΙΒΩΣ
          bottom: `${viewport.height - 1080}px`, // ΚΑΤΩ ΓΩΝΙΑ στο Y=1080 ακριβώς
          width: '250px',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          color: 'rgb(74, 222, 128)', // text-green-400
          padding: '12px',
          fontSize: '12px',
          fontFamily: 'monospace',
          border: '1px solid #666',
          pointerEvents: 'none'
        }}
      >
        <div style={{ color: 'rgb(34, 211, 238)', fontWeight: 'bold', marginBottom: '4px' }}>🎯 LAYOUT DEBUGGING</div>
        <div style={{ marginBottom: '4px' }}>Viewport: {viewport.width}x{viewport.height}</div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: 'rgb(251, 191, 36)' }}>Κίτρινη γραμμή</span> (πάνω)<br/>
          <span style={{ fontSize: '0.75rem' }}>Y = 0px</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: 'rgb(248, 113, 113)' }}>Κόκκινη γραμμή</span> (κάτω)<br/>
          <span style={{ fontSize: '0.75rem' }}>Y = {viewport.height}px</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: 'rgb(74, 222, 128)' }}>Πράσινη γραμμή</span> (αριστερά)<br/>
          <span style={{ fontSize: '0.75rem' }}>X = 0px</span>
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span style={{ color: 'rgb(96, 165, 250)' }}>Μπλε γραμμή</span> (δεξιά)<br/>
          <span style={{ fontSize: '0.75rem' }}>X = {viewport.width}px</span>
        </div>
        <div style={{ color: 'rgb(251, 191, 36)', fontSize: '0.75rem' }}>Όλες οι γραμμές: 2px πάχος</div>
      </div>
    </div>
  );
}