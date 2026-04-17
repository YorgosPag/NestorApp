/**
 * =============================================================================
 * RESTORE PREVIEW TABLE — ADR-313 Admin UI
 * =============================================================================
 *
 * Displays CollectionReconciliation data as a table.
 * Shows per-collection: doc count, new/update/skip, immutable badge.
 *
 * @module components/admin/backup/RestorePreviewTable
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

import type { RestorePreview } from '@/services/backup/backup-manifest.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RestorePreviewTableProps {
  preview: RestorePreview;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RestorePreviewTable({ preview }: RestorePreviewTableProps) {
  const { t } = useTranslation(['admin']);
  const colors = useSemanticColors();

  const allCollections = [...preview.collections, ...preview.subcollections];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backup.restore.preview.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warnings */}
        {preview.warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="list-disc pl-4">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={cn('border-b text-left', colors.text.muted)}>
                <th className="pb-2 pr-4">{t('backup.restore.preview.collection')}</th>
                <th className="pb-2 pr-4 text-center">{t('backup.restore.preview.immutable')}</th>
                <th className="pb-2 pr-4 text-right">{t('backup.restore.preview.backupDocs')}</th>
                <th className="pb-2 pr-4 text-right">{t('backup.restore.preview.existingDocs')}</th>
                <th className="pb-2 pr-4 text-right">{t('backup.restore.preview.new')}</th>
                <th className="pb-2 pr-4 text-right">{t('backup.restore.preview.update')}</th>
                <th className="pb-2 text-right">{t('backup.restore.preview.skip')}</th>
              </tr>
            </thead>
            <tbody>
              {allCollections.map(col => (
                <tr key={col.collectionKey} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono text-xs">{col.collectionName}</td>
                  <td className="py-2 pr-4 text-center">
                    {col.isImmutable && (
                      <Badge variant="outline" className="text-xs">
                        {t('backup.restore.preview.immutable')}
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right">{col.documentCount.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right">{col.existingCount.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-green-600">{col.newCount.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right text-blue-600">{col.updateCount.toLocaleString()}</td>
                  <td className="py-2 text-right text-amber-600">{col.skipCount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Separator />

        {/* Summary */}
        <section aria-label={t('backup.restore.preview.summary')}>
          <h4 className="mb-2 font-medium">{t('backup.restore.preview.summary')}</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className={cn(colors.text.muted)}>{t('backup.restore.preview.totalDocuments')}</dt>
            <dd>{preview.totalDocuments.toLocaleString()}</dd>

            <dt className={cn(colors.text.muted)}>{t('backup.restore.preview.totalNew')}</dt>
            <dd className="text-green-600">{preview.totalNew.toLocaleString()}</dd>

            <dt className={cn(colors.text.muted)}>{t('backup.restore.preview.totalUpdate')}</dt>
            <dd className="text-blue-600">{preview.totalUpdate.toLocaleString()}</dd>

            <dt className={cn(colors.text.muted)}>{t('backup.restore.preview.totalSkip')}</dt>
            <dd className="text-amber-600">{preview.totalSkip.toLocaleString()}</dd>
          </dl>
        </section>
      </CardContent>
    </Card>
  );
}
