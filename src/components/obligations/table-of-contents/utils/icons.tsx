import { FileText, Hash, List } from 'lucide-react';
import type { TableOfContentsItem } from '@/types/obligations';

export function getItemIcon(type: TableOfContentsItem['type']): React.ElementType {
  switch (type) {
    case 'section':
      return FileText;
    case 'article':
      return Hash;
    case 'paragraph':
      return List;
    default:
      return FileText;
  }
}
