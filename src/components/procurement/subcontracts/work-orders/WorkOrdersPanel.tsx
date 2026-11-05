'use client';

/**
 * Οι **εντολές εργασίας** μιας κύριας σύμβασης στη σελίδα της (ADR-928 §5.24 · AIA A422 · ConsensusDocs 756).
 *
 * 🔑 Πάνελ, **όχι** καρτέλα του επεξεργαστή: οι εντολές δεν είναι περιεχόμενο του πρόχειρου (ο γραφέας τις δέχεται μόνο σε
 *    `accepted`/`in_execution`), ενώ ο επεξεργαστής υπάρχει μόνο για το πρόχειρο. Στο πρόχειρο το πάνελ λέει **πότε**
 *    θα μπορεί να δοθεί η πρώτη εντολή — ποτέ σιωπηλά ανενεργό κουμπί.
 * 🔑 Αριθμός ΕΕ-n = η θέση στο append-only `assignments` (`workOrdersOf`), **ο ίδιος** με το έγγραφο.
 * 🔑 Το κουμπί κρίνεται μόνο από τη σύμβαση (`refuseAssignment`)· το δικαίωμα κρίνεται **ανά έργο-στόχο** μέσα στον
 *    διάλογο — ο υπεύθυνος του έργου Α δεν δίνει εντολή στο Β, ούτε ο διάλογος το κρύβει: το λέει.
 */

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/procurement/shared/procurement-table-parts';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCalendarDate, formatDate } from '@/lib/intl-utils';
import { refuseAssignment } from '@/subapps/procurement/subcontracts/agreements/agreement-lifecycle';
import { workOrdersOf, type WorkOrder } from '@/subapps/procurement/subcontracts/agreements/work-orders';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';

const NewWorkOrderDialog = dynamic(() => import('./NewWorkOrderDialog'), { ssr: false });

const present = (values: readonly (string | null | undefined)[]): string =>
  values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' · ');

function WorkOrderRow({ order, assignedBy }: { order: WorkOrder; assignedBy: string }) {
  const { t } = useTranslation('procurement');
  const { assignment } = order;
  const { project } = assignment;
  const buildings = (project.buildings ?? []).map((building) => building.label).join(', ');
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-mono text-sm">{t('subcontracts.workOrders.number', { number: order.number })}</TableCell>
      <TableCell>
        <span className="flex flex-col">
          <span className="font-medium">{project.name}</span>
          <span className="text-xs text-muted-foreground">{present([project.address, project.licenseNumber, project.buildingBlock])}</span>
        </span>
      </TableCell>
      <TableCell className="text-sm">{buildings || '—'}</TableCell>
      <TableCell className="whitespace-nowrap text-sm">{assignment.startDate ? formatCalendarDate(assignment.startDate) : '—'}</TableCell>
      <TableCell className="whitespace-nowrap text-sm">{assignment.durationDays === null ? '—' : t('subcontracts.workOrders.days', { count: assignment.durationDays })}</TableCell>
      <TableCell className="text-sm">{assignment.note ?? ''}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{assignedBy} · {formatDate(assignment.assignedAt)}</TableCell>
    </TableRow>
  );
}

function WorkOrdersTable({ orders }: { orders: readonly WorkOrder[] }) {
  const { t } = useTranslation('procurement');
  const names = useUserDisplayNames(useMemo(() => [...new Set(orders.map((order) => order.assignment.assignedBy))], [orders]));
  return (
    <Table aria-label={t('subcontracts.workOrders.title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('subcontracts.workOrders.columns.number')}</TableHead>
          <TableHead>{t('subcontracts.workOrders.columns.project')}</TableHead>
          <TableHead>{t('subcontracts.workOrders.columns.buildings')}</TableHead>
          <TableHead>{t('subcontracts.workOrders.columns.start')}</TableHead>
          <TableHead>{t('subcontracts.workOrders.columns.duration')}</TableHead>
          <TableHead>{t('subcontracts.workOrders.columns.note')}</TableHead>
          <TableHead>{t('subcontracts.workOrders.columns.assigned')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => <WorkOrderRow key={order.assignment.id} order={order} assignedBy={names.get(order.assignment.assignedBy) ?? '—'} />)}
      </TableBody>
    </Table>
  );
}

export function WorkOrdersPanel({ agreement }: { readonly agreement: SubcontractAgreement }) {
  const { t } = useTranslation('procurement');
  const [open, setOpen] = useState(false);
  const orders = useMemo(() => workOrdersOf(agreement), [agreement]);
  if (agreement.scope.kind !== 'multi_project') return null;
  const assignable = refuseAssignment(agreement) === null;
  return (
    <section aria-labelledby="work-orders-title" className="space-y-3 rounded-lg border p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <hgroup>
          <h3 id="work-orders-title" className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-4 w-4" aria-hidden />{t('subcontracts.workOrders.title')}
          </h3>
          <p className="text-sm text-muted-foreground">{t('subcontracts.workOrders.count', { count: orders.length })}</p>
        </hgroup>
        <Button type="button" onClick={() => setOpen(true)} disabled={!assignable} aria-describedby={assignable ? undefined : 'work-orders-blocked'}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />{t('subcontracts.workOrders.action')}
        </Button>
      </header>
      {!assignable && <p id="work-orders-blocked" className="text-sm text-muted-foreground">{t('subcontracts.workOrders.blocked.notAssignable')}</p>}
      {orders.length > 0 && <WorkOrdersTable orders={orders} />}
      {open && <NewWorkOrderDialog agreement={agreement} fixedProjectId={null} onClose={() => setOpen(false)} />}
    </section>
  );
}
