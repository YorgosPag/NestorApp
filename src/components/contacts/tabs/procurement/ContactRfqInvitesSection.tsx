'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowRight, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/design-system';
import type { VendorInvite } from '@/subapps/procurement/types/vendor-invite';

interface ContactRfqInvitesSectionProps {
  invites: VendorInvite[];
  loading: boolean;
  onCreateRfq?: () => void;
}

const STATUS_VARIANTS: Record<VendorInvite['status'], string> = {
  pending: 'bg-muted text-foreground',
  sent: 'bg-[hsl(var(--bg-info))]/40 text-primary',
  opened: 'bg-[hsl(var(--bg-warning))]/40 text-[hsl(var(--bg-warning))]',
  submitted: 'bg-[hsl(var(--bg-success))]/40 text-green-707',
  declined: 'bg-[hsl(var(--bg-error))]/40 text-destructive',
  expired: 'bg-muted text-foreground',
};

export function ContactRfqInvitesSection({
  invites,
  loading,
  onCreateRfq,
}: ContactRfqInvitesSectionProps) {
  const { t } = useTranslation(['contacts', 'quotes']);
  const router = useRouter();

  const handleView = (rfqId: string) => router.push(`/procurement/rfqs/${rfqId}`);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            {t('contacts:procurementTab.sections.rfqInvites')}
          </CardTitle>
          {onCreateRfq && (
            <Button size="sm" variant="outline" onClick={onCreateRfq}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('quotes:rfqs.create')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('quotes:rfqs.loading')}
          </p>
        ) : invites.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('quotes:rfqs.empty')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('quotes:rfqs.titleField')}</TableHead>
                <TableHead>{t('quotes:quotes.status')}</TableHead>
                <TableHead>{t('contacts:procurementTab.kpis.openRfqs')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleView(inv.rfqId)}
                >
                  <TableCell className="font-mono text-sm">{inv.rfqId}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('font-medium', STATUS_VARIANTS[inv.status])}
                    >
                      {t(`quotes:invites.statuses.${inv.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {inv.deliveryChannel}
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
