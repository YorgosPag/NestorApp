// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function CustomerLinkButton({ contactId }: { contactId: string }) {
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  return (
    <Button asChild variant="outline" className="w-full">
      <Link href={`/contacts?contactId=${contactId}`}>
        {t('details.goToCustomer')}
        <ArrowRight className={`${iconSizes.sm} ml-2`} />
      </Link>
    </Button>
  );
}
