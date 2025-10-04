'use client';
import { Separator } from '@/components/ui/separator';
import { PropertyDocuments } from '@/components/property-viewer/details/PropertyDocuments';

export function DocumentsBlock({ documents }: { documents: any[] }) {
  if (!documents || documents.length === 0) return null;
  return (
    <>
      <Separator />
      <PropertyDocuments documents={documents} />
    </>
  );
}
