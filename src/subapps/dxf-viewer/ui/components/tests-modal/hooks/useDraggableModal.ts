/**
 * 🖱️ useDraggableModal Hook
 * Manages modal drag & drop functionality
 */

import { useState, useEffect, useRef } from 'react';
import type { DraggableState } from '../types/tests.types';

export function useDraggableModal(isOpen: boolean): DraggableState {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Center modal on first open
  useEffect(() => {
    if (isOpen && position.x === 0 && position.y === 0) {
      const centerX = (window.innerWidth - 900) / 2; // 900px = max-w-4xl
      const centerY = 50; // Start near top
      setPosition({ x: centerX, y: centerY });
    }
  }, [isOpen, position.x, position.y]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking buttons
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return {
    position,
    isDragging,
    modalRef,
    handleMouseDown
  };
}
