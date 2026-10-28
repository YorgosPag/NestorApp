'use client';

import { useState } from 'react';
import { useRouter } from '@/lib/workspace/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderBar } from '@/components/ui/header-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ProcurementRowLink,
  ProcurementTableNotice,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/procurement/shared/procurement-table-parts';
import { Plus, Search } from 'lucide-react';
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getRfqDetailUrl } from '@/lib/navigation/procurement-urls';
import type { RFQ, RfqStatus } from '@/subapps/procurement/types/rfq';

// ============================================================================
// RFQ STATUS BADGE
// ============================================================================

/**
 * Κατάσταση → παραλλαγή `Badge` (μετρημένο μελάνι, ADR-854 §3). Ως τις 2026-10-28 ήταν κατάσταση → token, με
 * γέμισμα ΚΑΙ κείμενο από το ίδιο token ⇒ άδειο χάπι (ADR-327 changelog 2026-10-28).
 */
const RFQ_STATUS_BADGE_VARIANTS: Record<RfqStatus, GridCardBadgeVariant> = {
  draft:     'secondary',
  active:    'info',
  closed:    'success',
  cancelled: 'destructive',
  archived:  'secondary',
};

function RfqStatusBadge({ status }: { status: RfqStatus }) {
  const { t } = useTranslation('quotes');
  return (
    <Badge variant={RFQ_STATUS_BADGE_VARIANTS[status]}>
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
  onCreateRfq?: () => void;
}

export function RfqList({ rfqs, loading, onCreateRfq }: RfqListProps) {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = rfqs.filter((r) => {
    if (!search) return true;
    return r.title.toLowerCase().includes(search.toLowerCase());
  });

  const handleCreate = onCreateRfq ?? (() => router.push('/procurement/rfqs/new'));
  const handleView = (rfq: RFQ) => router.push(getRfqDetailUrl(rfq.projectId, rfq.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <HeaderBar
          actions={
            <Button size="sm" onClick={handleCreate}>
              <Plus className="mr-1 h-4 w-4" />
              {t('rfqs.create')}
            </Button>
          }
        >
          <CardTitle className="text-base">{t('rfqs.title')}</CardTitle>
        </HeaderBar>
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
          <ProcurementTableNotice>{t('rfqs.loading')}</ProcurementTableNotice>
        ) : filtered.length === 0 ? (
          <ProcurementTableNotice>{t('rfqs.empty')}</ProcurementTableNotice>
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
                <ProcurementRowLink
                  key={rfq.id}
                  onClick={() => handleView(rfq)}
                  testId={`rfq-row-${rfq.id}`}
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
                </ProcurementRowLink>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
