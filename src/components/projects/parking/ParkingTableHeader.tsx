'use client';

import React, { useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParkingColumnHeader } from './ParkingColumnHeader';
import { ParkingColumnFilter } from './ParkingColumnFilter';

// Τύποι για τις props
interface ParkingTableHeaderProps {
  columns: Array<{ key: string; label: string; format?: (value: any) => string }>;
  columnWidths: number[];
  onColumnResize: (newWidths: number[]) => void;
  filters: { [key: string]: string };
  onFilterChange: (columnKey: string, value: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (columnKey: string) => void;
}

export function ParkingTableHeader({
  columns,
  columnWidths,
  onColumnResize,
  filters,
  onFilterChange,
  sortConfig,
  onSort,
}: ParkingTableHeaderProps) {

  const headerRef = useRef<HTMLDivElement>(null);
  const activeResizeIndex = useRef<number | null>(null);

  const handleMouseDown = useCallback((index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    activeResizeIndex.current = index;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (activeResizeIndex.current === null || !headerRef.current) return;

    const gridElement = headerRef.current;
    const newWidths = [...columnWidths];
    const leftColumnIndex = activeResizeIndex.current;

    const leftColumn = gridElement.children[leftColumnIndex] as HTMLElement;
    
    if (leftColumn) {
        const leftEdge = leftColumn.getBoundingClientRect().left;
        const newLeftWidth = e.clientX - leftEdge;
        
        if (newLeftWidth > 50) { // Minimum width
          newWidths[leftColumnIndex] = newLeftWidth;
          onColumnResize(newWidths);
        }
    }
  }, [columnWidths, onColumnResize]);

  const handleMouseUp = useCallback(() => {
    activeResizeIndex.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="shrink-0 text-sm">
      {/* Headers */}
      <div 
        ref={headerRef}
        className="w-full h-10 border-b flex bg-muted/30 relative"
      >
        {columns.map((col, index) => (
          <ParkingColumnHeader
            key={col.key}
            column={col}
            width={columnWidths[index]}
            sortConfig={sortConfig}
            onSort={onSort}
            onResizeStart={handleMouseDown(index)}
          />
        ))}
      </div>
      
      {/* Filters */}
      <div className="flex w-full border-b bg-muted/20 items-stretch p-1 gap-1 min-w-max">
        {columns.map((col, index) => (
          <ParkingColumnFilter
            key={col.key}
            column={col}
            width={columnWidths[index]}
            value={filters[col.key] || ''}
            onFilterChange={onFilterChange}
          />
        ))}
      </div>
    </div>
  );
}
