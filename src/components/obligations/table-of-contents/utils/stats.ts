import { useMemo } from 'react';
import type { TableOfContentsItem } from '@/types/obligations';

export function useTocStats(items: TableOfContentsItem[]) {
  return useMemo(() => {
    const sections = items.length;
    const articles = items.reduce((sum, item) => sum + (item.children?.length || 0), 0);
    const paragraphs = items.reduce((sum, item) =>
      sum + (item.children?.reduce((childSum, child) =>
        childSum + (child.children?.length || 0), 0) || 0), 0);
    
    return { sections, articles, paragraphs };
  }, [items]);
}
