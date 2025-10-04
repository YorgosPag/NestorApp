import { useState, useEffect, useCallback, RefObject } from 'react';

export interface CanvasDimensions {
  width: number;
  height: number;
}

export function useCanvasDimensions(
  containerRef: RefObject<HTMLElement>,
  minSize: CanvasDimensions,
  maxSize: CanvasDimensions
) {
  const [dimensions, setDimensions] = useState<CanvasDimensions>(minSize);

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(Math.max(rect.width, minSize.width), maxSize.width);
      const newHeight = Math.min(Math.max(rect.height, minSize.height), maxSize.height);
      
      setDimensions({ width: newWidth, height: newHeight });
    }
  }, [containerRef, minSize, maxSize]);

  useEffect(() => {
    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [updateDimensions, containerRef]);

  return { dimensions, updateDimensions };
}
