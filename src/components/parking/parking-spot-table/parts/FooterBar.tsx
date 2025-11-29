'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';

interface FooterBarProps {
  filteredCount: number;
  totalCount: number;
}

export function FooterBar({ filteredCount, totalCount }: FooterBarProps) {
  return (
    <div className="p-3 border-t bg-muted/30 flex justify-between items-center shrink-0">
      <div>
        <CommonBadge
          status="company"
          customLabel={`${filteredCount} / ${totalCount} εγγραφές`}
          variant="secondary"
        />
      </div>
      <div>
        {/* Totals could be added here */}
      </div>
    </div>
  );
}
