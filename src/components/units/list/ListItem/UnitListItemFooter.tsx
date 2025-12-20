'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, Clock } from 'lucide-react';
import type { Property } from '@/types/property-viewer';
import { formatDate as formatDateCentralized } from '@/lib/intl-utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { UnitCustomerDisplay } from '@/components/shared/customer-info';


// ✅ ENTERPRISE MIGRATION: Using centralized formatDate for consistent formatting
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return 'Άγνωστη Ημερομηνία';
    }
    return formatDateCentralized(date); // ✅ Using centralized function
  } catch (error) {
    return 'Άκυρη Ημερομηνία';
  }
}

interface UnitListItemFooterProps {
  unit: Property;
}

export function UnitListItemFooter({ unit }: UnitListItemFooterProps) {
  // ========================================================================
  // ENTERPRISE LOGIC: Progressive Disclosure Pattern
  // ========================================================================

  const hasSoldStatus = unit.status === 'sold' || unit.status === 'rented' || unit.status === 'reserved';
  const hasCustomerLink = Boolean(unit.soldTo);

  // CASE 1: Available units - show booking option
  if (!hasSoldStatus) {
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

  // CASE 2: Sold/Rented/Reserved units - show customer info + date
  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-3">

      {/* ENTERPRISE: Customer Information Display */}
      {hasCustomerLink ? (
        <UnitCustomerDisplay
          unit={unit}
          variant="inline"
          size="sm"
          showActions={true}
          className="mb-2"
        />
      ) : (
        // Fallback for sold units without customer link (data integrity issue)
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">
            {unit.status === 'sold' ? 'Πωλήθηκε' :
             unit.status === 'reserved' ? 'Κρατήθηκε' : 'Ενοικιάστηκε'}
          </span>
          {unit.saleDate && (
            <>
              <span className="mx-2">•</span>
              <span>{formatDate(unit.saleDate)}</span>
            </>
          )}
        </div>
      )}

      {/* ENTERPRISE: Sale Date (only if no customer info shown above) */}
      {!hasCustomerLink && unit.saleDate && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>
            {unit.status === 'sold' ? 'Ημ/νία Πώλησης:' : 'Ημ/νία Ενοικίασης:'} {formatDate(unit.saleDate)}
          </span>
        </div>
      )}

    </div>
  );
}
