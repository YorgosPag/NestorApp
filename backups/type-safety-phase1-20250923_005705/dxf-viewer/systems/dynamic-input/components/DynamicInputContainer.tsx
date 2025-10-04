'use client';

import React, { ReactNode } from 'react';

interface DynamicInputContainerProps {
  position: { x: number; y: number };
  showInput: boolean;
  children: ReactNode;
}

export function DynamicInputContainer({ position, showInput, children }: DynamicInputContainerProps) {
  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1600,
        transform: 'translateY(-100%)',
        visibility: showInput ? 'visible' : 'hidden',
        pointerEvents: showInput ? 'auto' : 'none'
      }}
    >
      <div className="bg-transparent text-white p-3 min-w-[220px]">
        {children}
      </div>
    </div>
  );
}