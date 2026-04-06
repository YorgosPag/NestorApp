/**
 * VIRTUALIZED LIST & TABLE COMPONENTS
 * Extracted from PerformanceComponents.tsx (ADR-065 SRP split)
 *
 * High-performance virtualized rendering for large datasets.
 */

import React, { memo, useMemo, useCallback, useState, useRef, ReactNode } from 'react';
import { useTheme } from '@/subapps/geo-canvas/ui/design-system/theme/ThemeProvider';
import {
  getVirtualizedTableContainerStyles,
  getVirtualListStyles,
  getTableRowStyles,
  getTableCellStyles,
  getVirtualizedTableClass,
} from './PerformanceComponents.styles';

// ============================================================================
// VIRTUALIZED LIST
// ============================================================================

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  keyExtractor?: (item: T, index: number) => string;
}

export const VirtualizedList = memo(<T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  keyExtractor = (_, index) => index.toString()
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const visibleItemCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length - 1, start + visibleItemCount + 2 * overscan);

    return { startIndex: start, endIndex: end, totalHeight: items.length * itemHeight };
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      item,
      originalIndex: startIndex + index,
    }));
  }, [items, startIndex, endIndex]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={getVirtualizedTableContainerStyles(containerHeight)}
      onScroll={handleScroll}
    >
      <div className="" style={getVirtualListStyles(totalHeight)}>
        {visibleItems.map(({ item, originalIndex }) => (
          <div
            key={keyExtractor(item, originalIndex)}
            className=""
            style={{
              top: `${originalIndex * itemHeight}px`,
              height: `${itemHeight}px`,
            }}
          >
            {renderItem(item, originalIndex)}
          </div>
        ))}
      </div>
    </div>
  );
}) as <T>(props: VirtualizedListProps<T>) => JSX.Element;

// ============================================================================
// VIRTUALIZED TABLE
// ============================================================================

interface Column<T> {
  key: string;
  title: string;
  width?: number;
  render: (item: T, index: number) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight: number;
  containerHeight: number;
  headerHeight?: number;
  className?: string;
  keyExtractor?: (item: T, index: number) => string;
  onRowClick?: (item: T, index: number) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
}

export const VirtualizedTable = memo(<T,>({
  data,
  columns,
  rowHeight,
  containerHeight,
  headerHeight = 40,
  className = '',
  keyExtractor = (_, index) => index.toString(),
  onRowClick,
  sortBy,
  sortDirection = 'asc',
  onSort,
}: VirtualizedTableProps<T>) => {
  const { isDark } = useTheme();

  const handleSort = useCallback((columnKey: string) => {
    if (!onSort) return;
    const newDirection = sortBy === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  }, [sortBy, sortDirection, onSort]);

  const renderRow = useCallback((item: T, index: number) => (
    <div
      className=""
      style={getTableRowStyles(Boolean(onRowClick))}
      onClick={() => onRowClick?.(item, index)}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          className={`table-cell ${
            column.align === 'center' ? 'text-center' :
            column.align === 'right' ? 'text-right' : ''
          }`}
          style={getTableCellStyles(column.width)}
        >
          {column.render(item, index)}
        </div>
      ))}
    </div>
  ), [columns, onRowClick]);

  return (
    <div
      className={getVirtualizedTableClass(className)}
      style={getVirtualizedTableContainerStyles(containerHeight, className)}
    >
      {/* Header */}
      <div className="table-header flex items-center" style={{ height: `${headerHeight}px` }}>
        {columns.map((column) => (
          <div
            key={column.key}
            className={`table-header-cell ${
              column.align === 'center' ? 'text-center' :
              column.align === 'right' ? 'text-right' : ''
            }`}
            style={{
              ...getTableCellStyles(column.width),
              cursor: column.sortable ? 'pointer' : 'default',
            }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            {column.title}
            {column.sortable && sortBy === column.key && (
              <span className="sort-indicator ml-1">
                {sortDirection === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
        ))}
      </div>

      <VirtualizedList
        items={data}
        itemHeight={rowHeight}
        containerHeight={containerHeight - headerHeight}
        renderItem={renderRow}
        keyExtractor={keyExtractor}
      />
    </div>
  );
}) as <T>(props: VirtualizedTableProps<T>) => JSX.Element;
