'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function CustomerLinkButton({ contactId }: { contactId: string }) {
  const iconSizes = useIconSizes();
  return (
    <Button asChild variant="outline" className="w-full">
      <Link href={`/contacts?contactId=${contactId}`}>
        Μετάβαση στον Πελάτη
        <ArrowRight className={`${iconSizes.sm} ml-2`} />
      </Link>
    </Button>
  );
}
