import type { TableOfContentsItem } from "@/types/obligations";

export function getItemBadgeColor(type: TableOfContentsItem['type']): string {
  switch (type) {
    case 'section':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'article':
      return 'bg-accent/20 text-accent-foreground border-accent/40';
    case 'paragraph':
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}
