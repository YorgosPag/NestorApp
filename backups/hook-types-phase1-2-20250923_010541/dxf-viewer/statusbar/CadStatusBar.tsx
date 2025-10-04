'use client';
import React, { useEffect } from 'react';

type Toggle = { on: boolean; toggle: () => void };

interface CadStatusBarProps {
  osnap: Toggle; 
  grid: Toggle; 
  snap: Toggle; 
  ortho: Toggle; 
  polar: Toggle; 
  dynInput: Toggle;
}

export default function CadStatusBar({
  osnap, grid, snap, ortho, polar, dynInput
}: CadStatusBarProps) {

  // 🎹 F-KEY SHORTCUTS (AutoCAD standard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input/textarea is focused
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      switch (e.key) {
        case 'F8':
          e.preventDefault();
          ortho.toggle();
          console.log('⌨️ F8 - ORTHO toggled');
          break;
        case 'F9':
          e.preventDefault();
          snap.toggle();
          console.log('⌨️ F9 - SNAP toggled');
          break;
        case 'F10':
          e.preventDefault();
          polar.toggle();
          console.log('⌨️ F10 - POLAR toggled');
          break;
        case 'F11':
          e.preventDefault();
          osnap.toggle();
          console.log('⌨️ F11 - OSNAP toggled');
          break;
        case 'F7':
          e.preventDefault();
          grid.toggle();
          console.log('⌨️ F7 - GRID toggled');
          break;
        case 'F12':
          e.preventDefault();
          dynInput.toggle();
          console.log('⌨️ F12 - DYNAMIC INPUT toggled');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [osnap, grid, snap, ortho, polar, dynInput]);

  const StatusButton = ({ label, toggle, fkey, description }: {
    label: string; 
    toggle: Toggle; 
    fkey: string;
    description: string;
  }) => (
    <button 
      onClick={toggle.toggle} 
      style={{
        ...S.btn, 
        ...(toggle.on ? S.on : {})
      }}
      title={`${description} (${fkey})`}
    >
      <span style={S.label}>{label}</span>
      <span style={S.fkey}>{fkey}</span>
    </button>
  );

  return (
    <div style={S.bar}>
      <StatusButton 
        label="OSNAP" 
        toggle={osnap} 
        fkey="F11"
        description="Object Snap - Snap to object points"
      />
      <StatusButton 
        label="GRID" 
        toggle={grid} 
        fkey="F7"
        description="Grid Display - Show/hide grid"
      />
      <StatusButton 
        label="SNAP" 
        toggle={snap} 
        fkey="F9"
        description="Grid Snap - Snap to grid points"
      />
      <StatusButton 
        label="ORTHO" 
        toggle={ortho} 
        fkey="F8"
        description="Orthogonal Mode - Constrain to 0/90/180/270 degrees"
      />
      <StatusButton 
        label="POLAR" 
        toggle={polar} 
        fkey="F10"
        description="Polar Tracking - Track along polar angles"
      />
      <StatusButton 
        label="DYN" 
        toggle={dynInput} 
        fkey="F12"
        description="Dynamic Input - Show coordinates near cursor"
      />

      {/* Status info */}
      <div style={S.statusInfo}>
        CAD Mode | Press F-keys for shortcuts
      </div>
    </div>
  );
}

const S = {
  bar: { 
    display: 'flex', 
    gap: 6, 
    padding: '6px 12px', 
    background: '#1b1b1b', 
    borderTop: '1px solid #2a2a2a', 
    alignItems: 'center',
    boxShadow: '0 -2px 4px rgba(0,0,0,0.2)'
  },
  btn: { 
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '4px 8px', 
    borderRadius: 4, 
    border: '1px solid #444', 
    background: '#252525', 
    color: '#ddd', 
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: '50px'
  },
  on: { 
    background: '#3a7afe', 
    borderColor: '#3a7afe', 
    color: '#fff',
    boxShadow: '0 0 8px rgba(58, 122, 254, 0.3)'
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    lineHeight: '1.2'
  },
  fkey: {
    fontSize: '9px',
    opacity: 0.7,
    lineHeight: '1'
  },
  statusInfo: {
    marginLeft: 'auto',
    fontSize: '11px',
    color: '#666',
    fontStyle: 'italic'
  }
} as const;
