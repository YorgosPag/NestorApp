import React from 'react';

export const CrosshairIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0v6M8 10v6M0 8h6M10 8h6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

export const SelectionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="2,2"/>
    <rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

export const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2h12v12H2z" stroke="currentColor" strokeWidth="1" fill="none"/>
    <path d="M6 2v12M10 2v12M2 6h12M2 10h12" stroke="currentColor" strokeWidth="0.5"/>
  </svg>
);

export const GripsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="2" y="6" width="12" height="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
    <circle cx="8" cy="4" r="1.5" fill="currentColor"/>
    <circle cx="8" cy="12" r="1.5" fill="currentColor"/>
  </svg>
);

export const LayersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 4l6-2 6 2-6 2-6-2z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M2 8l6 2 6-2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M2 12l6 2 6-2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

export const CanvasIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <rect x="1" y="2" width="14" height="11" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <rect x="2" y="3" width="12" height="9" stroke="currentColor" strokeWidth="0.5" fill="none"/>
    <path d="M4 6l2 3 2-2 3 2" stroke="currentColor" strokeWidth="1" fill="none"/>
    <circle cx="5" cy="6" r="1" fill="currentColor"/>
  </svg>
);

export const LightingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M8 1v2M8 13v2M15 8h-2M3 8H1M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4M12.5 12.5l-1.4-1.4M4.9 4.9L3.5 3.5" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

export const EntitiesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    {/* Line tool */}
    <line x1="2" y1="3" x2="6" y2="3" stroke="currentColor" strokeWidth="1.5"/>
    {/* Rectangle tool */}
    <rect x="2" y="5" width="4" height="2.5" stroke="currentColor" strokeWidth="1" fill="none"/>
    {/* Circle tool */}
    <circle cx="11" cy="4" r="2" stroke="currentColor" strokeWidth="1" fill="none"/>
    {/* Polyline tool */}
    <path d="M9 9l2 2 2-1.5 1 2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    {/* Measurement ruler */}
    <line x1="2" y1="11" x2="6" y2="11" stroke="currentColor" strokeWidth="1"/>
    <line x1="2" y1="10.5" x2="2" y2="11.5" stroke="currentColor" strokeWidth="1"/>
    <line x1="6" y1="10.5" x2="6" y2="11.5" stroke="currentColor" strokeWidth="1"/>
    {/* Settings gear teeth */}
    <circle cx="4" cy="13" r="1" stroke="currentColor" strokeWidth="0.8" fill="none"/>
    <path d="M4 12.2v-0.4M4 14.2v-0.4M4.8 13h0.4M3.2 13h-0.4" stroke="currentColor" strokeWidth="0.6"/>
  </svg>
);