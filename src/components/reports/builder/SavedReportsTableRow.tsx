/**
 * @module components/reports/builder/SavedReportsTableRow
 * @enterprise ADR-268 Phase 7 — Saved Report Table Row
 *
 * Single row for the SavedReportsList table.
 * Contains: favorite star, name, category badge, visibility, last run, actions menu.
 */

'use client';

import '@/lib/design-system';
import { useCallback } from 'react';
import { Star, MoreHorizontal, Play, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SavedReport } from '@/types/reports/saved-report';

// ============================================================================
// Types
// ============================================================================

interface SavedReportsTableRowProps {
  report: SavedReport;
  isFavorited: boolean;
  onLoad: (report: SavedReport) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (report: SavedReport) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(isoDate: string | null, neverLabel: string, recentLabel: string): string {
  if (!isoDate) return neverLabel;

  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return recentLabel;
  if (diffMins < 60) return `${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo`;
}

// ============================================================================
// Component
// ============================================================================

export function SavedReportsTableRow({
  report,
  isFavorited,
  onLoad,
  onDelete,
  onToggleFavorite,
  onDuplicate,
}: SavedReportsTableRowProps) {
  const { t } = useTranslation('saved-reports');
  const colors = useSemanticColors();

  const handleFavoriteClick = useCallback(() => {
    onToggleFavorite(report.id);
  }, [onToggleFavorite, report.id]);

  const handleLoadClick = useCallback(() => {
    onLoad(report);
  }, [onLoad, report]);

  const handleDuplicateClick = useCallback(() => {
    onDuplicate(report);
  }, [onDuplicate, report]);

  const handleDeleteClick = useCallback(() => {
    onDelete(report.id);
  }, [onDelete, report.id]);

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      {/* Favorite Star */}
      <td className="w-10 px-2 py-3 text-center">
        <button
          type="button"
          onClick={handleFavoriteClick}
          className="inline-flex items-center justify-center rounded-sm p-1 hover:bg-muted"
          aria-label={t('actions.toggleFavorite')}
        >
          <Star
            className={cn(
              'h-4 w-4',
              isFavorited
                ? cn('fill-current', colors.text.warning)
                : 'text-muted-foreground',
            )}
          />
        </button>
      </td>

      {/* Name + Description */}
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={handleLoadClick}
          className="text-left hover:underline"
        >
          <p className="text-sm font-medium">{report.name}</p>
          {report.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {report.description}
            </p>
          )}
        </button>
      </td>

      {/* Category Badge */}
      <td className="px-3 py-3">
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {t(`categories.${report.category}`)}
        </span>
      </td>

      {/* Visibility */}
      <td className="hidden px-3 py-3 sm:table-cell">
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
          report.visibility === 'shared' && cn(colors.bg.success, colors.text.success),
          report.visibility === 'personal' && cn(colors.bg.info, colors.text.info),
          report.visibility === 'system' && cn(colors.bg.muted, colors.text.secondary),
        )}>
          {t(`visibility.${report.visibility}`)}
        </span>
      </td>

      {/* Last Run */}
      <td className="hidden px-3 py-3 text-sm text-muted-foreground md:table-cell">
        {formatRelativeTime(report.lastRunAt, t('messages.neverRun'), t('messages.recentRun'))}
      </td>

      {/* Actions */}
      <td className="w-10 px-2 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{t('table.actions')}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLoadClick}>
              <Play className="mr-2 h-4 w-4" />
              {t('actions.load')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicateClick}>
              <Copy className="mr-2 h-4 w-4" />
              {t('actions.duplicate')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('actions.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
