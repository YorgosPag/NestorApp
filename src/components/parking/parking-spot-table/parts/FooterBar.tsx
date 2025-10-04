'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface FooterBarProps {
  filteredCount: number;
  totalCount: number;
}

export function FooterBar({ filteredCount, totalCount }: FooterBarProps) {
  return (
    <div className="p-3 border-t bg-muted/30 flex justify-between items-center shrink-0">
      <div>
        <Badge variant="secondary">{filteredCount} / {totalCount} εγγραφές</Badge>
      </div>
      <div>
        {/* Totals could be added here */}
      </div>
    </div>
  );
}
