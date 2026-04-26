'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, ArrowRight } from 'lucide-react';
import { cn, getStatusColor } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RFQ, RfqStatus } from '@/subapps/procurement/types/rfq';

// ============================================================================
// RFQ STATUS BADGE
// ============================================================================

const RFQ_STATUS_SEMANTIC: Record<RfqStatus, string> = {
  draft:    'pending',
  active:   'active',
  closed:   'completed',
  archived: 'completed',
};

function RfqStatusBadge({ status }: { status: RfqStatus }) {
  const { t } = useTranslation('quotes');
  const semantic = RFQ_STATUS_SEMANTIC[status];
  return (
    <Badge
      variant="outline"
      className={cn('font-medium', getStatusColor(semantic, 'bg'), getStatusColor(semantic, 'text'))}
    >
      {t(`rfqs.statuses.${status}`)}
    </Badge>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

interface RfqListProps {
  rfqs: RFQ[];
  loading: boolean;
}

export function RfqList({ rfqs, loading }: RfqListProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = rfqs.filter((r) => {
    if (!search) return true;
    return r.title.toLowerCase().includes(search.toLowerCase());
  });

  const handleCreate = () => router.push('/procurement/rfqs/new');
  const handleView = (id: string) => router.push(`/procurement/rfqs/${id}`);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="text-base">{t('rfqs.title')}</CardTitle>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4" />
          {t('rfqs.create')}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('rfqs.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('rfqs.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('rfqs.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('rfqs.titleField')}</TableHead>
                <TableHead>{t('quotes.status')}</TableHead>
                <TableHead>{t('rfqs.deadline')}</TableHead>
                <TableHead>{t('rfqs.awardMode')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((rfq) => (
                <TableRow
                  key={rfq.id}
                  className="cursor-pointer"
                  onClick={() => handleView(rfq.id)}
                >
                  <TableCell className="font-medium">{rfq.title}</TableCell>
                  <TableCell>
                    <RfqStatusBadge status={rfq.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rfq.deadlineDate
                      ? new Date((rfq.deadlineDate as { seconds: number }).seconds * 1000).toLocaleDateString('el-GR')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {t(`rfqs.awardModes.${rfq.awardMode}`)}
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
