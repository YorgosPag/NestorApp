'use client';
import { Separator } from '@/components/ui/separator';
import { PropertyContacts } from '@/components/property-viewer/details/PropertyContacts';

export function ContactsBlock({
  owner, agent,
}: { owner?: any; agent?: any; }) {
  if (!owner && !agent) return null;
  return (
    <>
      <Separator />
      <PropertyContacts owner={owner} agent={agent} />
    </>
  );
}
