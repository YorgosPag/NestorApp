'use client';

import React from 'react';

interface OverflowContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function OverflowContainer({ children, className = '' }: OverflowContainerProps) {
  return (
    <div
      className={`w-full max-w-screen overflow-x-auto overflow-y-visible ${className}`}
    >
      {children}
    </div>
  );
}