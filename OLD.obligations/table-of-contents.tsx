"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Hash,
  List,
  Eye,
  Printer
} from 'lucide-react';
import { TableOfContentsItem } from '@/types/obligations';
import { cn } from '@/lib/utils';
import TableOfContents from './table-of-contents/TableOfContents';

interface TableOfContentsProps {
  items: TableOfContentsItem[];
  onItemClick?: (item: TableOfContentsItem) => void;
  activeItemId?: string;
  showPageNumbers?: boolean;
  compact?: boolean;
  className?: string;
}

export { default as CompactTableOfContents } from './table-of-contents/CompactTableOfContents';
export { default as PrintTableOfContents } from './table-of-contents/PrintTableOfContents';

// Named export που χρειάζεται το Sidebar
export { TableOfContents };

export default TableOfContents;
