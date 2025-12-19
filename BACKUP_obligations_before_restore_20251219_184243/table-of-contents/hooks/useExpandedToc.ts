"use client";

import { useState, useCallback } from 'react';
import type { TableOfContentsItem } from '@/types/obligations';

export function useExpandedToc(items: TableOfContentsItem[]) {
  const [expandedIds, setExpandedIds] = useState<string[]>(
    items.filter(item => item.type === 'section').map(item => item.id)
  );

  const toggle = useCallback((itemId: string) => {
    setExpandedIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  }, []);

  const expandAll = useCallback(() => {
    const allIds = items.flatMap(item => [
      item.id,
      ...(item.children?.flatMap(child => [
        child.id,
        ...(child.children?.map(grandchild => grandchild.id) || [])
      ]) || [])
    ]);
    setExpandedIds(allIds);
  }, [items]);

  const collapseAll = useCallback(() => {
    setExpandedIds([]);
  }, []);

  return { expandedIds, toggle, expandAll, collapseAll };
}
