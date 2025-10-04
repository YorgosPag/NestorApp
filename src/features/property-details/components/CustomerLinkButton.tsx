'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export function CustomerLinkButton({ contactId }: { contactId: string }) {
  return (
    <Button asChild variant="outline" className="w-full">
      <Link href={`/contacts?contactId=${contactId}`}>
        Μετάβαση στον Πελάτη
        <ArrowRight className="w-4 h-4 ml-2" />
      </Link>
    </Button>
  );
}
