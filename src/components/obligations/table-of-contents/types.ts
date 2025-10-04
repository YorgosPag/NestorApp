import type { TableOfContentsItem } from "@/types/obligations";

export interface TableOfContentsProps {
  items: TableOfContentsItem[];
  onItemClick?: (item: TableOfContentsItem) => void;
  activeItemId?: string;
  showPageNumbers?: boolean;
  compact?: boolean;
  className?: string;
}

export interface TocHeaderProps {
    items: TableOfContentsItem[];
    compact?: boolean;
    expandedIds: string[];
    onExpandAll: () => void;
    onCollapseAll: () => void;
}
  
export interface TocBodyProps extends Omit<TableOfContentsProps, "className"> {
    expandedIds: string[];
    onToggle: (id: string) => void;
}

export interface TocItemProps {
  item: TableOfContentsItem;
  level: number;
  expandedIds: string[];
  activeItemId?: string;
  compact?: boolean;
  showPageNumbers?: boolean;
  onToggle: (id: string) => void;
  onClick?: (item: TableOfContentsItem) => void;
}
