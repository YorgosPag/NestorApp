'use client';
import { Separator } from '@/components/ui/separator';
import { PropertyDocuments } from '@/components/property-viewer/details/PropertyDocuments';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';

export function DocumentsBlock({ documents }: { documents: ExtendedPropertyDetails['documents'] }) {
  if (!documents || documents.length === 0) return null;
  return (
    <>
      <Separator />
      <PropertyDocuments documents={documents} />
    </>
  );
}
