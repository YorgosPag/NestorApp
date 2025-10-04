'use client';
import { Separator } from '@/components/ui/separator';
import { PropertyDates } from '@/components/property-viewer/details/PropertyDates';

export function DatesBlock({ dates }: { dates: any; }) {
  if (!dates) return null;
  return (
    <>
      <Separator />
      <PropertyDates dates={dates} />
    </>
  );
}
