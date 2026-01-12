'use client';
import { Separator } from '@/components/ui/separator';
import { PropertyContacts } from '@/components/property-viewer/details/PropertyContacts';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';

export function ContactsBlock({
  owner, agent,
}: { owner?: ExtendedPropertyDetails['owner']; agent?: ExtendedPropertyDetails['agent']; }) {
  if (!owner && !agent) return null;
  return (
    <>
      <Separator />
      <PropertyContacts owner={owner} agent={agent} />
    </>
  );
}
