'use client';

import React, { ReactNode } from 'react';
import type { Point2D } from '../../../rendering/types/Types';

interface DynamicInputContainerProps {
  position: Point2D;
  showInput: boolean;
  children: ReactNode;
}

export function DynamicInputContainer({ position, showInput, children }: DynamicInputContainerProps) {
  return (
    <div
      className={`absolute z-[1600] -translate-y-full ${showInput ? 'visible pointer-events-auto' : 'invisible pointer-events-none'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <div className="bg-transparent text-white p-3 min-w-[220px]">
        {children}
      </div>
    </div>
  );
}