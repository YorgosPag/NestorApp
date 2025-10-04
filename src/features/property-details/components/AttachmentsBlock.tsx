'use client';
import { Separator } from '@/components/ui/separator';
import { PropertyAttachments } from '@/components/property-viewer/details/PropertyAttachments';
import type { StorageUnitStub, ParkingSpotStub } from '@/types/property-viewer';

export function AttachmentsBlock({ storage, parking }: { storage: StorageUnitStub[]; parking: ParkingSpotStub[]; }) {
  if ((storage?.length ?? 0) === 0 && (parking?.length ?? 0) === 0) return null;
  return (
    <>
      <Separator />
      <PropertyAttachments storage={storage} parking={parking} />
    </>
  );
}
