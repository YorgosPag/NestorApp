'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import type { Property } from '@/types/property-viewer';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';


// Safe date formatting function
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Άγνωστη Ημερομηνία';
    }
    return date.toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Άκυρη Ημερομηνία';
  }
}

interface UnitListItemFooterProps {
  unit: Property;
}

export function UnitListItemFooter({ unit }: UnitListItemFooterProps) {
  if (unit.status !== 'sold' && unit.status !== 'rented') {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground p-0 h-auto" asChild>
               <Link href="/crm/calendar">
                <Clock className="w-3 h-3 mr-2" />
                <span>Διαθέσιμο για προβολή</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Προγραμματισμός ξενάγησης στο ημερολόγιο</p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const dateLabel = unit.status === 'sold' ? 'Ημ/νία Πώλησης:' : 'Ημ/νία Ενοικίασης:';

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>{dateLabel} {formatDate(unit.saleDate)}</span>
      </div>
    </div>
  );
}
