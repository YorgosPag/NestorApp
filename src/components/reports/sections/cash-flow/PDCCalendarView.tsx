'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/PDCCalendarView
 * @enterprise ADR-268 Phase 8 — Q6: PDC maturity calendar
 * @description Calendar view showing post-dated cheque maturities per day.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import type { PDCCalendarDay } from '@/services/cash-flow/cash-flow.types';
import { formatCurrencyWhole as formatCurrency } from '@/lib/intl-domain';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PDCCalendarViewProps {
  days: PDCCalendarDay[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PDCCalendarView({ days }: PDCCalendarViewProps) {
  const { t } = useTranslation('cash-flow');
  const [selectedDay, setSelectedDay] = useState<PDCCalendarDay | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Index days by date for fast lookup
  const dayMap = useMemo(() => {
    const map = new Map<string, PDCCalendarDay>();
    for (const day of days) {
      map.set(day.date, day);
    }
    return map;
  }, [days]);

  // Dates that have cheques
  const chequeDates = useMemo(
    () => days.map((d) => new Date(d.date)),
    [days],
  );

  const handleDayClick = (date: Date | undefined) => {
    if (!date) return;
    const key = date.toISOString().substring(0, 10);
    const day = dayMap.get(key);
    if (day) {
      setSelectedDay(day);
    }
  };

  // Summary stats
  const totalCheques = days.reduce((s, d) => s + d.chequeCount, 0);
  const totalAmount = days.reduce((s, d) => s + d.totalAmount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('pdc.title', 'PDC Maturity Calendar')}
          {totalCheques > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({totalCheques} {t('pdc.cheques', 'cheques')} — {formatCurrency(totalAmount)})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Calendar
          mode="single"
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          onSelect={handleDayClick}
          modifiers={{ hasCheques: chequeDates }}
          modifiersClassNames={{
            hasCheques: 'bg-amber-100 dark:bg-amber-900/30 font-bold text-amber-900 dark:text-amber-200',
          }}
          className="rounded-md border"
        />

        {days.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t('pdc.noCheques', 'No post-dated cheques found.')}
          </p>
        )}

        {/* Day detail dialog */}
        <Dialog open={selectedDay !== null} onOpenChange={() => setSelectedDay(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('pdc.dayTitle', 'Cheques maturing on')} {selectedDay?.date}
              </DialogTitle>
            </DialogHeader>
            {selectedDay && (
              <section className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t('pdc.total', 'Total')}: <strong>{formatCurrency(selectedDay.totalAmount)}</strong>
                  {' — '}{selectedDay.chequeCount} {t('pdc.cheques', 'cheques')}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('pdc.drawer', 'Drawer')}</TableHead>
                      <TableHead>{t('pdc.chequeNo', 'Cheque #')}</TableHead>
                      <TableHead className="text-right">{t('pdc.amount', 'Amount')}</TableHead>
                      <TableHead>{t('pdc.status', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDay.cheques.map((cheque) => (
                      <TableRow key={cheque.id}>
                        <TableCell className="font-medium">{cheque.drawerName}</TableCell>
                        <TableCell>{cheque.chequeNumber}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cheque.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{cheque.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
