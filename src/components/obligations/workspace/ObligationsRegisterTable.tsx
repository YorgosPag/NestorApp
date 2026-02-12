"use client";

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSpacingClass } from '@/lib/design-system';
import type { ObligationDocument } from '@/types/obligations';
import { formatDate } from '@/lib/intl-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { OBLIGATION_WORKFLOW_LABEL_KEYS, getStatusToneClass } from './workflow';

interface ObligationsRegisterTableProps {
  obligations: ObligationDocument[];
  onDelete: (id: string) => Promise<void>;
}

export function ObligationsRegisterTable({ obligations, onDelete }: ObligationsRegisterTableProps) {
  const { t } = useTranslation('obligations');

  if (obligations.length === 0) {
    return (
      <section className={`rounded-lg border ${getSpacingClass('p', 'xl')} text-center`}>
        <h2 className="text-lg font-semibold">{t('workspace.register.table.emptyTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('workspace.register.table.emptyDescription')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border overflow-hidden" aria-label={t('workspace.register.title')}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">{t('workspace.register.table.doc')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('workspace.register.table.project')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('workspace.register.table.status')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('workspace.register.table.revision')}</th>
            <th className="px-4 py-3 text-left font-medium">{t('workspace.register.table.updated')}</th>
            <th className="px-4 py-3 text-right font-medium">{t('workspace.register.table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {obligations.map((obligation) => (
            <tr key={obligation.id} className="border-t">
              <td className="px-4 py-3">
                <div className="font-medium">{obligation.docNumber || obligation.id.slice(0, 8)}</div>
                <div className="text-muted-foreground">{obligation.title}</div>
              </td>
              <td className="px-4 py-3">{obligation.projectName}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={getStatusToneClass(obligation.status)}>
                  {t(OBLIGATION_WORKFLOW_LABEL_KEYS[obligation.status])}
                </Badge>
              </td>
              <td className="px-4 py-3">R{obligation.revision || 1}</td>
              <td className="px-4 py-3">{formatDate(obligation.updatedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Link href={`/obligations/${obligation.id}/edit`}>
                    <Button size="sm" variant="outline">{t('workspace.register.table.open')}</Button>
                  </Link>
                  <Button size="sm" variant="destructive" onClick={() => onDelete(obligation.id)}>
                    {t('workspace.register.table.delete')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
