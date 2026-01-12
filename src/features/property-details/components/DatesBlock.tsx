'use client';
import { Separator } from '@/components/ui/separator';
import { PropertyDates } from '@/components/property-viewer/details/PropertyDates';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';

export function DatesBlock({ dates }: { dates: ExtendedPropertyDetails['dates']; }) {
  if (!dates) return null;
  return (
    <>
      <Separator />
      <PropertyDates dates={dates} />
    </>
  );
}
