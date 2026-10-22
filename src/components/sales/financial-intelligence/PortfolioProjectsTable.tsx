'use client';

/**
 * @fileoverview ADR-242 — **ο πίνακας έργων του χαρτοφυλακίου**: μία γραμμή ανά έργο, και το όνομα **οδηγεί στο έργο**.
 * @related PortfolioDashboard.tsx (ο γονέας) · lib/navigation/project-urls.ts (η ΜΙΑ διεύθυνση έργου)
 * @module components/sales/financial-intelligence/PortfolioProjectsTable
 *
 * 🔑 **Σύνδεσμος στο όνομα, ΟΧΙ κλικ σε όλη τη γραμμή** (Procore · Salesforce · Linear): ένα πραγματικό `<a href>` δίνει
 *    Ctrl/μεσαίο κλικ, «Αντιγραφή συνδέσμου» και πληκτρολόγιο· μια γραμμή με `router.push` δεν δίνει κανένα από τα τρία.
 * 🔑 **Ίδια καρτέλα, χωρίς `target`** (NN/g · WCAG 3.2.5): τη νέα καρτέλα τη διαλέγει ο άνθρωπος, όχι η εφαρμογή.
 * 🔑 **Προορισμός = η αρχική όψη του έργου**: καμία καρτέλα του δεν αντιστοιχεί σε πωλήσεις/εισπράξεις/κόστος χρήματος.
 */

import React from 'react';

import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { getProjectUrl } from '@/lib/navigation/project-urls';
import { TABLE_CELL_LINK_CLASS } from '@/lib/ui/link-style';
import { Link } from '@/lib/workspace/navigation';
import type { ProjectFinancialSummary } from '@/types/interest-calculator';
import { HealthStatusBadge } from './HealthStatusBadge';

/** Ποσό σε ευρώ χωρίς δεκαδικά — ίδιο για τις κάρτες KPI και τον πίνακα. */
export const formatPortfolioEuro = (val: number): string => formatCurrencyWhole(val) ?? '';

export interface PortfolioProjectsTableProps {
  readonly projects: readonly ProjectFinancialSummary[];
}

export function PortfolioProjectsTable({ projects }: PortfolioProjectsTableProps): React.ReactElement | null {
  const { t } = useTranslation(['payments']);
  if (projects.length === 0) return null;
  const notMeasured = t('portfolio.notMeasured');
  return (
    <section className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('portfolio.projectName')}</TableHead>
            <TableHead className="text-right">{t('portfolio.units')}</TableHead>
            <TableHead className="text-right">{t('portfolio.sold')}</TableHead>
            <TableHead className="text-right">{t('portfolio.value')}</TableHead>
            <TableHead className="text-right">{t('portfolio.collected')}</TableHead>
            <TableHead className="text-right">{t('portfolio.costOfMoney')}</TableHead>
            <TableHead className="text-right">{t('portfolio.collectionDays')}</TableHead>
            <TableHead className="text-center">{t('portfolio.health')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map(proj => (
            <TableRow key={proj.projectId}>
              <TableCell className="font-medium">
                <Link href={getProjectUrl(proj.projectId)} className={TABLE_CELL_LINK_CLASS}>{proj.projectName}</Link>
              </TableCell>
              <TableCell className="text-right">{proj.totalProperties}</TableCell>
              <TableCell className="text-right">{proj.soldProperties}</TableCell>
              <TableCell className="text-right">{formatPortfolioEuro(proj.totalValue)}</TableCell>
              <TableCell className="text-right">{formatPortfolioEuro(proj.collected)}</TableCell>
              <TableCell className="text-right">
                {proj.costOfMoney === null ? notMeasured : `${proj.costOfMoney.toFixed(2)}%`}
              </TableCell>
              <TableCell className="text-right">
                {proj.avgCollectionDays === null ? notMeasured : `${proj.avgCollectionDays}d`}
              </TableCell>
              <TableCell className="text-center">
                <HealthStatusBadge status={proj.healthStatus} drivers={proj.healthDrivers} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
