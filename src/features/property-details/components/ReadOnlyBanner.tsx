'use client';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
      <Eye className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Μόνο Προβολή</span>
      <Badge variant="outline" className="text-xs ml-auto">Δημόσια Προβολή</Badge>
    </div>
  );
}
