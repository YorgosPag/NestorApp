"use client";

import { Badge } from "@/components/ui/badge";
import type { TableOfContentsItem } from '@/types/obligations';
import { cn } from "@/lib/utils";

interface TableOfContentsPartProps {
  toc: TableOfContentsItem[];
  activeItemId?: string;
  onClick: (item: TableOfContentsItem) => void;
  show?: boolean;
}

export function TableOfContentsPart({ toc, activeItemId, onClick, show }: TableOfContentsPartProps) {
  if (!show || toc.length === 0) return null;

  const renderTocItem = (item: TableOfContentsItem, level: number = 0) => (
    <div key={item.id} className="space-y-1">
      <div
        className={cn(
          "flex justify-between items-center py-2 px-3 rounded cursor-pointer hover:bg-gray-50",
          level > 0 && `ml-${level * 6}`,
          activeItemId === item.id && (level === 0 ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700")
        )}
        onClick={() => onClick(item)}
      >
        <div className="flex items-center gap-3">
          <Badge variant={level === 0 ? "outline" : "secondary"} className="font-mono text-xs min-w-8">
            {item.number}
          </Badge>
          <span className={cn("text-sm", level === 0 && "font-medium")}>
            {item.title}
          </span>
        </div>
        {item.page && (
          <span className="text-xs text-gray-500">σελ. {item.page}</span>
        )}
      </div>
      {item.children?.map(child => renderTocItem(child, level + 1))}
    </div>
  );

  return (
    <div className="p-6 border-b">
      <h3 className="text-lg font-semibold mb-4 text-center">ΠΙΝΑΚΑΣ ΠΕΡΙΕΧΟΜΕΝΩΝ</h3>
      <div className="space-y-2">
        {toc.map(item => renderTocItem(item, 0))}
      </div>
    </div>
  );
}
